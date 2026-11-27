-- DEVELOPMENT DRAFT. No production migration, public endpoint or application grants.
-- One shared ledger per installation, not one budget per agent or user.
CREATE SCHEMA IF NOT EXISTS artessencia_intelligence_private;
REVOKE ALL ON SCHEMA artessencia_intelligence_private FROM PUBLIC,anon,authenticated;
CREATE TABLE IF NOT EXISTS artessencia_intelligence_private.ai_budget_control(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 release_enabled boolean NOT NULL DEFAULT false,
 frozen boolean NOT NULL DEFAULT false
);
-- Administrator-only installation cap; changing it never enables paid execution.
ALTER TABLE artessencia_intelligence_private.ai_budget_control ADD COLUMN IF NOT EXISTS monthly_limit_microeur bigint NOT NULL DEFAULT 2000000 CHECK(monthly_limit_microeur BETWEEN 0 AND 23000000);
INSERT INTO artessencia_intelligence_private.ai_budget_control(singleton) VALUES(true) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS artessencia_intelligence_private.ai_budget_entries(
 request_id uuid PRIMARY KEY,
 channel text NOT NULL CHECK(channel IN ('director','financeiro','producao','stock','marketing','comercial','inovacao','auditoria','catalogo','legacy_insights','legacy_description','legacy_social')),
 model text NOT NULL CHECK(length(model) BETWEEN 1 AND 100),
 maximum_microeur bigint NOT NULL CHECK(maximum_microeur BETWEEN 1 AND 23000000),
 reserved_at timestamptz NOT NULL,
 reserved_month date NOT NULL,
 status text NOT NULL CHECK(status IN ('reserved','inflight','unknown','settled','void')),
 actual_microeur bigint CHECK(actual_microeur>=0),
 settled_month date,
 evidence_ref text,
 CHECK((status IN ('settled','void'))=(actual_microeur IS NOT NULL AND settled_month IS NOT NULL AND evidence_ref IS NOT NULL)),
 CHECK(status<>'void' OR actual_microeur=0)
);
ALTER TABLE artessencia_intelligence_private.ai_budget_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE artessencia_intelligence_private.ai_budget_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE artessencia_intelligence_private.ai_budget_control,artessencia_intelligence_private.ai_budget_entries FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION artessencia_intelligence_private.ai_budget_reserve(p_id uuid,p_channel text,p_model text,p_max bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $reserve$
DECLARE c artessencia_intelligence_private.ai_budget_control%rowtype; m date; used numeric; stamp timestamptz;
BEGIN
 IF p_id IS NULL OR p_channel IS NULL OR p_model IS NULL OR length(p_model) NOT BETWEEN 1 AND 100 OR p_max IS NULL OR p_max NOT BETWEEN 1 AND 23000000 THEN RAISE EXCEPTION 'INVALID_RESERVATION'; END IF;
 SELECT * INTO c FROM artessencia_intelligence_private.ai_budget_control WHERE singleton=true FOR UPDATE;
 IF NOT FOUND OR NOT c.release_enabled OR c.frozen THEN RAISE EXCEPTION 'BUDGET_DISABLED'; END IF;
 IF EXISTS(SELECT 1 FROM artessencia_intelligence_private.ai_budget_entries WHERE status='unknown' OR (status='inflight' AND reserved_at < clock_timestamp()-interval '5 minutes')) THEN RAISE EXCEPTION 'BUDGET_UNKNOWN'; END IF;
 stamp:=clock_timestamp();m:=date_trunc('month',stamp AT TIME ZONE 'Europe/Lisbon')::date;
 IF EXISTS(SELECT 1 FROM artessencia_intelligence_private.ai_budget_entries WHERE request_id=p_id) THEN RAISE EXCEPTION 'DUPLICATE_REQUEST'; END IF;
 SELECT coalesce(sum(CASE WHEN status IN ('reserved','inflight','unknown') THEN maximum_microeur WHEN status='settled' AND (reserved_month=m OR settled_month=m) THEN actual_microeur ELSE 0 END),0)
 INTO used FROM artessencia_intelligence_private.ai_budget_entries;
 IF used+p_max>c.monthly_limit_microeur THEN RAISE EXCEPTION 'BUDGET_LIMIT'; END IF;
 INSERT INTO artessencia_intelligence_private.ai_budget_entries(request_id,channel,model,maximum_microeur,reserved_at,reserved_month,status)
 VALUES(p_id,p_channel,p_model,p_max,stamp,m,'reserved');
 RETURN jsonb_build_object('requestId',p_id,'maximumMicroeur',p_max,'remainingMicroeur',c.monthly_limit_microeur-used-p_max,'status','reserved');
END;
$reserve$;

CREATE OR REPLACE FUNCTION artessencia_intelligence_private.ai_budget_claim(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $claim$
DECLARE c artessencia_intelligence_private.ai_budget_control%rowtype; e artessencia_intelligence_private.ai_budget_entries%rowtype; m date; used numeric;
BEGIN
 SELECT * INTO c FROM artessencia_intelligence_private.ai_budget_control WHERE singleton=true FOR UPDATE;
 IF NOT FOUND OR NOT c.release_enabled OR c.frozen THEN RAISE EXCEPTION 'BUDGET_DISABLED'; END IF;
 IF EXISTS(SELECT 1 FROM artessencia_intelligence_private.ai_budget_entries WHERE status='unknown' OR (status='inflight' AND reserved_at < clock_timestamp()-interval '5 minutes')) THEN RAISE EXCEPTION 'BUDGET_UNKNOWN'; END IF;
 -- Recheck under the same shared lock: lowering the cap after reservation must prevent new provider calls.
 m:=date_trunc('month',clock_timestamp() AT TIME ZONE 'Europe/Lisbon')::date;
 SELECT coalesce(sum(CASE WHEN status IN ('reserved','inflight','unknown') THEN maximum_microeur WHEN status='settled' AND (reserved_month=m OR settled_month=m) THEN actual_microeur ELSE 0 END),0)
 INTO used FROM artessencia_intelligence_private.ai_budget_entries;
 IF used>c.monthly_limit_microeur THEN RAISE EXCEPTION 'BUDGET_LIMIT'; END IF;
 UPDATE artessencia_intelligence_private.ai_budget_entries SET status='inflight' WHERE request_id=p_id AND status='reserved' RETURNING * INTO e;
 IF NOT FOUND THEN RAISE EXCEPTION 'REQUEST_NOT_CLAIMABLE'; END IF;
 RETURN jsonb_build_object('requestId',p_id,'status','inflight','model',e.model,'maximumMicroeur',e.maximum_microeur);
END;
$claim$;

CREATE OR REPLACE FUNCTION artessencia_intelligence_private.ai_budget_unknown(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $unknown$
BEGIN
 PERFORM 1 FROM artessencia_intelligence_private.ai_budget_control WHERE singleton=true FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'BUDGET_UNAVAILABLE'; END IF;
 UPDATE artessencia_intelligence_private.ai_budget_entries SET status='unknown' WHERE request_id=p_id AND status='inflight';
 IF NOT FOUND THEN RAISE EXCEPTION 'REQUEST_NOT_INFLIGHT'; END IF;
END;
$unknown$;

-- Only a trusted server worker may reconcile, using independently verified provider evidence.
-- The evidence reference alone is not proof: gateway integration must enforce verification.
CREATE OR REPLACE FUNCTION artessencia_intelligence_private.ai_budget_settle(p_id uuid,p_actual bigint,p_evidence text,p_no_charge boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $settle$
DECLARE e artessencia_intelligence_private.ai_budget_entries%rowtype; m date; new_status text;
BEGIN
 IF p_actual IS NULL OR p_actual<0 OR p_evidence IS NULL OR length(trim(p_evidence)) NOT BETWEEN 1 AND 200 OR p_no_charge IS NULL OR (p_no_charge AND p_actual<>0) THEN RAISE EXCEPTION 'INVALID_EVIDENCE'; END IF;
 PERFORM 1 FROM artessencia_intelligence_private.ai_budget_control WHERE singleton=true FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'BUDGET_UNAVAILABLE'; END IF;
 SELECT * INTO e FROM artessencia_intelligence_private.ai_budget_entries WHERE request_id=p_id FOR UPDATE;
 IF NOT FOUND OR NOT (e.status IN ('inflight','unknown') OR (e.status='reserved' AND p_no_charge)) THEN RAISE EXCEPTION 'REQUEST_NOT_SETTLEABLE'; END IF;
 m:=date_trunc('month',clock_timestamp() AT TIME ZONE 'Europe/Lisbon')::date;
 new_status:=CASE WHEN p_no_charge THEN 'void' ELSE 'settled' END;
 UPDATE artessencia_intelligence_private.ai_budget_entries SET status=new_status,actual_microeur=p_actual,settled_month=m,evidence_ref=p_evidence WHERE request_id=p_id;
 IF p_actual>e.maximum_microeur THEN UPDATE artessencia_intelligence_private.ai_budget_control SET frozen=true,release_enabled=false WHERE singleton=true; END IF;
 RETURN jsonb_build_object('requestId',p_id,'status',new_status,'actualMicroeur',p_actual,'overrun',p_actual>e.maximum_microeur);
END;
$settle$;
REVOKE ALL ON FUNCTION artessencia_intelligence_private.ai_budget_reserve(uuid,text,text,bigint),artessencia_intelligence_private.ai_budget_claim(uuid),artessencia_intelligence_private.ai_budget_unknown(uuid),artessencia_intelligence_private.ai_budget_settle(uuid,bigint,text,boolean) FROM PUBLIC,anon,authenticated;
