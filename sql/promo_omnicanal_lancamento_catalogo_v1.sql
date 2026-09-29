-- ArtEssencia — promoções omnicanal + desafio de lançamento do Catálogo
-- Preparado em 2026-09-29. Aplicar apenas após validação da branch.

alter table public.artessencia_promo_codes
  add column if not exists assigned_customer_key text;

alter table public.artessencia_promo_redemptions
  alter column order_id drop not null,
  add column if not exists backoffice_order_id uuid references public.artessencia_v1_orders(id) on delete restrict,
  add column if not exists channel text not null default 'ONLINE',
  add column if not exists challenge_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname='artessencia_promo_redemptions_channel_check'
  ) then
    alter table public.artessencia_promo_redemptions
      add constraint artessencia_promo_redemptions_channel_check
      check (channel in ('ONLINE','DIRECT'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname='artessencia_promo_redemptions_one_order_check'
  ) then
    alter table public.artessencia_promo_redemptions
      add constraint artessencia_promo_redemptions_one_order_check
      check (((order_id is not null)::int + (backoffice_order_id is not null)::int)=1);
  end if;
end $$;

create unique index if not exists artessencia_promo_redemptions_direct_unique
  on public.artessencia_promo_redemptions(promo_id,backoffice_order_id)
  where backoffice_order_id is not null;

create table if not exists public.artessencia_catalog_launch_config(
  owner_id uuid primary key,
  enabled boolean not null default false,
  label text not null default 'Lançamento do Catálogo',
  discount_type text not null default 'FIXED' check (discount_type in ('FIXED','PERCENT')),
  discount_value numeric not null default 3 check (discount_value>0),
  max_discount numeric,
  min_order numeric not null default 25 check (min_order>=0),
  validity_days integer not null default 60 check (validity_days between 1 and 365),
  required_favorites integer not null default 3 check (required_favorites between 1 and 20),
  require_install boolean not null default true,
  require_share boolean not null default true,
  require_notifications boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.artessencia_catalog_launch_config enable row level security;
revoke all on public.artessencia_catalog_launch_config from anon,authenticated;

create table if not exists public.artessencia_catalog_launch_challenges(
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  visitor_id uuid not null,
  installed boolean not null default false,
  shared boolean not null default false,
  favorites_count integer not null default 0 check (favorites_count>=0),
  notifications boolean not null default false,
  completed_at timestamptz,
  claimed_at timestamptz,
  customer_phone text,
  customer_key text,
  promo_id uuid references public.artessencia_promo_codes(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id,visitor_id)
);
alter table public.artessencia_catalog_launch_challenges enable row level security;
revoke all on public.artessencia_catalog_launch_challenges from anon,authenticated;

create unique index if not exists artessencia_catalog_launch_customer_claim_unique
  on public.artessencia_catalog_launch_challenges(owner_id,customer_key)
  where customer_key is not null and claimed_at is not null;

create index if not exists artessencia_catalog_launch_owner_completed_idx
  on public.artessencia_catalog_launch_challenges(owner_id,completed_at);

create index if not exists artessencia_promo_redemptions_direct_order_idx
  on public.artessencia_promo_redemptions(backoffice_order_id)
  where backoffice_order_id is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='artessencia_promo_redemptions_challenge_id_fkey'
      and conrelid='public.artessencia_promo_redemptions'::regclass
  ) then
    alter table public.artessencia_promo_redemptions
      add constraint artessencia_promo_redemptions_challenge_id_fkey
      foreign key (challenge_id) references public.artessencia_catalog_launch_challenges(id) on delete set null
      not valid;
  end if;
end $$;
alter table public.artessencia_promo_redemptions validate constraint artessencia_promo_redemptions_challenge_id_fkey;

create or replace function public.artessencia_catalog_launch_config_admin_v1(
  p_enabled boolean default null,
  p_label text default null,
  p_discount_type text default null,
  p_discount_value numeric default null,
  p_max_discount numeric default null,
  p_min_order numeric default null,
  p_validity_days integer default null,
  p_required_favorites integer default null,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_save boolean default false
) returns jsonb
language plpgsql security definer set search_path='public'
as $$
declare v_owner uuid:=auth.uid(); v public.artessencia_catalog_launch_config%rowtype;
begin
  if not public.artessencia_is_owner_v1() then raise exception 'not authorized'; end if;
  insert into public.artessencia_catalog_launch_config(owner_id)
  values(v_owner) on conflict(owner_id) do nothing;
  if p_save then
    if upper(coalesce(p_discount_type,discount_type)) not in ('FIXED','PERCENT') then raise exception 'invalid discount type'; end if;
    if coalesce(p_discount_value,discount_value,0)<=0 then raise exception 'invalid discount value'; end if;
    if upper(coalesce(p_discount_type,discount_type))='PERCENT' and coalesce(p_discount_value,discount_value,0)>100 then raise exception 'invalid percent'; end if;
    if p_max_discount is not null and p_max_discount<0 then raise exception 'invalid max discount'; end if;
    if p_starts_at is not null and p_ends_at is not null and p_ends_at<=p_starts_at then raise exception 'invalid campaign dates'; end if;
    update public.artessencia_catalog_launch_config set
      enabled=coalesce(p_enabled,enabled),
      label=coalesce(nullif(trim(p_label),''),label),
      discount_type=upper(coalesce(p_discount_type,discount_type)),
      discount_value=coalesce(p_discount_value,discount_value),
      max_discount=p_max_discount,
      min_order=greatest(0,coalesce(p_min_order,min_order)),
      validity_days=greatest(1,least(365,coalesce(p_validity_days,validity_days))),
      required_favorites=greatest(1,least(20,coalesce(p_required_favorites,required_favorites))),
      starts_at=p_starts_at,
      ends_at=p_ends_at,
      updated_at=now()
    where owner_id=v_owner;
  end if;
  select * into v from public.artessencia_catalog_launch_config where owner_id=v_owner;
  return to_jsonb(v);
end $$;

revoke execute on function public.artessencia_catalog_launch_config_admin_v1(boolean,text,text,numeric,numeric,numeric,integer,integer,timestamptz,timestamptz,boolean) from public,anon;
grant execute on function public.artessencia_catalog_launch_config_admin_v1(boolean,text,text,numeric,numeric,numeric,integer,integer,timestamptz,timestamptz,boolean) to authenticated;

create or replace function public.artessencia_catalog_launch_progress_v1(
 p_visitor_id uuid,
 p_action text default null,
 p_value integer default null
) returns jsonb
language plpgsql security definer
set search_path='public'
as $$
declare
 v_owner uuid;
 v_cfg public.artessencia_catalog_launch_config%rowtype;
 v_ch public.artessencia_catalog_launch_challenges%rowtype;
 v_action text:=lower(trim(coalesce(p_action,'')));
 v_push_active boolean:=false;
 v_ready boolean:=false;
begin
 select user_id into v_owner from public.store_owner where active=true order by created_at limit 1;
 if v_owner is null or p_visitor_id is null then return jsonb_build_object('enabled',false); end if;

 select * into v_cfg from public.artessencia_catalog_launch_config where owner_id=v_owner;
 if not found or not v_cfg.enabled
    or (v_cfg.starts_at is not null and now()<v_cfg.starts_at)
    or (v_cfg.ends_at is not null and now()>v_cfg.ends_at)
 then return jsonb_build_object('enabled',false); end if;

 insert into public.artessencia_catalog_launch_challenges(owner_id,visitor_id)
 values(v_owner,p_visitor_id)
 on conflict(owner_id,visitor_id) do nothing;

 select * into v_ch
 from public.artessencia_catalog_launch_challenges
 where owner_id=v_owner and visitor_id=p_visitor_id
 for update;

 if v_action='installed' then
   update public.artessencia_catalog_launch_challenges
   set installed=true,updated_at=now()
   where id=v_ch.id
   returning * into v_ch;

 elsif v_action='shared' then
   if v_cfg.require_install and not v_ch.installed then
     raise exception 'install required';
   end if;
   update public.artessencia_catalog_launch_challenges
   set shared=true,updated_at=now()
   where id=v_ch.id
   returning * into v_ch;

 elsif v_action='favorites' then
   if v_cfg.require_share and not v_ch.shared then
     raise exception 'share required';
   end if;
   update public.artessencia_catalog_launch_challenges
   set favorites_count=greatest(favorites_count,greatest(0,coalesce(p_value,0))),updated_at=now()
   where id=v_ch.id
   returning * into v_ch;

 elsif v_action='notifications' then
   if v_ch.favorites_count<v_cfg.required_favorites then
     raise exception 'favorites required';
   end if;
   select exists(
     select 1 from public.artessencia_marketing_push_subscriptions s
     where s.visitor_id=p_visitor_id and s.source='catalog' and s.active=true
   ) into v_push_active;
   if not v_push_active then raise exception 'active notification subscription required'; end if;
   update public.artessencia_catalog_launch_challenges
   set notifications=true,updated_at=now()
   where id=v_ch.id
   returning * into v_ch;
 end if;

 v_ready:=(not v_cfg.require_install or v_ch.installed)
   and (not v_cfg.require_share or v_ch.shared)
   and v_ch.favorites_count>=v_cfg.required_favorites
   and (not v_cfg.require_notifications or v_ch.notifications);

 if v_ready and v_ch.completed_at is null then
   update public.artessencia_catalog_launch_challenges
   set completed_at=now(),updated_at=now()
   where id=v_ch.id
   returning * into v_ch;
 end if;

 return jsonb_build_object(
   'enabled',true,
   'installed',v_ch.installed,
   'shared',v_ch.shared,
   'favorites_count',v_ch.favorites_count,
   'required_favorites',v_cfg.required_favorites,
   'notifications',v_ch.notifications,
   'completed',v_ch.completed_at is not null,
   'claimed',v_ch.claimed_at is not null,
   'promo_code',(select p.code from public.artessencia_promo_codes p where p.id=v_ch.promo_id),
   'label',v_cfg.label
 );
end
$$;
revoke execute on function public.artessencia_catalog_launch_progress_v1(uuid,text,integer) from public,authenticated;
grant execute on function public.artessencia_catalog_launch_progress_v1(uuid,text,integer) to anon;

create or replace function public.artessencia_catalog_launch_claim_v1(p_visitor_id uuid,p_phone text)
returns jsonb
language plpgsql security definer set search_path='public'
as $$
declare v_owner uuid; v_cfg public.artessencia_catalog_launch_config%rowtype; v_ch public.artessencia_catalog_launch_challenges%rowtype; v_digits text; v_key text; v_code text; v_promo uuid; i integer:=0;
begin
  select user_id into v_owner from public.store_owner where active=true order by created_at limit 1;
  if v_owner is null then raise exception 'campaign unavailable'; end if;
  select * into v_cfg from public.artessencia_catalog_launch_config where owner_id=v_owner and enabled=true;
  if not found or (v_cfg.starts_at is not null and now()<v_cfg.starts_at) or (v_cfg.ends_at is not null and now()>v_cfg.ends_at) then raise exception 'campaign unavailable'; end if;
  select * into v_ch from public.artessencia_catalog_launch_challenges where owner_id=v_owner and visitor_id=p_visitor_id for update;
  if not found or v_ch.completed_at is null then raise exception 'challenge incomplete'; end if;

  v_digits:=regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
  if length(v_digits)<9 or length(v_digits)>15 then raise exception 'invalid phone'; end if;
  if length(v_digits)=9 then v_digits:='351'||v_digits; end if;
  v_key:='p:'||v_digits;

  perform pg_advisory_xact_lock(hashtext('artessencia-launch-phone-'||v_owner::text||'-'||v_key));
  if exists(
    select 1 from public.artessencia_catalog_launch_challenges c
    where c.owner_id=v_owner and c.customer_key=v_key
      and c.claimed_at is not null and c.id<>v_ch.id
  ) then
    raise exception 'reward already claimed';
  end if;

  if v_ch.promo_id is not null then
    return jsonb_build_object('ok',true,'code',(select code from public.artessencia_promo_codes where id=v_ch.promo_id),'already_claimed',true);
  end if;

  loop
    i:=i+1;
    v_code:='AE-LANC-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,7));
    exit when not exists(select 1 from public.artessencia_promo_codes where owner_id=v_owner and code=v_code);
    if i>10 then raise exception 'could not generate code'; end if;
  end loop;

  v_promo:=gen_random_uuid();
  insert into public.artessencia_promo_codes(
    id,owner_id,code,label,discount_type,discount_value,max_discount,min_order,
    first_purchase_only,usage_limit,per_customer_limit,starts_at,ends_at,active,
    created_at,updated_at,assigned_customer_key
  ) values(
    v_promo,v_owner,v_code,v_cfg.label,v_cfg.discount_type,v_cfg.discount_value,v_cfg.max_discount,v_cfg.min_order,
    false,1,1,now(),now()+(v_cfg.validity_days||' days')::interval,true,
    now(),now(),v_key
  );

  update public.artessencia_catalog_launch_challenges set
    claimed_at=now(),customer_phone=p_phone,customer_key=v_key,promo_id=v_promo,updated_at=now()
  where id=v_ch.id;

  return jsonb_build_object('ok',true,'code',v_code,'already_claimed',false);
end $$;

revoke execute on function public.artessencia_catalog_launch_claim_v1(uuid,text) from public,authenticated;
grant execute on function public.artessencia_catalog_launch_claim_v1(uuid,text) to anon;

create or replace function public.artessencia_validate_promo_code_internal_v1(
  p_code text,p_subtotal numeric,p_phone text default null,p_email text default null,p_exclude_backoffice_order_id uuid default null
) returns jsonb
language plpgsql stable security definer set search_path='public'
as $$
declare
  v_owner uuid; v_promo public.artessencia_promo_codes%rowtype;
  v_phone_key text:=regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
  v_email_key text:=lower(trim(coalesce(p_email,''))); v_customer_key text;
  v_usage bigint; v_customer_usage bigint; v_prior_orders bigint; v_discount numeric:=0;
begin
  select user_id into v_owner from public.store_owner where active=true order by created_at limit 1;
  if v_owner is null then return jsonb_build_object('ok',false,'error','promo not eligible'); end if;
  select * into v_promo from public.artessencia_promo_codes where owner_id=v_owner and code=regexp_replace(upper(trim(coalesce(p_code,''))),'[^A-Z0-9_-]','','g') and active=true limit 1;
  if not found then return jsonb_build_object('ok',false,'error','promo not eligible'); end if;
  if v_promo.starts_at is not null and now()<v_promo.starts_at then return jsonb_build_object('ok',false,'error','promo not eligible'); end if;
  if v_promo.ends_at is not null and now()>v_promo.ends_at then return jsonb_build_object('ok',false,'error','promo not eligible'); end if;
  if coalesce(p_subtotal,0)<v_promo.min_order then return jsonb_build_object('ok',false,'error','minimum order not met','min_order',v_promo.min_order); end if;
  if length(v_phone_key)=9 then v_phone_key:='351'||v_phone_key; end if;
  v_customer_key:=case when length(v_phone_key)>=9 then 'p:'||v_phone_key when v_email_key<>'' then 'e:'||v_email_key else null end;
  if v_promo.assigned_customer_key is not null and v_customer_key is distinct from v_promo.assigned_customer_key then return jsonb_build_object('ok',false,'error','promo assigned to another customer'); end if;

  select count(*) into v_usage from public.artessencia_promo_redemptions r where r.promo_id=v_promo.id and (
    (coalesce(r.channel,'ONLINE')='ONLINE' and exists(select 1 from public.store_orders o where o.id=r.order_id and upper(coalesce(o.status,'')) not in ('CANCELADA','CANCELADO','CANCELLED')))
    or
    (r.channel='DIRECT' and exists(select 1 from public.artessencia_v1_orders o where o.id=r.backoffice_order_id and (p_exclude_backoffice_order_id is null or o.id<>p_exclude_backoffice_order_id) and upper(coalesce(o.status,'')) not in ('CANCELADA','CANCELADO','CANCELLED')))
  );
  if v_promo.usage_limit is not null and v_usage>=v_promo.usage_limit then return jsonb_build_object('ok',false,'error','promo not eligible'); end if;

  if v_customer_key is not null then
    select count(*) into v_customer_usage from public.artessencia_promo_redemptions r where r.promo_id=v_promo.id and r.customer_key=v_customer_key and (
      (coalesce(r.channel,'ONLINE')='ONLINE' and exists(select 1 from public.store_orders o where o.id=r.order_id and upper(coalesce(o.status,'')) not in ('CANCELADA','CANCELADO','CANCELLED')))
      or
      (r.channel='DIRECT' and exists(select 1 from public.artessencia_v1_orders o where o.id=r.backoffice_order_id and (p_exclude_backoffice_order_id is null or o.id<>p_exclude_backoffice_order_id) and upper(coalesce(o.status,'')) not in ('CANCELADA','CANCELADO','CANCELLED')))
    );
    if v_customer_usage>=v_promo.per_customer_limit then return jsonb_build_object('ok',false,'error','promo not eligible'); end if;
  end if;

  if v_promo.first_purchase_only then
    if v_customer_key is null then return jsonb_build_object('ok',false,'error','customer identification required'); end if;
    select
      (select count(*) from public.store_orders o join public.store_customers c on c.id=o.customer_id where upper(coalesce(o.status,'')) not in ('CANCELADA','CANCELADO','CANCELLED')
       and ((length(v_phone_key)>=9 and regexp_replace(coalesce(c.phone,''),'[^0-9]','','g') in (v_phone_key,right(v_phone_key,9))) or (v_email_key<>'' and lower(trim(coalesce(c.email,'')))=v_email_key)))
      +
      (select count(*) from public.artessencia_v1_orders o join public.artessencia_v1_clients c on c.id=o.client_id where (p_exclude_backoffice_order_id is null or o.id<>p_exclude_backoffice_order_id)
       and upper(coalesce(o.status,'')) not in ('CANCELADA','CANCELADO','CANCELLED')
       and ((length(v_phone_key)>=9 and regexp_replace(coalesce(c.phone,''),'[^0-9]','','g') in (v_phone_key,right(v_phone_key,9))) or (v_email_key<>'' and lower(trim(coalesce(c.email,'')))=v_email_key)))
    into v_prior_orders;
    if v_prior_orders>0 then return jsonb_build_object('ok',false,'error','promo not eligible'); end if;
  end if;

  if v_promo.discount_type='PERCENT' then v_discount:=round(coalesce(p_subtotal,0)*(v_promo.discount_value/100.0),2); if v_promo.max_discount is not null then v_discount:=least(v_discount,v_promo.max_discount); end if;
  else v_discount:=least(coalesce(p_subtotal,0),v_promo.discount_value); end if;
  return jsonb_build_object('ok',true,'promo_id',v_promo.id,'code',v_promo.code,'label',v_promo.label,'discount_type',v_promo.discount_type,'discount_value',v_promo.discount_value,'discount_total',v_discount,'min_order',v_promo.min_order,'first_purchase_only',v_promo.first_purchase_only);
end $$;
revoke execute on function public.artessencia_validate_promo_code_internal_v1(text,numeric,text,text,uuid) from public,anon,authenticated;

create or replace function public.store_validate_promo_code_v1(p_code text,p_subtotal numeric,p_phone text default null,p_email text default null)
returns jsonb language sql stable security definer set search_path='public'
as $$
  select public.artessencia_validate_promo_code_internal_v1(p_code,p_subtotal,p_phone,p_email,null);
$$;
revoke execute on function public.store_validate_promo_code_v1(text,numeric,text,text) from public;
grant execute on function public.store_validate_promo_code_v1(text,numeric,text,text) to anon,authenticated;

create or replace function public.artessencia_list_promo_codes_admin_v1()
returns jsonb
language plpgsql stable security definer set search_path='public'
as $$
begin
  if not public.artessencia_is_owner_v1() then raise exception 'not authorized'; end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',p.id,'code',p.code,'label',p.label,'discount_type',p.discount_type,'discount_value',p.discount_value,
      'max_discount',p.max_discount,'min_order',p.min_order,'first_purchase_only',p.first_purchase_only,
      'usage_limit',p.usage_limit,'per_customer_limit',p.per_customer_limit,'starts_at',p.starts_at,'ends_at',p.ends_at,
      'active',p.active,'created_at',p.created_at,'updated_at',p.updated_at,'assigned_customer_key',p.assigned_customer_key,
      'usage_count',(
        select count(*) from public.artessencia_promo_redemptions r
        where r.promo_id=p.id and (
          (coalesce(r.channel,'ONLINE')='ONLINE' and exists(select 1 from public.store_orders o where o.id=r.order_id and upper(coalesce(o.status,'')) not in ('CANCELADA','CANCELADO','CANCELLED')))
          or (r.channel='DIRECT' and exists(select 1 from public.artessencia_v1_orders o where o.id=r.backoffice_order_id and upper(coalesce(o.status,'')) not in ('CANCELADA','CANCELADO','CANCELLED')))
        )
      ),
      'redemption_history_count',(select count(*) from public.artessencia_promo_redemptions r where r.promo_id=p.id),
      'last_channel',(select r.channel from public.artessencia_promo_redemptions r where r.promo_id=p.id order by r.created_at desc limit 1)
    ) order by p.created_at desc),'[]'::jsonb)
    from public.artessencia_promo_codes p where p.owner_id=auth.uid()
  );
end $$;

revoke execute on function public.artessencia_list_promo_codes_admin_v1() from public,anon;
grant execute on function public.artessencia_list_promo_codes_admin_v1() to authenticated;

create or replace function public.artessencia_redeem_promo_direct_v1(
  p_code text,p_backoffice_order_id uuid,p_subtotal numeric,p_phone text default null,p_email text default null
) returns jsonb
language plpgsql security definer set search_path='public'
as $$
declare v_order public.artessencia_v1_orders%rowtype; v_promo jsonb; v_promo_id uuid; v_discount numeric; v_code text; v_phone text; v_email text; v_customer_key text;
begin
  if not public.artessencia_is_owner_v1() then raise exception 'not authorized'; end if;
  select * into v_order from public.artessencia_v1_orders where id=p_backoffice_order_id and user_id=auth.uid() for update;
  if not found then raise exception 'order not found'; end if;

  v_code:=regexp_replace(upper(trim(coalesce(p_code,''))),'[^A-Z0-9_-]','','g');
  perform pg_advisory_xact_lock(hashtext('artessencia-promo-'||v_code));
  v_promo:=public.artessencia_validate_promo_code_internal_v1(v_code,p_subtotal,p_phone,p_email,p_backoffice_order_id);
  if not coalesce((v_promo->>'ok')::boolean,false) then raise exception '%',coalesce(v_promo->>'error','promo not eligible'); end if;
  v_promo_id:=(v_promo->>'promo_id')::uuid; v_discount:=coalesce((v_promo->>'discount_total')::numeric,0);

  v_phone:=regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');if length(v_phone)=9 then v_phone:='351'||v_phone; end if;
  v_email:=lower(trim(coalesce(p_email,'')));
  v_customer_key:=case when length(v_phone)>=9 then 'p:'||v_phone when v_email<>'' then 'e:'||v_email else null end;

  insert into public.artessencia_promo_redemptions(promo_id,order_id,backoffice_order_id,customer_id,customer_key,discount_total,channel)
  values(v_promo_id,null,p_backoffice_order_id,null,v_customer_key,v_discount,'DIRECT')
  on conflict(promo_id,backoffice_order_id) where backoffice_order_id is not null do nothing;

  if not found then
    return jsonb_build_object('ok',true,'duplicate',true,'code',v_code,'discount_total',v_discount,'total',v_order.total);
  end if;

  update public.artessencia_v1_orders set
    subtotal=coalesce(p_subtotal,subtotal),
    total=greatest(0,round(coalesce(p_subtotal,subtotal)-v_discount,2)),
    data=coalesce(data,'{}'::jsonb)||jsonb_build_object('promoCode',v_code,'discountTotal',v_discount,'total',greatest(0,round(coalesce(p_subtotal,subtotal)-v_discount,2))),
    updated_at=now()
  where id=p_backoffice_order_id returning * into v_order;

  return jsonb_build_object('ok',true,'duplicate',false,'code',v_code,'discount_total',v_discount,'total',v_order.total);
end $$;

revoke execute on function public.artessencia_redeem_promo_direct_v1(text,uuid,numeric,text,text) from public,anon;
grant execute on function public.artessencia_redeem_promo_direct_v1(text,uuid,numeric,text,text) to authenticated;

create or replace function public.artessencia_catalog_launch_stats_admin_v1()
returns jsonb
language plpgsql stable security definer set search_path='public'
as $$
declare v_owner uuid:=auth.uid();
begin
  if not public.artessencia_is_owner_v1() then raise exception 'not authorized'; end if;
  return jsonb_build_object(
    'started',(select count(*) from public.artessencia_catalog_launch_challenges where owner_id=v_owner),
    'completed',(select count(*) from public.artessencia_catalog_launch_challenges where owner_id=v_owner and completed_at is not null),
    'claimed',(select count(*) from public.artessencia_catalog_launch_challenges where owner_id=v_owner and claimed_at is not null),
    'used',(select count(*) from public.artessencia_catalog_launch_challenges c where c.owner_id=v_owner and exists(select 1 from public.artessencia_promo_redemptions r where r.promo_id=c.promo_id)),
    'required_favorites',coalesce((select required_favorites from public.artessencia_catalog_launch_config where owner_id=v_owner),3),
    'participants',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',c.id,'phone',c.customer_phone,'installed',c.installed,'shared',c.shared,'favorites_count',c.favorites_count,'notifications',c.notifications,
        'completed_at',c.completed_at,'claimed_at',c.claimed_at,'code',p.code,'promo_active',p.active,'promo_ends_at',p.ends_at,
        'used_at',r.created_at,'channel',r.channel,'discount_total',r.discount_total
      ) order by c.completed_at desc)
      from public.artessencia_catalog_launch_challenges c
      left join public.artessencia_promo_codes p on p.id=c.promo_id
      left join lateral (
        select rr.* from public.artessencia_promo_redemptions rr where rr.promo_id=c.promo_id order by rr.created_at desc limit 1
      ) r on true
      where c.owner_id=v_owner and c.completed_at is not null
    ),'[]'::jsonb)
  );
end $$;

revoke execute on function public.artessencia_catalog_launch_stats_admin_v1() from public,anon;
grant execute on function public.artessencia_catalog_launch_stats_admin_v1() to authenticated;
