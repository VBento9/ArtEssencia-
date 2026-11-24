\set ON_ERROR_STOP on
-- Apenas Postgres efémero do CI; não ligar à Cloud de produção.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE TABLE public.store_owner(user_id uuid PRIMARY KEY,active boolean DEFAULT true,created_at timestamptz DEFAULT now());
CREATE TABLE public.store_products(code text PRIMARY KEY,name text NOT NULL,active boolean DEFAULT true);
CREATE TABLE public.artessencia_shop_event_requests(
 request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL,
 customer_name text NOT NULL,phone text,email text,event_type text,event_date date,
 unidade_qty integer,products jsonb NOT NULL DEFAULT '[]',personalization jsonb NOT NULL DEFAULT '{}',
 notes text,status text NOT NULL DEFAULT 'new',created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.artessencia_shop_event_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_only ON public.artessencia_shop_event_requests FOR ALL TO authenticated
 USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT SELECT ON public.artessencia_shop_event_requests TO authenticated;
INSERT INTO public.store_owner(user_id) VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
INSERT INTO public.store_products(code,name) VALUES ('AE-TEST-001','Vela de ensaio');
\i migrations/catalog_contact_requests_v1.sql
BEGIN;
SET ROLE anon;
SELECT set_config('test.request_id', public.catalog_submit_contact_request_v1(
 '{"name":"Cliente Sintético","phone":"912345678","email":"teste@example.invalid",
 "message":"Gostaria de informações sobre esta vela.","kind":"information",
 "product_ref":"AE-TEST-001","client_request_id":"11111111-1111-4111-8111-111111111111",
 "privacy_consent":true,"website":""}'::jsonb)::text,true);
DO $$
DECLARE again uuid; denied boolean:=false; rejected boolean:=false; err text;
BEGIN
 again:=public.catalog_submit_contact_request_v1(
 '{"name":"Cliente Sintético","phone":"912345678","email":"teste@example.invalid",
 "message":"Gostaria de informações sobre esta vela.","kind":"information",
 "product_ref":"AE-TEST-001","client_request_id":"11111111-1111-4111-8111-111111111111",
 "privacy_consent":true,"website":""}'::jsonb);
 IF again::text<>current_setting('test.request_id') THEN RAISE EXCEPTION 'Non-idempotent request';END IF;
 BEGIN
  PERFORM count(*) FROM public.artessencia_shop_event_requests;
 EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Anonymous request can read private contacts';END IF;
 BEGIN
  PERFORM public.catalog_submit_contact_request_v1(jsonb_build_object(
   'message',repeat('x',6000),'privacy_consent',true));
 EXCEPTION WHEN OTHERS THEN
  rejected:=true;
  GET STACKED DIAGNOSTICS err=MESSAGE_TEXT; END;
 IF NOT rejected OR err<>'Pedido demasiado extenso' THEN
  RAISE EXCEPTION 'Size limit not enforced: %',err; END IF;
END $$;
RESET ROLE;
DO $$
BEGIN
 IF (SELECT count(*) FROM public.artessencia_shop_event_requests)<>1 THEN
  RAISE EXCEPTION 'Duplicate request inserted';END IF;
 IF NOT EXISTS(
  SELECT 1 FROM public.artessencia_shop_event_requests
  WHERE request_id=current_setting('test.request_id')::uuid
   AND status='new' AND personalization->>'request_kind'='catalog_contact'
   AND products @> '["AE-TEST-001 — Vela de ensaio"]'::jsonb
 ) THEN RAISE EXCEPTION 'Persisted payload invalid';END IF;
END $$;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.artessencia_shop_event_requests)<>1 THEN
  RAISE EXCEPTION 'Owner cannot read contact'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.artessencia_shop_event_requests)<>0 THEN
  RAISE EXCEPTION 'Cross-account read'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
\echo 'PASS: public RPC, deduplication, data persistence and RLS'
