-- Candidate: isolated only, after owner console and worker SQL. Do not apply in production.
-- One explicit owner-requested requeue for a reconciled, read-only audit reasoning failure.
-- No change to financial gates, provider calls, existing approvals, or worker permissions.
BEGIN;
CREATE TABLE IF NOT EXISTS artessencia_intelligence_private.team_run_retry_archive(
 user_id uuid NOT NULL, mission_id uuid NOT NULL,
 request_id uuid NOT NULL UNIQUE REFERENCES artessencia_intelligence_private.ai_budget_entries(request_id),
 lease_id uuid NOT NULL UNIQUE, blocked_revision bigint NOT NULL,
 run_snapshot jsonb NOT NULL, mission_snapshot jsonb NOT NULL,
 archived_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(user_id,mission_id),
 FOREIGN KEY(user_id,mission_id) REFERENCES artessencia_intelligence_private.team_missions(user_id,mission_id)
);
ALTER TABLE artessencia_intelligence_private.team_run_retry_archive ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE artessencia_intelligence_private.team_run_retry_archive FROM PUBLIC,anon,authenticated;
-- Narrow owner-only entrypoint; not part of the service worker action allowlist.
CREATE OR REPLACE FUNCTION public.artessencia_intelligence_requeue_audit_v1(p_id uuid,p_revision bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $retry$
DECLARE actor uuid:=auth.uid();
 c artessencia_intelligence_private.team_controls%rowtype;
 m artessencia_intelligence_private.team_missions%rowtype;
 r artessencia_intelligence_private.team_runs%rowtype;
 e artessencia_intelligence_private.ai_budget_entries%rowtype;
 bc artessencia_intelligence_private.ai_budget_control%rowtype;
BEGIN
 IF actor IS NULL OR public.artessencia_is_owner_v1() IS DISTINCT FROM true THEN
  RAISE EXCEPTION USING errcode='42501',message='OWNER_REQUIRED';
 END IF;
 SELECT * INTO c FROM artessencia_intelligence_private.team_controls WHERE user_id=actor FOR UPDATE;
 IF NOT FOUND OR NOT c.enabled OR c.modes->>'auditoria' IS DISTINCT FROM 'manual' THEN RAISE EXCEPTION 'RETRY_MANUAL_ONLY'; END IF;
 SELECT * INTO m FROM artessencia_intelligence_private.team_missions WHERE user_id=actor AND mission_id=p_id FOR UPDATE;
 IF NOT FOUND OR m.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'MISSION_REVISION_CONFLICT'; END IF;
 IF m.status<>'blocked' OR m.agent<>'auditoria' OR m.kind<>'technical_review' OR m.control_revision<>c.revision THEN RAISE EXCEPTION 'RETRY_SCOPE_DENIED'; END IF;
 IF EXISTS(SELECT 1 FROM artessencia_intelligence_private.team_run_retry_archive a WHERE a.user_id=actor AND a.mission_id=p_id) THEN RAISE EXCEPTION 'RETRY_ALREADY_USED'; END IF;
 SELECT * INTO r FROM artessencia_intelligence_private.team_runs WHERE user_id=actor AND mission_id=p_id FOR UPDATE;
 IF NOT FOUND OR r.status<>'blocked' OR r.ended_at IS NULL OR r.claimed_revision+1<>m.revision
  OR r.outcome->>'stage' IS DISTINCT FROM 'reasoning'
  OR r.outcome->'receipts' IS DISTINCT FROM '[]'::jsonb
  OR r.tool_receipts IS DISTINCT FROM '[]'::jsonb
  OR r.outcome ? 'report' THEN RAISE EXCEPTION 'RETRY_SIDE_EFFECT_UNVERIFIED'; END IF;
 IF EXISTS(SELECT 1 FROM artessencia_intelligence_private.team_inputs i WHERE i.user_id=actor AND i.mission_id=p_id)
  OR EXISTS(SELECT 1 FROM artessencia_intelligence_private.team_delegations d WHERE d.user_id=actor AND d.parent_id=p_id) THEN RAISE EXCEPTION 'RETRY_SIDE_EFFECT_UNVERIFIED'; END IF;
 SELECT * INTO bc FROM artessencia_intelligence_private.ai_budget_control WHERE singleton=true FOR UPDATE;
 IF NOT FOUND OR bc.frozen OR EXISTS(SELECT 1 FROM artessencia_intelligence_private.ai_budget_entries WHERE status IN ('reserved','inflight','unknown')) THEN RAISE EXCEPTION 'RETRY_BUDGET_UNRECONCILED'; END IF;
 SELECT * INTO e FROM artessencia_intelligence_private.ai_budget_entries WHERE request_id=r.request_id FOR UPDATE;
 IF NOT FOUND OR e.status<>'settled' OR e.channel<>m.agent OR e.actual_microeur IS NULL
  OR jsonb_typeof(r.outcome->'chargedMicroeur') IS DISTINCT FROM 'number'
  OR r.outcome->'chargedMicroeur' IS DISTINCT FROM to_jsonb(e.actual_microeur)
  OR nullif(trim(e.evidence_ref),'') IS NULL THEN RAISE EXCEPTION 'RETRY_RECEIPT_UNVERIFIED'; END IF;
 -- Archive the exact prior attempt and mission state before moving the active slot.
 -- All writes are atomic, and the financial receipt itself is never modified.
 INSERT INTO artessencia_intelligence_private.team_run_retry_archive(user_id,mission_id,request_id,lease_id,blocked_revision,run_snapshot,mission_snapshot)
 VALUES(actor,p_id,r.request_id,r.lease_id,m.revision,to_jsonb(r),to_jsonb(m));
 DELETE FROM artessencia_intelligence_private.team_runs WHERE user_id=actor AND mission_id=p_id AND lease_id=r.lease_id;
 UPDATE artessencia_intelligence_private.team_missions SET status='pending_review',revision=m.revision+1,result_summary=NULL,updated_at=clock_timestamp()
 WHERE user_id=actor AND mission_id=p_id RETURNING * INTO m;
 INSERT INTO artessencia_intelligence_private.team_events(user_id,mission_id,revision,status) VALUES(actor,p_id,m.revision,'pending_review');
 RETURN jsonb_build_object('missionId',p_id,'revision',m.revision,'status',m.status,'previousRequestId',r.request_id,'requiresNewApproval',true);
END;
$retry$;
REVOKE ALL ON FUNCTION public.artessencia_intelligence_requeue_audit_v1(uuid,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.artessencia_intelligence_requeue_audit_v1(uuid,bigint) TO authenticated;
COMMIT;
