-- ArtEssencia — reforço do desafio de lançamento: favoritos validados no servidor
-- Branch isolada. Não aplicar na base real antes de validação.

create table if not exists public.artessencia_catalog_launch_favorites(
  owner_id uuid not null,
  visitor_id uuid not null,
  product_id uuid not null references public.store_products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(owner_id,visitor_id,product_id)
);

alter table public.artessencia_catalog_launch_favorites enable row level security;
revoke all on public.artessencia_catalog_launch_favorites from anon,authenticated;

create index if not exists artessencia_catalog_launch_favorites_visitor_idx
  on public.artessencia_catalog_launch_favorites(owner_id,visitor_id);

create or replace function public.artessencia_catalog_launch_favorite_v1(
  p_visitor_id uuid,
  p_product_id uuid,
  p_favorite boolean default true
) returns jsonb
language plpgsql
security definer
set search_path='public'
as $$
declare
  v_owner uuid;
  v_cfg public.artessencia_catalog_launch_config%rowtype;
  v_ch public.artessencia_catalog_launch_challenges%rowtype;
  v_count integer:=0;
begin
  select user_id into v_owner
  from public.store_owner
  where active=true
  order by created_at
  limit 1;

  if v_owner is null or p_visitor_id is null or p_product_id is null then
    return jsonb_build_object('enabled',false);
  end if;

  select * into v_cfg
  from public.artessencia_catalog_launch_config
  where owner_id=v_owner;

  if not found or not v_cfg.enabled
     or (v_cfg.starts_at is not null and now()<v_cfg.starts_at)
     or (v_cfg.ends_at is not null and now()>v_cfg.ends_at) then
    return jsonb_build_object('enabled',false);
  end if;

  select * into v_ch
  from public.artessencia_catalog_launch_challenges
  where owner_id=v_owner and visitor_id=p_visitor_id
  for update;

  if not found then
    raise exception 'challenge not started';
  end if;

  if v_cfg.require_share and not v_ch.shared then
    raise exception 'share required';
  end if;

  if not exists(
    select 1
    from public.store_products p
    where p.id=p_product_id
      and coalesce(p.active,false)=true
      and coalesce(p.available,false)=true
  ) then
    raise exception 'invalid product';
  end if;

  if coalesce(p_favorite,true) then
    insert into public.artessencia_catalog_launch_favorites(owner_id,visitor_id,product_id)
    values(v_owner,p_visitor_id,p_product_id)
    on conflict(owner_id,visitor_id,product_id) do nothing;
  else
    delete from public.artessencia_catalog_launch_favorites
    where owner_id=v_owner
      and visitor_id=p_visitor_id
      and product_id=p_product_id;
  end if;

  select count(*)::integer into v_count
  from public.artessencia_catalog_launch_favorites
  where owner_id=v_owner and visitor_id=p_visitor_id;

  update public.artessencia_catalog_launch_challenges
  set favorites_count=v_count,
      updated_at=now()
  where id=v_ch.id
  returning * into v_ch;

  return jsonb_build_object(
    'enabled',true,
    'favorites_count',v_count,
    'required_favorites',v_cfg.required_favorites,
    'favorite',coalesce(p_favorite,true)
  );
end $$;

revoke execute on function public.artessencia_catalog_launch_favorite_v1(uuid,uuid,boolean)
  from public,authenticated;
grant execute on function public.artessencia_catalog_launch_favorite_v1(uuid,uuid,boolean)
  to anon;

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
 v_favorites_count integer:=0;
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

   select count(*)::integer into v_favorites_count
   from public.artessencia_catalog_launch_favorites
   where owner_id=v_owner and visitor_id=p_visitor_id;

   update public.artessencia_catalog_launch_challenges
   set favorites_count=v_favorites_count,updated_at=now()
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

revoke execute on function public.artessencia_catalog_launch_progress_v1(uuid,text,integer)
  from public,authenticated;
grant execute on function public.artessencia_catalog_launch_progress_v1(uuid,text,integer)
  to anon;
