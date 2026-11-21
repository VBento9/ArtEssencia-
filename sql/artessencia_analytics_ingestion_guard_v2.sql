-- ARTESSENCIA: analitica publica, protecao por volume v2
-- NAO APLICAR AUTOMATICAMENTE NA BASE REAL. Validar em clone primeiro.
-- O limite global nao impede falsificacao de eventos abaixo dos limites.
create index if not exists artessencia_analytics_events_source_visitor_created_idx
on public.artessencia_analytics_events (source,visitor_id,created_at desc);

CREATE OR REPLACE FUNCTION public.artessencia_analytics_track_v1(p_source text, p_event_type text, p_visitor_id uuid, p_session_id uuid, p_product_id text DEFAULT NULL::text, p_product_name text DEFAULT NULL::text, p_campaign_id text DEFAULT NULL::text, p_path text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if p_source not in ('shop','catalog') then
    raise exception 'invalid analytics source';
  end if;

  if p_event_type not in (
    'session_start','product_view','campaign_click','add_to_cart',
    'checkout_started','order_submitted','contact_click','share_click',
    'favorite_add','favorite_remove','active_time','family_click','filter_change','search','sort_change','favorites_filter','quote_request_submitted'
  ) then
    raise exception 'invalid analytics event';
  end if;

  if p_visitor_id is null or p_session_id is null then
    raise exception 'invalid analytics identity';
  end if;

  -- Limites por origem protegem mesmo se visitor_id/session_id forem alterados.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('ae-analytics-ingestion:' || p_source, 0)
  );

  if (
    select count(*) from (
      select 1 from public.artessencia_analytics_events
      where source = p_source and visitor_id = p_visitor_id
        and created_at >= pg_catalog.clock_timestamp() - interval '1 hour'
      limit 181
    ) visitor_window
  ) >= 180 then
    return;
  end if;

  if (
    select count(*) from (
      select 1 from public.artessencia_analytics_events
      where source = p_source
        and created_at >= pg_catalog.clock_timestamp() - interval '1 minute'
      limit 121
    ) minute_window
  ) >= 120 then
    return;
  end if;

  if (
    select count(*) from (
      select 1 from public.artessencia_analytics_events
      where source = p_source
        and created_at >= pg_catalog.clock_timestamp() - interval '24 hours'
      limit 6001
    ) day_window
  ) >= 6000 then
    return;
  end if;

  if (
    select count(*)
    from public.artessencia_analytics_events
    where session_id = p_session_id
      and created_at > now() - interval '1 hour'
  ) >= 250 then
    return;
  end if;

  insert into public.artessencia_analytics_events (
    source,event_type,visitor_id,session_id,
    product_id,product_name,campaign_id,path,metadata
  ) values (
    p_source,
    p_event_type,
    p_visitor_id,
    p_session_id,
    left(nullif(p_product_id,''),120),
    left(nullif(p_product_name,''),180),
    left(nullif(p_campaign_id,''),120),
    left(nullif(p_path,''),300),
    case
      when p_metadata is null then '{}'::jsonb
      when octet_length(p_metadata::text) <= 3000 then p_metadata
      else '{}'::jsonb
    end
  );
end;
$function$;
revoke execute on function public.artessencia_analytics_track_v1(text,text,uuid,uuid,text,text,text,text,jsonb) from public, authenticated;
grant execute on function public.artessencia_analytics_track_v1(text,text,uuid,uuid,text,text,text,text,jsonb) to anon;
