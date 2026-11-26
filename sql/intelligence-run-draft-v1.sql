-- Laboratory only. Apply after intelligence-team and intelligence-ai-budget drafts.
CREATE TABLE IF NOT EXISTS artessencia_intelligence_private.team_runs(
 user_id uuid NOT NULL, mission_id uuid NOT NULL, lease_id uuid NOT NULL UNIQUE,
 request_id uuid NOT NULL UNIQUE, claimed_revision bigint NOT NULL,
 status text NOT NULL CHECK(status IN ('working','review_ready','blocked')),
 outcome jsonb, started_at timestamptz NOT NULL DEFAULT clock_timestamp(), ended_at timestamptz,
 PRIMARY KEY(user_id,mission_id),
 FOREIGN KEY(user_id,mission_id) REFERENCES artessencia_intelligence_private.team_missions(user_id,mission_id),
 CHECK((status='working' AND outcome IS NULL AND ended_at IS NULL) OR (status<>'working' AND outcome IS NOT NULL AND ended_at IS NOT NULL))
);
ALTER TABLE artessencia_intelligence_private.team_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE artessencia_intelligence_private.team_runs FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION artessencia_intelligence_private.team_claim_run(p_id uuid,p_revision bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $claim$
DECLARE actor uuid:=auth.uid(); m jsonb; r artessencia_intelligence_private.team_runs%rowtype;
BEGIN
 IF actor IS NULL OR public.artessencia_is_owner_v1() IS DISTINCT FROM true THEN RAISE EXCEPTION USING errcode='42501',message='OWNER_REQUIRED'; END IF;
 m:=artessencia_intelligence_private.team_transition(p_id,p_revision,'working',NULL);
 INSERT INTO artessencia_intelligence_private.team_runs(user_id,mission_id,lease_id,request_id,claimed_revision,status)
 VALUES(actor,p_id,gen_random_uuid(),gen_random_uuid(),(m->>'revision')::bigint,'working') RETURNING * INTO r;
 RETURN m||jsonb_build_object('lease_id',r.lease_id,'request_id',r.request_id);
END;
$claim$;
CREATE OR REPLACE FUNCTION artessencia_intelligence_private.team_run_status(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $status$
DECLARE actor uuid:=auth.uid(); result jsonb;
BEGIN
 IF actor IS NULL OR public.artessencia_is_owner_v1() IS DISTINCT FROM true THEN RAISE EXCEPTION USING errcode='42501',message='OWNER_REQUIRED'; END IF;
 SELECT jsonb_build_object('missionId',m.mission_id,'owner',m.user_id,'agent',m.agent,'kind',m.kind,
 'missionStatus',m.status,'missionRevision',m.revision,'controlRevision',m.control_revision,
 'leaseId',r.lease_id,'requestId',r.request_id,'runStatus',r.status,'outcome',r.outcome,
 'active',coalesce(c.enabled AND c.revision=m.control_revision AND c.modes->>m.agent<>'off'
 AND m.status='working' AND r.status='working' AND r.claimed_revision=m.revision,false),
 'settings',jsonb_build_object('enabled',coalesce(c.enabled,false),'agents',c.modes,'paidEnabled',false,'monthlyCeilingCents',3000))
 INTO result FROM artessencia_intelligence_private.team_missions m
 LEFT JOIN artessencia_intelligence_private.team_runs r ON r.user_id=m.user_id AND r.mission_id=m.mission_id
 LEFT JOIN artessencia_intelligence_private.team_controls c ON c.user_id=m.user_id
 WHERE m.user_id=actor AND m.mission_id=p_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'MISSION_NOT_FOUND'; END IF;
 RETURN result;
END;
$status$;
-- Worker receipts are reported, not yet independently verified tool write proofs.
CREATE OR REPLACE FUNCTION artessencia_intelligence_private.team_finish_run(p_id uuid,p_lease uuid,p_status text,p_outcome jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $finish$
DECLARE actor uuid:=auth.uid(); c artessencia_intelligence_private.team_controls%rowtype;
 m artessencia_intelligence_private.team_missions%rowtype; r artessencia_intelligence_private.team_runs%rowtype;
 e artessencia_intelligence_private.ai_budget_entries%rowtype; charge bigint; summary text;
BEGIN
 IF actor IS NULL OR public.artessencia_is_owner_v1() IS DISTINCT FROM true THEN RAISE EXCEPTION USING errcode='42501',message='OWNER_REQUIRED'; END IF;
 IF p_status IS NULL OR p_status NOT IN ('review_ready','blocked') OR jsonb_typeof(p_outcome) IS DISTINCT FROM 'object'
 OR octet_length(p_outcome::text)>100000 OR jsonb_typeof(p_outcome->'receipts') IS DISTINCT FROM 'array'
 THEN RAISE EXCEPTION 'INVALID_OUTCOME'; END IF;
 IF jsonb_array_length(p_outcome->'receipts')>8 THEN RAISE EXCEPTION 'INVALID_OUTCOME'; END IF;
 SELECT * INTO c FROM artessencia_intelligence_private.team_controls WHERE user_id=actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'TEAM_DISABLED_OR_STALE'; END IF;
 SELECT * INTO m FROM artessencia_intelligence_private.team_missions WHERE user_id=actor AND mission_id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'MISSION_NOT_FOUND'; END IF;
 SELECT * INTO r FROM artessencia_intelligence_private.team_runs WHERE user_id=actor AND mission_id=p_id FOR UPDATE;
 IF NOT FOUND OR r.lease_id IS DISTINCT FROM p_lease THEN RAISE EXCEPTION 'LEASE_INVALID'; END IF;
 IF r.status<>'working' THEN
  IF r.status=p_status AND r.outcome=p_outcome THEN RETURN jsonb_build_object('missionId',p_id,'leaseId',p_lease,'status',r.status,'replayed',true); END IF;
  RAISE EXCEPTION 'RUN_ALREADY_FINAL';
 END IF;
 IF p_status='review_ready' THEN
  IF NOT c.enabled OR c.revision<>m.control_revision OR coalesce(c.modes->>m.agent,'off')='off'
   OR m.status<>'working' OR m.revision<>r.claimed_revision THEN RAISE EXCEPTION 'TEAM_DISABLED_OR_STALE'; END IF;
  IF jsonb_typeof(p_outcome->'chargedMicroeur') IS DISTINCT FROM 'number' OR coalesce(p_outcome->>'chargedMicroeur','') !~ '^[0-9]{1,15}$' THEN RAISE EXCEPTION 'CHARGE_UNVERIFIED'; END IF;
  charge:=(p_outcome->>'chargedMicroeur')::bigint;
  SELECT * INTO e FROM artessencia_intelligence_private.ai_budget_entries WHERE request_id=r.request_id;
  IF NOT FOUND OR e.status<>'settled' OR e.channel<>m.agent OR e.actual_microeur IS DISTINCT FROM charge THEN RAISE EXCEPTION 'CHARGE_UNVERIFIED'; END IF;
  summary:=p_outcome->>'summary';
  IF summary IS NULL OR length(trim(summary)) NOT BETWEEN 1 AND 1600 THEN RAISE EXCEPTION 'INVALID_OUTCOME'; END IF;
  PERFORM artessencia_intelligence_private.team_transition(p_id,m.revision,'review_ready',summary);
 ELSE
  IF m.status='working' AND m.revision=r.claimed_revision THEN
   UPDATE artessencia_intelligence_private.team_missions SET status='blocked',revision=m.revision+1,result_summary='Execução interrompida; verificar recibos e orçamento.',updated_at=clock_timestamp()
    WHERE user_id=actor AND mission_id=p_id;
   INSERT INTO artessencia_intelligence_private.team_events(user_id,mission_id,revision,status) VALUES(actor,p_id,m.revision+1,'blocked');
  ELSIF m.status<>'cancelled' THEN RAISE EXCEPTION 'MISSION_REVISION_CONFLICT'; END IF;
 END IF;
 UPDATE artessencia_intelligence_private.team_runs SET status=p_status,outcome=p_outcome,ended_at=clock_timestamp() WHERE user_id=actor AND mission_id=p_id;
 RETURN jsonb_build_object('missionId',p_id,'leaseId',p_lease,'status',p_status,'replayed',false);
END;
$finish$;
REVOKE ALL ON FUNCTION artessencia_intelligence_private.team_claim_run(uuid,bigint),artessencia_intelligence_private.team_run_status(uuid),artessencia_intelligence_private.team_finish_run(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
