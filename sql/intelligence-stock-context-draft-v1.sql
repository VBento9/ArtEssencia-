-- Laboratory only: read-only, least-data projection bound to active mission.
CREATE OR REPLACE FUNCTION artessencia_intelligence_private.team_stock_context(p_id uuid,p_lease uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $context$
DECLARE actor uuid:=auth.uid(); m artessencia_intelligence_private.team_missions%rowtype;
 c artessencia_intelligence_private.team_controls%rowtype; r artessencia_intelligence_private.team_runs%rowtype;
 s public.artessencia_v1_state%rowtype; payload jsonb;
BEGIN
 IF actor IS NULL OR public.artessencia_is_owner_v1() IS DISTINCT FROM true THEN RAISE EXCEPTION USING errcode='42501',message='OWNER_REQUIRED'; END IF;
 SELECT * INTO c FROM artessencia_intelligence_private.team_controls WHERE user_id=actor FOR UPDATE;
 IF NOT FOUND OR NOT c.enabled THEN RAISE EXCEPTION 'TEAM_DISABLED_OR_STALE'; END IF;
 SELECT * INTO m FROM artessencia_intelligence_private.team_missions WHERE user_id=actor AND mission_id=p_id FOR UPDATE;
 IF NOT FOUND OR m.status<>'working' OR m.control_revision<>c.revision OR coalesce(c.modes->>m.agent,'off')='off'
 OR NOT ((m.agent IN ('stock','producao','auditoria') AND m.kind='inventory_audit') OR (m.agent='stock' AND m.kind='stock_organization_plan'))
 THEN RAISE EXCEPTION 'CONTEXT_SCOPE_DENIED'; END IF;
 SELECT * INTO r FROM artessencia_intelligence_private.team_runs WHERE user_id=actor AND mission_id=p_id FOR UPDATE;
 IF NOT FOUND OR r.status<>'working' OR r.lease_id IS DISTINCT FROM p_lease OR r.claimed_revision<>m.revision THEN RAISE EXCEPTION 'LEASE_INVALID'; END IF;
 SELECT * INTO s FROM public.artessencia_v1_state WHERE user_id=actor;
 IF NOT FOUND OR s.revision IS NULL OR s.revision<0 OR jsonb_typeof(s.data->'stock') IS DISTINCT FROM 'array'
 THEN RAISE EXCEPTION 'SOURCE_UNAVAILABLE'; END IF;
 IF jsonb_array_length(s.data->'stock')>5000 THEN RAISE EXCEPTION 'SOURCE_TOO_LARGE'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(s.data->'stock') x WHERE jsonb_typeof(x) IS DISTINCT FROM 'object') THEN RAISE EXCEPTION 'SOURCE_INVALID'; END IF;
 SELECT jsonb_build_object('stock',coalesce(jsonb_agg(jsonb_build_object('name',x->'name','unit',x->'unit','qty',x->'qty','unitCost',x->'unitCost','category',x->'category') ORDER BY ord),'[]'::jsonb))
 INTO payload FROM jsonb_array_elements(s.data->'stock') WITH ORDINALITY AS a(x,ord);
 IF m.kind='inventory_audit' THEN
  IF jsonb_typeof(s.data->'productRecipes') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'SOURCE_UNAVAILABLE'; END IF;
  IF (SELECT count(*) FROM public.artessencia_v1_products WHERE user_id=actor)>5000 OR (SELECT count(*) FROM jsonb_object_keys(s.data->'productRecipes'))>5000 THEN RAISE EXCEPTION 'SOURCE_TOO_LARGE'; END IF;
  IF EXISTS(SELECT 1 FROM public.artessencia_v1_products p WHERE p.user_id=actor AND jsonb_typeof(p.data->'code') IS DISTINCT FROM 'string') THEN RAISE EXCEPTION 'SOURCE_INVALID'; END IF;
  payload:=payload||jsonb_build_object('products',(SELECT coalesce(jsonb_agg(jsonb_build_object('code',p.data->'code') ORDER BY p.id),'[]'::jsonb) FROM public.artessencia_v1_products p WHERE p.user_id=actor),
   'productRecipes',(SELECT coalesce(jsonb_object_agg(k,CASE WHEN jsonb_typeof(v)='array' THEN
   (SELECT coalesce(jsonb_agg(jsonb_build_object('item',x->'item','qty',x->'qty','unit',x->'unit') ORDER BY ord),'[]'::jsonb) FROM jsonb_array_elements(v) WITH ORDINALITY AS a(x,ord)) ELSE 'null'::jsonb END),'{}'::jsonb)
   FROM jsonb_each(s.data->'productRecipes') AS a(k,v)));
 END IF;
 IF octet_length(payload::text)>1000000 THEN RAISE EXCEPTION 'SOURCE_TOO_LARGE'; END IF;
 RETURN jsonb_build_object('verified',true,'owner',actor,'missionId',p_id,'leaseId',p_lease,'agent',m.agent,'kind',m.kind,'sourceRevision',s.revision,'evidenceIds',jsonb_build_array('canonical-state-r'||s.revision::text),'payload',payload);
END;
$context$;
REVOKE ALL ON FUNCTION artessencia_intelligence_private.team_stock_context(uuid,uuid) FROM PUBLIC,anon,authenticated;
