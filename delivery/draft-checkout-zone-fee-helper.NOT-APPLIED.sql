-- ARTESSENCIA — RASCUNHO ISOLADO, NÃO INSTALAR EM PRODUÇÃO
-- Helper usado APENAS dentro do checkout, recebe configuração carregada pela própria RPC,
-- não expor EXECUTE ao público. Calcula tarifa pelo código postal inteiro, sem prefixos.
CREATE OR REPLACE FUNCTION public.artessencia_delivery_fee_from_zones_draft(
 p_postal_code text,p_delivery jsonb
) RETURNS bigint LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='public'
AS $body$
DECLARE
 v_config jsonb; v_zone jsonb; v_postal text; v_codes text[]:=ARRAY[]::text[];
 v_names text[]:=ARRAY[]::text[]; v_name text; v_code jsonb; v_count int:=0;
 v_fee_text text; v_fee bigint; v_match int:=0; v_result bigint;
BEGIN
 v_postal:=btrim(coalesce(p_postal_code,''));
 IF v_postal !~ '^[0-9]{4}-[0-9]{3}$' THEN RAISE EXCEPTION 'invalid delivery postal code'; END IF;
 IF jsonb_typeof(p_delivery) IS DISTINCT FROM 'object' OR
 p_delivery->>'localDeliveryEnabled' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'delivery disabled'; END IF;
 v_config:=p_delivery->'deliveryZoneConfig';
 IF jsonb_typeof(v_config) IS DISTINCT FROM 'object' OR
 v_config->>'enabled' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'delivery zones disabled'; END IF;
 IF jsonb_typeof(v_config->'zones') IS DISTINCT FROM 'array'
 OR jsonb_array_length(v_config->'zones') > 100 THEN RAISE EXCEPTION 'invalid zones'; END IF;
 FOR v_zone IN SELECT value FROM jsonb_array_elements(v_config->'zones') LOOP
  IF jsonb_typeof(v_zone) IS DISTINCT FROM 'object' OR
  jsonb_typeof(v_zone->'name') IS DISTINCT FROM 'string' OR
  jsonb_typeof(v_zone->'enabled') IS DISTINCT FROM 'boolean' OR
  jsonb_typeof(v_zone->'postalCodes') IS DISTINCT FROM 'array' OR
  jsonb_typeof(v_zone->'feeCents') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'invalid zone'; END IF;
  v_name:=btrim(v_zone->>'name');
  IF v_name='' OR length(v_name)>100 OR lower(v_name)=ANY(v_names) THEN RAISE EXCEPTION 'invalid or repeated locality'; END IF;
  v_names:=array_append(v_names,lower(v_name));
  v_fee_text:=v_zone->>'feeCents';
  IF length(v_fee_text)>8 OR v_fee_text !~ '^[0-9]+$' THEN RAISE EXCEPTION 'invalid fee'; END IF;
  v_fee:=v_fee_text::bigint;
  IF v_fee>10000000 THEN RAISE EXCEPTION 'fee too high'; END IF;
  IF jsonb_array_length(v_zone->'postalCodes') NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'invalid zone postal count'; END IF;
  FOR v_code IN SELECT value FROM jsonb_array_elements(v_zone->'postalCodes') LOOP
    IF jsonb_typeof(v_code) IS DISTINCT FROM 'string' OR (v_code #>> '{}') !~ '^[0-9]{4}-[0-9]{3}$'
       OR (v_code #>> '{}')=ANY(v_codes) THEN RAISE EXCEPTION 'invalid or repeated postal code'; END IF;
    v_codes:=array_append(v_codes,v_code #>> '{}');v_count:=v_count+1;
    IF v_count>5000 THEN RAISE EXCEPTION 'too many postal codes'; END IF;
    IF v_zone->>'enabled'='true' AND v_code #>> '{}' = v_postal THEN
      v_match:=v_match+1;v_result:=v_fee;
    END IF;
  END LOOP;
 END LOOP;
 IF v_match<>1 THEN RAISE EXCEPTION 'delivery outside active area'; END IF;
 RETURN v_result;
END;
$body$;
-- Na função store_submit_order_v1, quando deliveryZoneConfig.enabled=true:
-- (1) normalizar o código postal completo, (2) validar domingo/segunda,
-- corte de quinta e 48h a partir de clock_timestamp() em Europe/Lisbon,
-- (3) validar capacidade e preço de produtos no servidor,
-- (4) APÓS calcular v_subtotal e ANTES de inserir cliente/encomenda:
--   v_fee := public.artessencia_delivery_fee_from_zones_draft(
--      substring(v_postal from 1 for 4)||'-'||substring(v_postal from 5 for 3), v_s
--   ) / 100.0;
-- Guardar v_fee e desconto na mesma transação. NÃO confiar nos preços do cliente.
-- NOTA: o checkout existente usa prefixos/localDeliveryFee; alterar só com branch,
-- testes locais completos e estratégia de publicação/rollback.
-- Bloqueia invocação da API pública (RPC interna v1 executa como proprietário).\nREVOKE ALL ON FUNCTION public.artessencia_delivery_fee_from_zones_draft(text,jsonb) FROM PUBLIC, anon, authenticated;\n-- Antes de qualquer instalação rever o owner, a execução de v1 e a política de permissões.
