-- CI FIXTURE ONLY. Postgres in GitHub Actions; never run against production Supabase.
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION public.artessencia_is_owner_v1() RETURNS boolean LANGUAGE sql STABLE
AS $$ SELECT auth.uid()='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid $$;

CREATE TABLE public.artessencia_box_requests_v1 (
  request_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  customer_name text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL DEFAULT '',
  status text NOT NULL,
  responded_at timestamptz,
  quote_version integer NOT NULL,
  quoted_total numeric,
  items jsonb NOT NULL,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  customer_note text NOT NULL DEFAULT ''
);
CREATE TABLE public.artessencia_box_order_links_v1 (
  request_id uuid PRIMARY KEY REFERENCES public.artessencia_box_requests_v1(request_id),
  user_id uuid NOT NULL,
  order_id uuid NOT NULL UNIQUE,
  public_order_id text NOT NULL,
  quote_version integer NOT NULL,
  box_id text NOT NULL,
  technical_version integer NOT NULL
);
CREATE TABLE public.artessencia_v1_state (
  user_id uuid PRIMARY KEY,
  data jsonb NOT NULL
);
CREATE TABLE public.artessencia_v1_products (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  active boolean,
  data jsonb NOT NULL
);
CREATE TABLE public.artessencia_v1_orders (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  status text NOT NULL,
  order_date date,
  due_at timestamptz,
  subtotal numeric NOT NULL,
  total numeric NOT NULL,
  notes text,
  data jsonb NOT NULL
);

SET request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
INSERT INTO public.artessencia_box_requests_v1 (
  request_id,user_id,customer_name,phone,email,status,responded_at,quote_version,quoted_total,items,preferences,customer_note
) VALUES
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Cliente fictício A','912345678','fixture@example.invalid',
  'accepted',now(),2,25.00,
  '[{"code":"C01","qty":2},{"code":"C02","qty":1}]',
  '{"colors":"bege e verde","scents":"maçã e especiarias","dedication":"Parabéns","occasion":"Natal","packaging":"kraft","budget":"30","notes":"sem laço"}',
  'Entrega fictícia de teste'),
 ('22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Cliente fictício B','923456789','',
  'sent',null,1,12.50,'[{"code":"C01","qty":1}]','{}','');

INSERT INTO public.artessencia_v1_products (id,user_id,name,active,data) VALUES
 ('cccccccc-cccc-4ccc-8ccc-cccccccc0001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Vela fictícia',true,'{"code":"C01"}'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccc0002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Sabonete fictício',true,'{"code":"C02"}');

INSERT INTO public.artessencia_v1_state (user_id,data) VALUES (
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 jsonb_build_object('themedBoxes',jsonb_build_array(jsonb_build_object(
   'id','box-private-1',
   'originRequestId','11111111-1111-4111-8111-111111111111',
   'active',false,
   'technicalV2',jsonb_build_object('mode','finished'),
   'technicalRevisionV4',jsonb_build_object('version',3,'snapshot',jsonb_build_object('total',15.50)),
   'price',25,
   'basePackaging','Caixa Kraft',
   'items',jsonb_build_array(
     jsonb_build_object('code','C01','qty',2),
     jsonb_build_object('code','C02','qty',1))
  )))
);
