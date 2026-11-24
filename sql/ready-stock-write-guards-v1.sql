-- Keep legacy relational sync and operational snapshot writes from changing
-- tracked sale/stock history outside the transaction that also records payment.
CREATE OR REPLACE FUNCTION public.artessencia_ready_order_guard_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
  snapshot jsonb;
  writer text := coalesce(current_setting('artessencia.ready_writer',true),'');
BEGIN
  IF writer='sale' THEN RETURN NEW; END IF;
  -- PostgreSQL runs BEFORE INSERT even for the update arm of a relational upsert.
  -- Its BEFORE UPDATE trigger still verifies all persisted fields.
  IF TG_OP='INSERT' AND EXISTS (SELECT 1 FROM public.artessencia_v1_orders o
    WHERE o.user_id=NEW.user_id AND o.id=NEW.id AND o.data=NEW.data AND o.status=NEW.status)
    THEN RETURN NEW; END IF;
  IF TG_OP<>'INSERT' AND OLD.data->>'source'='direct_sale'
    AND (OLD.data->>'readySaleVersion'='1' OR EXISTS (SELECT 1 FROM jsonb_array_elements(OLD.data->'items') i WHERE i->'readyStockTracked'='true'::jsonb)) THEN
    IF TG_OP='UPDATE' AND (to_jsonb(OLD)-'updated_at')=(to_jsonb(NEW)-'updated_at') THEN RETURN NEW; END IF;
    RAISE EXCEPTION 'READY_SALE_REQUIRES_CLOUD_TRANSACTION';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  IF NEW.data->>'source' IS DISTINCT FROM 'direct_sale' THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND OLD.data=NEW.data AND OLD.status=NEW.status THEN RETURN NEW; END IF;
  SELECT data INTO snapshot FROM public.artessencia_v1_state WHERE user_id=NEW.user_id FOR UPDATE;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(NEW.data->'items') i
    WHERE i->'readyStockTracked'='true'::jsonb OR public.artessencia_ready_balance_v1(snapshot,i->>'code') IS NOT NULL
  ) THEN RAISE EXCEPTION 'READY_SALE_REQUIRES_CLOUD_TRANSACTION'; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.artessencia_ready_state_guard_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
  old_data jsonb := CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE OLD.data END;
  new_data jsonb := CASE WHEN TG_OP='DELETE' THEN '{}'::jsonb ELSE NEW.data END;
  writer text := coalesce(current_setting('artessencia.ready_writer',true),'');
BEGIN
  IF writer<>'stock' AND old_data->'productionRuns' IS DISTINCT FROM new_data->'productionRuns' AND
    jsonb_path_query_array(old_data,'$.productionRuns[*] ? (@.kind == "ready_stock")')
    IS DISTINCT FROM jsonb_path_query_array(new_data,'$.productionRuns[*] ? (@.kind == "ready_stock")')
    THEN RAISE EXCEPTION 'READY_HISTORY_PROTECTED'; END IF;
  IF writer<>'sale' AND old_data->'cash' IS DISTINCT FROM new_data->'cash' AND EXISTS (
    SELECT 1 FROM public.artessencia_v1_orders o
    CROSS JOIN LATERAL jsonb_array_elements(o.data->'paymentHistory') p
    WHERE o.user_id=coalesce(NEW.user_id,OLD.user_id) AND o.data->>'source'='direct_sale'
      AND (o.data->>'readySaleVersion'='1' OR jsonb_path_exists(o.data,'$.items[*] ? (@.readyStockTracked == true)'))
      AND (SELECT jsonb_agg(m) FROM jsonb_array_elements(old_data->'cash') m WHERE m->>'paymentId'=p->>'id')
       IS DISTINCT FROM (SELECT jsonb_agg(m) FROM jsonb_array_elements(new_data->'cash') m WHERE m->>'paymentId'=p->>'id')
  ) THEN RAISE EXCEPTION 'READY_CASH_HISTORY_PROTECTED'; END IF;
  -- Old versions can upload the operational snapshot before syncing the order.
  -- During shared-stock operation an unmatched POS payment must stay pending.
  IF writer<>'sale' AND old_data->'cash' IS DISTINCT FROM new_data->'cash'
    AND jsonb_path_exists(new_data,'$.productionRuns[*] ? (@.kind == "ready_stock")')
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(new_data->'cash') m
      WHERE m->>'orderId' LIKE 'VD-%' AND m->>'source' IN ('order_payment','order_payment_correction')
      AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(old_data->'cash') prior WHERE prior=m)
      AND NOT EXISTS (SELECT 1 FROM public.artessencia_v1_orders o
        CROSS JOIN LATERAL jsonb_array_elements(o.data->'paymentHistory') payment
        WHERE o.user_id=NEW.user_id AND o.data->>'id'=m->>'orderId' AND payment->>'id'=m->>'paymentId')
    ) THEN RAISE EXCEPTION 'READY_CASH_REQUIRES_CONFIRMED_SALE'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.artessencia_ready_order_guard_v1(), public.artessencia_ready_state_guard_v1() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS ready_order_guard_v1 ON public.artessencia_v1_orders;
CREATE TRIGGER ready_order_guard_v1 BEFORE INSERT OR UPDATE OR DELETE ON public.artessencia_v1_orders
FOR EACH ROW EXECUTE FUNCTION public.artessencia_ready_order_guard_v1();
DROP TRIGGER IF EXISTS ready_state_guard_v1 ON public.artessencia_v1_state;
CREATE TRIGGER ready_state_guard_v1 BEFORE INSERT OR UPDATE OR DELETE ON public.artessencia_v1_state
FOR EACH ROW EXECUTE FUNCTION public.artessencia_ready_state_guard_v1();
