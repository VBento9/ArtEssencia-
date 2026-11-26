-- DEVELOPMENT ONLY. Private schema must not be included in exposed Data API schemas.
-- No application-role privileges; fixture explicitly grants temporary access.
CREATE SCHEMA IF NOT EXISTS artessencia_intelligence_private;
REVOKE ALL ON SCHEMA artessencia_intelligence_private FROM PUBLIC,anon,authenticated;
CREATE TABLE IF NOT EXISTS artessencia_intelligence_private.controls (
 user_id uuid PRIMARY KEY,
 enabled boolean NOT NULL DEFAULT false,
 stock_enabled boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS artessencia_intelligence_private.count_receipts (
 user_id uuid NOT NULL,
 mission_id uuid NOT NULL,
 request_lines jsonb NOT NULL CHECK (jsonb_typeof(request_lines)='array'),
 committed_revision bigint NOT NULL,
 committed_at timestamptz NOT NULL,
 PRIMARY KEY(user_id,mission_id)
);
ALTER TABLE artessencia_intelligence_private.controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE artessencia_intelligence_private.count_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE artessencia_intelligence_private.controls,artessencia_intelligence_private.count_receipts FROM PUBLIC,anon,authenticated;
DROP POLICY IF EXISTS intelligence_controls_read ON artessencia_intelligence_private.controls;
CREATE POLICY intelligence_controls_read ON artessencia_intelligence_private.controls FOR SELECT TO authenticated
 USING (user_id=(SELECT auth.uid()) AND (SELECT public.artessencia_is_owner_v1()));
DROP POLICY IF EXISTS intelligence_receipts_read ON artessencia_intelligence_private.count_receipts;
CREATE POLICY intelligence_receipts_read ON artessencia_intelligence_private.count_receipts FOR SELECT TO authenticated
 USING (user_id=(SELECT auth.uid()) AND (SELECT public.artessencia_is_owner_v1()));
DROP POLICY IF EXISTS intelligence_receipts_append ON artessencia_intelligence_private.count_receipts;
CREATE POLICY intelligence_receipts_append ON artessencia_intelligence_private.count_receipts FOR INSERT TO authenticated
 WITH CHECK (user_id=(SELECT auth.uid()) AND (SELECT public.artessencia_is_owner_v1()));

-- Approval is a separate, private, immutable request bound to owner and revision.
CREATE TABLE IF NOT EXISTS artessencia_intelligence_private.count_approvals (
 user_id uuid NOT NULL,
 mission_id uuid NOT NULL,
 expected_revision bigint NOT NULL CHECK(expected_revision>=0),
 request_lines jsonb NOT NULL CHECK(jsonb_typeof(request_lines)='array'),
 approved_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires_at timestamptz NOT NULL,
 CHECK(expires_at>approved_at),
 PRIMARY KEY(user_id,mission_id)
);
ALTER TABLE artessencia_intelligence_private.count_approvals ADD COLUMN IF NOT EXISTS revoked_at timestamptz;
ALTER TABLE artessencia_intelligence_private.count_approvals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE artessencia_intelligence_private.count_approvals FROM PUBLIC,anon,authenticated;
DROP POLICY IF EXISTS intelligence_approvals_read ON artessencia_intelligence_private.count_approvals;
CREATE POLICY intelligence_approvals_read ON artessencia_intelligence_private.count_approvals FOR SELECT TO authenticated
 USING (user_id=(SELECT auth.uid()) AND (SELECT public.artessencia_is_owner_v1()));

-- Shared validation for approval and execution; no write permissions.
CREATE OR REPLACE FUNCTION artessencia_intelligence_private.normalize_count_lines(p_lines jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $normalize$
DECLARE line jsonb; old_qty numeric; new_qty numeric; v_request_lines jsonb;
BEGIN
 IF jsonb_typeof(p_lines) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
 IF jsonb_array_length(p_lines) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
 FOR line IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
  IF jsonb_typeof(line) IS DISTINCT FROM 'object' OR jsonb_typeof(line->'name') IS DISTINCT FROM 'string'
     OR length(line->>'name') NOT BETWEEN 1 AND 200 OR trim(line->>'name') IS DISTINCT FROM line->>'name'
     OR coalesce(line->>'unit','') NOT IN ('g','ml','cm','un')
     OR jsonb_typeof(line->'before') IS DISTINCT FROM 'number' OR jsonb_typeof(line->'after') IS DISTINCT FROM 'number'
     THEN RAISE EXCEPTION 'INVALID_LINE'; END IF;
  old_qty := (line->>'before')::numeric; new_qty := (line->>'after')::numeric;
  IF old_qty<0 OR new_qty<0 OR old_qty=new_qty OR old_qty>1000000000000 OR new_qty>1000000000000
     OR (line->>'unit'='un' AND (trunc(old_qty)<>old_qty OR trunc(new_qty)<>new_qty))
     THEN RAISE EXCEPTION 'INVALID_QUANTITY'; END IF;
 END LOOP;
 IF (SELECT count(DISTINCT x->>'name') FROM jsonb_array_elements(p_lines) x)<>jsonb_array_length(p_lines)
  THEN RAISE EXCEPTION 'DUPLICATE_LINE'; END IF;
 SELECT jsonb_agg(jsonb_build_object('name',x->>'name','unit',x->>'unit','before',x->'before','after',x->'after') ORDER BY x->>'name')
 INTO v_request_lines FROM jsonb_array_elements(p_lines) x;
 RETURN v_request_lines;
END;
$normalize$;
REVOKE ALL ON FUNCTION artessencia_intelligence_private.normalize_count_lines(jsonb) FROM PUBLIC,anon,authenticated;

-- DEVELOPMENT DRAFT: do not deploy or grant client execution until integration tests and review.
-- Explicitly uses the canonical operational state and existing adjustment history.
CREATE OR REPLACE FUNCTION public.artessencia_intelligence_count_v1(
 p_revision bigint, p_mission uuid, p_lines jsonb, p_device text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
 actor uuid := auth.uid();
 st public.artessencia_v1_state%rowtype;
 line jsonb; item jsonb; hits bigint;
 old_qty numeric; new_qty numeric;
 next_stock jsonb; next_moves jsonb; previous jsonb; v_request_lines jsonb;
 stamp timestamptz := clock_timestamp();
BEGIN
 IF actor IS NULL OR public.artessencia_is_owner_v1() IS DISTINCT FROM true THEN
  RAISE EXCEPTION USING errcode='42501',message='OWNER_REQUIRED';
 END IF;
 IF p_revision IS NULL OR p_revision<0 OR p_mission IS NULL OR p_device IS NULL
    OR length(p_device) NOT BETWEEN 1 AND 150 OR jsonb_typeof(p_lines) IS DISTINCT FROM 'array' THEN
  RAISE EXCEPTION 'INVALID_REQUEST';
 END IF;
 v_request_lines:=artessencia_intelligence_private.normalize_count_lines(p_lines);
 SELECT * INTO st FROM public.artessencia_v1_state WHERE user_id=actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'CANONICAL_STATE_REQUIRED'; END IF;
 -- Any future configuration writer must acquire this same state lock first.
 IF NOT EXISTS(SELECT 1 FROM artessencia_intelligence_private.controls c
   WHERE c.user_id=actor AND c.enabled AND c.stock_enabled)
 THEN RAISE EXCEPTION 'AGENT_DISABLED'; END IF;
 SELECT r.request_lines INTO previous FROM artessencia_intelligence_private.count_receipts r
  WHERE r.user_id=actor AND r.mission_id=p_mission;
 IF FOUND THEN
  IF previous IS DISTINCT FROM v_request_lines THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
  RETURN jsonb_build_object('state',to_jsonb(st),'mission',p_mission,'replayed',true);
 END IF;
 IF jsonb_typeof(st.data->'stock') IS DISTINCT FROM 'array'
    OR jsonb_typeof(st.data->'stockMoves') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'INVALID_STATE'; END IF;
 SELECT jsonb_agg(jsonb_build_object('name',x->>'item','unit',x->>'unit','before',x->'beforeQty','after',x->'afterQty') ORDER BY x->>'item')
 INTO previous FROM jsonb_array_elements(st.data->'stockMoves') x
 WHERE x->>'source'='intelligence_count_v1' AND x->>'intelligenceMissionId'=p_mission::text;
 IF previous IS NOT NULL THEN RAISE EXCEPTION 'UNRECONCILED_LEGACY_MISSION'; END IF;
 IF st.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION USING errcode='40001',message='cloud_revision_conflict'; END IF;
 IF NOT EXISTS(SELECT 1 FROM artessencia_intelligence_private.count_approvals a
   WHERE a.user_id=actor AND a.mission_id=p_mission AND a.expected_revision=p_revision
   AND a.request_lines=v_request_lines AND a.revoked_at IS NULL AND a.expires_at>clock_timestamp())
 THEN RAISE EXCEPTION 'MISSION_NOT_APPROVED'; END IF;
 next_stock:=st.data->'stock'; next_moves:=st.data->'stockMoves';
 FOR line IN SELECT value FROM jsonb_array_elements(v_request_lines) LOOP
  SELECT count(*),jsonb_agg(x)->0 INTO hits,item FROM jsonb_array_elements(next_stock) x WHERE x->>'name'=line->>'name';
  IF hits<>1 OR item->>'unit' IS DISTINCT FROM line->>'unit'
     OR jsonb_typeof(item->'qty') NOT IN ('number','string') OR item->'qty' IS NULL THEN RAISE EXCEPTION 'STOCK_CHANGED'; END IF;
  old_qty:=(line->>'before')::numeric; new_qty:=(line->>'after')::numeric;
  IF (item->>'qty')::numeric IS DISTINCT FROM old_qty THEN RAISE EXCEPTION 'STOCK_CHANGED'; END IF;
  SELECT jsonb_agg(CASE WHEN x->>'name'=line->>'name' THEN jsonb_set(x,'{qty}',to_jsonb(new_qty)) ELSE x END ORDER BY pos)
   INTO next_stock FROM jsonb_array_elements(next_stock) WITH ORDINALITY t(x,pos);
  next_moves:=next_moves||jsonb_build_array(jsonb_build_object(
   'date',stamp,'item',line->>'name','unit',line->>'unit','type','adjust','qty',new_qty,
   'beforeQty',old_qty,'afterQty',new_qty,'delta',new_qty-old_qty,
   'note','Contagem física aprovada — Intelligence','source','intelligence_count_v1','intelligenceMissionId',p_mission));
 END LOOP;
 UPDATE public.artessencia_v1_state SET data=jsonb_set(jsonb_set(st.data,'{stock}',next_stock),'{stockMoves}',next_moves),
  revision=st.revision+1,updated_at=stamp,device_id=p_device WHERE user_id=actor RETURNING * INTO st;
 IF NOT FOUND THEN RAISE EXCEPTION 'WRITE_NOT_CONFIRMED'; END IF;
 INSERT INTO artessencia_intelligence_private.count_receipts(user_id,mission_id,request_lines,committed_revision,committed_at)
 VALUES(actor,p_mission,v_request_lines,st.revision,stamp);
 RETURN jsonb_build_object('state',to_jsonb(st),'mission',p_mission,'replayed',false);
END;
$$;
-- Deliberately inaccessible to application roles in this draft. Fixture grants only locally.
REVOKE ALL ON FUNCTION public.artessencia_intelligence_count_v1(bigint,uuid,jsonb,text) FROM PUBLIC,anon,authenticated;

-- Private owner commands. SECURITY DEFINER is deliberate for restricted table writes.
-- Final deployment must assign a dedicated, least-privileged owner and review RLS.
-- No application grants; all functions remain unavailable outside the isolated fixture.
CREATE OR REPLACE FUNCTION artessencia_intelligence_private.set_count_controls(p_enabled boolean,p_stock_enabled boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $controls$
DECLARE actor uuid:=auth.uid();
BEGIN
 IF actor IS NULL OR public.artessencia_is_owner_v1() IS DISTINCT FROM true THEN RAISE EXCEPTION USING errcode='42501',message='OWNER_REQUIRED'; END IF;
 IF p_enabled IS NULL OR p_stock_enabled IS NULL OR (NOT p_enabled AND p_stock_enabled) THEN RAISE EXCEPTION 'INVALID_CONTROLS'; END IF;
 PERFORM 1 FROM public.artessencia_v1_state s WHERE s.user_id=actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'CANONICAL_STATE_REQUIRED'; END IF;
 INSERT INTO artessencia_intelligence_private.controls(user_id,enabled,stock_enabled) VALUES(actor,p_enabled,p_stock_enabled)
 ON CONFLICT(user_id) DO UPDATE SET enabled=excluded.enabled,stock_enabled=excluded.stock_enabled;
 IF NOT p_enabled OR NOT p_stock_enabled THEN
  UPDATE artessencia_intelligence_private.count_approvals a SET revoked_at=clock_timestamp()
   WHERE a.user_id=actor AND a.revoked_at IS NULL
    AND NOT EXISTS(SELECT 1 FROM artessencia_intelligence_private.count_receipts r WHERE r.user_id=actor AND r.mission_id=a.mission_id);
 END IF;
 RETURN jsonb_build_object('enabled',p_enabled,'stock_enabled',p_stock_enabled);
END;
$controls$;

CREATE OR REPLACE FUNCTION artessencia_intelligence_private.approve_count(p_revision bigint,p_mission uuid,p_lines jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $approve$
DECLARE actor uuid:=auth.uid(); st public.artessencia_v1_state%rowtype; line jsonb; item jsonb; hits bigint; v_request_lines jsonb; stamp timestamptz; expiry timestamptz;
BEGIN
 IF actor IS NULL OR public.artessencia_is_owner_v1() IS DISTINCT FROM true THEN RAISE EXCEPTION USING errcode='42501',message='OWNER_REQUIRED'; END IF;
 IF p_revision IS NULL OR p_revision<0 OR p_mission IS NULL THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
 v_request_lines:=artessencia_intelligence_private.normalize_count_lines(p_lines);
 SELECT * INTO st FROM public.artessencia_v1_state WHERE user_id=actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'CANONICAL_STATE_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM artessencia_intelligence_private.controls c WHERE c.user_id=actor AND c.enabled AND c.stock_enabled) THEN RAISE EXCEPTION 'AGENT_DISABLED'; END IF;
 IF st.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION USING errcode='40001',message='cloud_revision_conflict'; END IF;
 IF EXISTS(SELECT 1 FROM artessencia_intelligence_private.count_approvals a WHERE a.user_id=actor AND a.mission_id=p_mission)
 OR EXISTS(SELECT 1 FROM artessencia_intelligence_private.count_receipts r WHERE r.user_id=actor AND r.mission_id=p_mission) THEN RAISE EXCEPTION 'MISSION_ID_USED'; END IF;
 IF jsonb_typeof(st.data->'stock') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'INVALID_STATE'; END IF;
 FOR line IN SELECT value FROM jsonb_array_elements(v_request_lines) LOOP
  SELECT count(*),jsonb_agg(x)->0 INTO hits,item FROM jsonb_array_elements(st.data->'stock') x WHERE x->>'name'=line->>'name';
  IF hits<>1 OR item->>'unit' IS DISTINCT FROM line->>'unit' OR jsonb_typeof(item->'qty') NOT IN ('number','string') OR item->'qty' IS NULL THEN RAISE EXCEPTION 'STOCK_CHANGED'; END IF;
  IF (item->>'qty')::numeric IS DISTINCT FROM (line->>'before')::numeric THEN RAISE EXCEPTION 'STOCK_CHANGED'; END IF;
 END LOOP;
 stamp:=clock_timestamp(); expiry:=stamp+interval '15 minutes';
 INSERT INTO artessencia_intelligence_private.count_approvals(user_id,mission_id,expected_revision,request_lines,approved_at,expires_at)
 VALUES(actor,p_mission,p_revision,v_request_lines,stamp,expiry);
 RETURN jsonb_build_object('mission',p_mission,'revision',p_revision,'expires_at',expiry,'status','approved');
END;
$approve$;

CREATE OR REPLACE FUNCTION artessencia_intelligence_private.revoke_count(p_mission uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $revoke$
DECLARE actor uuid:=auth.uid();
BEGIN
 IF actor IS NULL OR public.artessencia_is_owner_v1() IS DISTINCT FROM true THEN RAISE EXCEPTION USING errcode='42501',message='OWNER_REQUIRED'; END IF;
 IF p_mission IS NULL THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
 PERFORM 1 FROM public.artessencia_v1_state s WHERE s.user_id=actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'CANONICAL_STATE_REQUIRED'; END IF;
 IF EXISTS(SELECT 1 FROM artessencia_intelligence_private.count_receipts r WHERE r.user_id=actor AND r.mission_id=p_mission) THEN RAISE EXCEPTION 'MISSION_ALREADY_EXECUTED'; END IF;
 UPDATE artessencia_intelligence_private.count_approvals a SET revoked_at=coalesce(a.revoked_at,clock_timestamp())
 WHERE a.user_id=actor AND a.mission_id=p_mission;
 IF NOT FOUND THEN RAISE EXCEPTION 'MISSION_NOT_FOUND'; END IF;
 RETURN jsonb_build_object('mission',p_mission,'status','revoked');
END;
$revoke$;

CREATE OR REPLACE FUNCTION artessencia_intelligence_private.execute_approved_count(p_revision bigint,p_mission uuid,p_lines jsonb,p_device text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $execute$
BEGIN
 IF auth.uid() IS NULL OR public.artessencia_is_owner_v1() IS DISTINCT FROM true THEN RAISE EXCEPTION USING errcode='42501',message='OWNER_REQUIRED'; END IF;
 RETURN public.artessencia_intelligence_count_v1(p_revision,p_mission,p_lines,p_device);
END;
$execute$;
REVOKE ALL ON FUNCTION artessencia_intelligence_private.set_count_controls(boolean,boolean),artessencia_intelligence_private.approve_count(bigint,uuid,jsonb),artessencia_intelligence_private.revoke_count(uuid),artessencia_intelligence_private.execute_approved_count(bigint,uuid,jsonb,text) FROM PUBLIC,anon,authenticated;
