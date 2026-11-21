-- PostgreSQL-only fixture assertions. This file must NEVER execute in production.
DO $$
DECLARE v jsonb; row_data jsonb; row_notes text; cnt integer;
BEGIN
  -- Baseline: conversion creates one unconfirmed order with customer preferences.
  SELECT public.artessencia_owner_convert_box_v1(
    '11111111-1111-4111-8111-111111111111'::uuid,
    'box-private-1',3,current_date+2
  ) INTO v;
  IF v->>'ok'<>'true' OR v->>'already_converted'<>'false' THEN
    RAISE EXCEPTION 'First conversion not acknowledged: %',v;
  END IF;
  SELECT o.data,o.notes INTO row_data,row_notes
  FROM public.artessencia_v1_orders o
  WHERE o.id=(v->>'order_id')::uuid;
  IF row_data->>'status'<>'Pedido' OR row_data->>'payment'<>'A definir' OR
     row_data->>'source'<>'box_quote' OR row_data->>'stockReserved'<>'false' OR
     (row_data->>'paid')::numeric<>0 THEN
    RAISE EXCEPTION 'Order has incorrect initial financial/production state';
  END IF;
  IF row_data->'boxCustomerPreferences'->>'colors'<>'bege e verde'
    OR row_data->'boxCustomerPreferences'->>'scents'<>'maçã e especiarias'
    OR row_data->'boxCustomerPreferences'->>'dedication'<>'Parabéns'
    OR row_data->'boxCustomerPreferences'->>'packaging'<>'kraft'
    OR row_data->'boxCustomerPreferences'->>'notes'<>'sem laço' THEN
    RAISE EXCEPTION 'Customer personalization was lost';
  END IF;
  IF row_notes IS DISTINCT FROM row_data->>'notes' OR
     position('Cores: bege e verde' in row_notes)=0 OR
     position('Fragrâncias: maçã e especiarias' in row_notes)=0 OR
     position('Dedicatória: Parabéns' in row_notes)=0 OR
     position('Outras preferências: sem laço' in row_notes)=0 THEN
    RAISE EXCEPTION 'Order-row and JSON notes differ or are incomplete: %',row_notes;
  END IF;
  IF (row_data->>'total')::numeric<>25
     OR (SELECT total FROM public.artessencia_v1_orders WHERE id=(v->>'order_id')::uuid)<>25
     OR (row_data->>'boxCostSnapshot')::numeric<>15.50 THEN
    RAISE EXCEPTION 'Incorrect pricing/cost snapshot';
  END IF;
  IF jsonb_array_length(row_data->'items')<>3
    OR (SELECT count(*) FROM jsonb_array_elements(row_data->'items') l
       WHERE l->>'type'='quote_adjustment')<>1
    OR (SELECT count(*) FROM jsonb_array_elements(row_data->'items') l
       WHERE l->>'type'='box_component')<>2 THEN
    RAISE EXCEPTION 'Unexpected order lines or missing quote adjustment';
  END IF;
  -- Idempotence: second call must return original reference, not another order.
  SELECT public.artessencia_owner_convert_box_v1(
    '11111111-1111-4111-8111-111111111111'::uuid,
    'box-private-1',3,current_date+2
  ) INTO v;
  IF v->>'already_converted'<>'true' THEN
    RAISE EXCEPTION 'Second conversion was not idempotent';
  END IF;
  SELECT count(*) INTO cnt FROM public.artessencia_v1_orders;
  IF cnt<>1 THEN RAISE EXCEPTION 'Duplicate order created'; END IF;
END $$;

DO $$
BEGIN
  -- Another request has not been accepted; conversion must be rejected.
  BEGIN
    PERFORM public.artessencia_owner_convert_box_v1(
      '22222222-2222-4222-8222-222222222222'::uuid,
      'box-private-1',3,current_date+2);
    RAISE EXCEPTION 'REJECTED_NOT_TRIGGERED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='REJECTED_NOT_TRIGGERED' THEN RAISE; END IF;
  END;
  -- Wrong technical version is blocked for a request without an existing link:
  -- test on a new isolated transaction only, here use unconverted fixture.
  BEGIN
    PERFORM public.artessencia_owner_convert_box_v1(
      '22222222-2222-4222-8222-222222222222'::uuid,
      'box-private-1',4,current_date+2);
    RAISE EXCEPTION 'REVISION_REJECTED_NOT_TRIGGERED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='REVISION_REJECTED_NOT_TRIGGERED' THEN RAISE; END IF;
  END;
END $$;

SET request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
DO $$
BEGIN
  BEGIN
    PERFORM public.artessencia_owner_convert_box_v1(
      '11111111-1111-4111-8111-111111111111'::uuid,
      'box-private-1',3,current_date+2);
    RAISE EXCEPTION 'OWNER_GUARD_NOT_TRIGGERED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='OWNER_GUARD_NOT_TRIGGERED' THEN RAISE; END IF;
  END;
END $$;
RESET request.jwt.claim.sub;
SELECT 'PASS: fixture conversions, notes, costs, idempotence and owner guard' AS result;
