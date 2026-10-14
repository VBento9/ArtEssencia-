-- ARTESSENCIA / ENTREGAS: APENAS RASCUNHO. NÃO EXECUTAR EM PRODUÇÃO.
-- Consulta de portes derivada de configuração do servidor, nunca de JSON do comprador.
-- Resultado informativo: checkout deve recomputar preço e elegibilidade na transação
-- de criação da encomenda (não confiar nesta cotação enviada pelo cliente).
CREATE OR REPLACE FUNCTION public.artessencia_quote_delivery_zone_v1(p_postal_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $body$
DECLARE
  v_delivery jsonb;
  v_cfg jsonb;
  v_zone jsonb;
  v_code jsonb;
  v_postal text;
  v_fee_text text;
  v_fee bigint;
  v_seen_codes text[] := ARRAY[]::text[];
  v_seen_names text[] := ARRAY[]::text[];
  v_count integer := 0;
  v_matches integer := 0;
  v_match_name text;
  v_match_fee bigint;
  v_name text;
BEGIN
  v_postal := btrim(coalesce(p_postal_code,''));
  IF v_postal !~ '^[0-9]{4}-[0-9]{3}$' THEN
    RETURN jsonb_build_object('available',false,'reason','invalid_postal_code');
  END IF;

  -- Função pública existente obtém definições do proprietário no servidor.
  v_delivery := public.store_delivery_settings_v1();
  IF jsonb_typeof(v_delivery) IS DISTINCT FROM 'object'
     OR v_delivery->>'localDeliveryEnabled' IS DISTINCT FROM 'true' THEN
    RETURN jsonb_build_object('available',false,'reason','delivery_disabled');
  END IF;
  v_cfg := v_delivery->'deliveryZoneConfig';
  IF jsonb_typeof(v_cfg) IS DISTINCT FROM 'object'
     OR v_cfg->>'enabled' IS DISTINCT FROM 'true' THEN
    RETURN jsonb_build_object('available',false,'reason','zones_not_enabled');
  END IF;
  IF jsonb_typeof(v_cfg->'zones') IS DISTINCT FROM 'array'
     OR jsonb_array_length(v_cfg->'zones') > 100 THEN
    RAISE EXCEPTION 'invalid server zone configuration';
  END IF;

  FOR v_zone IN SELECT value FROM jsonb_array_elements(v_cfg->'zones') LOOP
    IF jsonb_typeof(v_zone) IS DISTINCT FROM 'object'
       OR jsonb_typeof(v_zone->'name') IS DISTINCT FROM 'string'
       OR jsonb_typeof(v_zone->'enabled') IS DISTINCT FROM 'boolean'
       OR jsonb_typeof(v_zone->'postalCodes') IS DISTINCT FROM 'array'
       OR jsonb_typeof(v_zone->'feeCents') IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION 'invalid server zone';
    END IF;
    v_name := btrim(v_zone->>'name');
    IF v_name='' OR length(v_name)>100 OR lower(v_name)=ANY(v_seen_names) THEN
      RAISE EXCEPTION 'invalid or duplicate zone name';
    END IF;
    v_seen_names := array_append(v_seen_names,lower(v_name));
    v_fee_text := v_zone->>'feeCents';
    IF length(v_fee_text)>8 OR v_fee_text !~ '^[0-9]+$' THEN
      RAISE EXCEPTION 'invalid server delivery fee';
    END IF;
    v_fee := v_fee_text::bigint;
    IF v_fee > 10000000 THEN RAISE EXCEPTION 'delivery fee out of range'; END IF;
    IF jsonb_array_length(v_zone->'postalCodes') NOT BETWEEN 1 AND 1000 THEN
      RAISE EXCEPTION 'invalid number of postal codes';
    END IF;
    FOR v_code IN SELECT value FROM jsonb_array_elements(v_zone->'postalCodes') LOOP
      IF jsonb_typeof(v_code) IS DISTINCT FROM 'string'
         OR (v_code #>> '{}') !~ '^[0-9]{4}-[0-9]{3}$'
         OR (v_code #>> '{}')=ANY(v_seen_codes) THEN
        RAISE EXCEPTION 'invalid or duplicate postal code';
      END IF;
      v_seen_codes := array_append(v_seen_codes,v_code #>> '{}');
      v_count := v_count+1;
      IF v_count>5000 THEN RAISE EXCEPTION 'too many postal codes'; END IF;
      IF v_zone->>'enabled'='true' AND v_code #>> '{}' = v_postal THEN
        v_matches := v_matches+1;
        v_match_name := v_name;
        v_match_fee := v_fee;
      END IF;
    END LOOP;
  END LOOP;
  IF v_matches=0 THEN
    RETURN jsonb_build_object('available',false,'reason','outside_delivery_area');
  END IF;
  IF v_matches<>1 THEN RAISE EXCEPTION 'ambiguous delivery zone'; END IF;
  RETURN jsonb_build_object('available',true,'postalCode',v_postal,
                            'locality',v_match_name,'feeCents',v_match_fee);
END;
$body$;

-- NÃO APLICAR: rever SECURITY DEFINER, permissões EXECUTE, rate limiting,
-- store_delivery_settings_v1, integração no checkout e testes auth/anon antes da publicação.
-- A função mantém enabled=false por defeito; não ativa zonas nem cobrança.
