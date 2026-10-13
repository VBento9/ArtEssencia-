-- ARTESSENCIA — RASCUNHO ISOLADO, NÃO EXECUTAR EM PRODUÇÃO
-- Escritor de modo de loja/catálogo. Mantém assinatura e autorização V1,
-- preserva chaves desconhecidas de store_settings, serializa na mesma linha.
-- Não resolve sozinho conflitos de clientes desatualizados.

CREATE OR REPLACE FUNCTION public.artessencia_save_public_channel_status_admin_v1(
  p_channel text, p_mode text, p_message text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_key text;
  v_mode text := lower(trim(coalesce(p_mode,'')));
  v_current jsonb;
  v_next jsonb;
  v_enabled boolean;
  v_accepting boolean;
  v_delivery jsonb;
BEGIN
  IF NOT public.artessencia_is_owner_v1() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  v_key := CASE lower(trim(coalesce(p_channel,'')))
    WHEN 'store' THEN 'store_status'
    WHEN 'catalog' THEN 'catalog_status'
    ELSE NULL END;
  IF v_key IS NULL THEN RAISE EXCEPTION 'invalid channel'; END IF;
  IF v_mode NOT IN ('open','updating','closed') THEN
    RAISE EXCEPTION 'invalid mode';
  END IF;
  IF p_message IS NULL THEN p_message := ''; END IF;

  -- Evitar reabertura sem modalidade de entrega/levantamento válida.
  -- A versão real atual não possui esta validação; confirmar compatibilidade.
  IF v_key='store_status' AND v_mode='open' THEN
    SELECT coalesce(data->'delivery','{}'::jsonb) INTO v_delivery
    FROM public.artessencia_shop_settings
    WHERE user_id=auth.uid();
    IF NOT (coalesce((v_delivery->>'pickupEnabled')::boolean,false)
         OR coalesce((v_delivery->>'localDeliveryEnabled')::boolean,false)) THEN
      RAISE EXCEPTION 'configure at least one fulfillment method before accepting orders';
    END IF;
  END IF;

  SELECT value INTO v_current FROM public.store_settings
  WHERE key=v_key FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'channel status missing; initialize separately';
  END IF;
  IF jsonb_typeof(v_current) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'invalid existing channel status';
  END IF;

  v_enabled := CASE WHEN v_key='store_status'
    THEN v_mode='open' ELSE true END;
  v_accepting := (v_mode='open');
  v_next := v_current || jsonb_build_object(
    'enabled',v_enabled,
    'mode',v_mode,
    'public_message',p_message
  );
  IF v_key='store_status' THEN
    v_next := v_next || jsonb_build_object('accepting_orders',v_accepting);
  END IF;
  UPDATE public.store_settings
  SET value=v_next, updated_at=now() WHERE key=v_key;
  RETURN v_next;
END;
$function$;

-- REVER ANTES DE USAR:
-- * SECURITY DEFINER existente preservado; confirmar privilégios EXECUTE.
-- * As duas RPC continuam sem CAS/revisão exposta ao cliente.
-- * Falha segura para linhas em falta em vez de criar chaves silenciosamente.
-- * Validação de modalidade ao abrir poderá alterar o fluxo atual; testar UI.
-- * Não ativar enquanto não forem identificados os chamadores do Backoffice.
