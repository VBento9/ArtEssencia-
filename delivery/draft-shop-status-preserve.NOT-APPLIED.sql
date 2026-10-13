-- ARTESSENCIA: RASCUNHO DE COMPATIBILIDADE, NÃO EXECUTAR NA PRODUÇÃO
-- Substituição futura da RPC V1; exige revisão dos chamadores e testes locais.
-- A função pública de estados continua a ser o único editor de mode/public_message.
-- Mantém auth/owner e as validações essenciais originais.

CREATE OR REPLACE FUNCTION public.artessencia_save_shop_status_v1(p_status jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_enabled boolean;
  v_accepting boolean;
  v_delivery jsonb;
  v_current jsonb;
  v_next jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF NOT public.artessencia_is_owner_v1() THEN RAISE EXCEPTION 'store owner required'; END IF;
  IF jsonb_typeof(p_status) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid status'; END IF;
  IF (p_status - 'enabled' - 'accepting_orders') <> '{}'::jsonb THEN
    RAISE EXCEPTION 'unexpected status fields';
  END IF;

  v_enabled := coalesce((p_status->>'enabled')::boolean,false);
  v_accepting := coalesce((p_status->>'accepting_orders')::boolean,false);
  IF v_accepting AND NOT v_enabled THEN RAISE EXCEPTION 'store must be enabled before accepting orders'; END IF;
  IF v_accepting THEN
    SELECT coalesce(data->'delivery','{}'::jsonb) INTO v_delivery
    FROM public.artessencia_shop_settings WHERE user_id=v_uid;
    IF NOT coalesce((v_delivery->>'pickupEnabled')::boolean,false)
       AND NOT coalesce((v_delivery->>'localDeliveryEnabled')::boolean,false) THEN
      RAISE EXCEPTION 'configure at least one fulfillment method before accepting orders';
    END IF;
  END IF;

  -- Serializa com outros UPDATE da mesma linha. O escritor de modos também
  -- precisa de adotar merge; este rascunho sozinho não resolve todos os conflitos.
  SELECT value INTO v_current FROM public.store_settings
  WHERE key='store_status' FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'store status missing; initialize separately';
  END IF;
  IF jsonb_typeof(v_current) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'invalid existing store status';
  END IF;

  -- Um salvamento legado nunca pode reabrir Loja fechada ou em atualização.
  IF coalesce(v_current->>'mode','') IN ('closed','updating')
     AND (v_enabled OR v_accepting) THEN
    RAISE EXCEPTION 'public channel mode blocks enabling or accepting orders';
  END IF;

  v_next := v_current || jsonb_build_object(
    'enabled', v_enabled,
    'accepting_orders', v_accepting
  );
  UPDATE public.store_settings
    SET value=v_next, updated_at=now()
    WHERE key='store_status';
  RETURN v_next;
END;
$function$;

-- ATENÇÃO:
-- 1) Nao aplicar sem avaliar chamadas legadas que antes passavam outros campos.
-- 2) O editor de modos ('save_public_channel_status_admin_v1') ainda substitui JSON;
--    necessita de migração e teste separados.
-- 3) Em 'updating' ou 'closed' bloqueia enabled=true e accepting_orders=true;
--    transições de modo cabem exclusivamente ao editor de estados.
-- 4) O escritor de mode pode disputar alteração com este escritor; FOR UPDATE
--    sincroniza as linhas existentes, mas não dá controlo de revisão ao chamador.
