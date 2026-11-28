-- Owner-scoped technical alerts, recomputed from canonical records. No business writes or paid calls.
BEGIN;
CREATE OR REPLACE FUNCTION public.artessencia_intelligence_technical_alerts_v1()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $alerts$
DECLARE actor uuid:=auth.uid(); snap public.artessencia_v1_state%rowtype; c artessencia_intelligence_private.team_controls%rowtype; result jsonb;
BEGIN
 IF actor IS NULL OR public.artessencia_is_owner_v1() IS DISTINCT FROM true THEN RAISE EXCEPTION USING errcode='42501',message='OWNER_REQUIRED'; END IF;
 SELECT * INTO c FROM artessencia_intelligence_private.team_controls WHERE user_id=actor;
 IF NOT FOUND OR NOT c.enabled OR coalesce(c.modes->>'director','off')='off' OR coalesce(c.modes->>'producao','off')='off' THEN RETURN jsonb_build_object('status','disabled','alerts','[]'::jsonb); END IF;
 SELECT * INTO snap FROM public.artessencia_v1_state WHERE user_id=actor;
 IF NOT FOUND OR jsonb_typeof(snap.data->'productRecipes') IS DISTINCT FROM 'object' THEN RETURN jsonb_build_object('status','source_unavailable','alerts','[]'::jsonb); END IF;
 WITH products AS (
  SELECT p.data->>'code' code,left(coalesce(p.data->>'name',''),160) name,p.updated_at,
   p.data->>'category' category,p.data->>'productionType' production_type,
   concat_ws(' ',p.data->>'name',p.data->>'publicCharacteristics',p.data->>'ingredientsText',p.data->>'materialsText',p.data->>'shopDescription') hints,
   CASE WHEN jsonb_typeof(snap.data->'productRecipes'->(p.data->>'code'))='array' THEN snap.data->'productRecipes'->(p.data->>'code') ELSE '[]'::jsonb END recipe
  FROM public.artessencia_v1_products p
  WHERE p.user_id=actor AND p.data->>'archivedV1803' IS DISTINCT FROM 'true'
   AND p.data->>'manufactured' IS DISTINCT FROM 'false' AND length(p.data->>'code') BETWEEN 1 AND 100
   AND (p.data->>'category' IN ('Velas em molde','Velas em recipiente','Wax melts') OR p.data->>'productionType' IN ('wax_mold','wax_container','wax_melt'))
 ), checks AS (
  SELECT p.*,jsonb_array_length(recipe)=0 empty_recipe,
   hints ~* '(sem[[:space:]]+(fragr[âa]ncia|aroma|perfume|cheiro)|n[aã]o[[:space:]]+(aromatizad|perfumad)|unscented)' explicit_unscented,
   (category='Wax melts' OR production_type='wax_melt' OR hints~*'(arom[aá]tic|aromatizad|fragr[âa]ncia|perfumad|scented)') explicit_scent,
   EXISTS(SELECT 1 FROM jsonb_array_elements(recipe) x WHERE x->>'item'~*'(fragr[âa]ncia|ess[êe]ncia|aroma|perfume)' AND
      CASE WHEN length(x->>'qty') BETWEEN 1 AND 30 AND x->>'qty'~'^[0-9]+([.][0-9]+)?$' THEN (x->>'qty')::numeric>0 ELSE false END) has_fragrance,
   EXISTS(SELECT 1 FROM jsonb_array_elements(recipe) x WHERE x->>'item'~*'(fragr[âa]ncia|ess[êe]ncia|aroma|perfume)' AND NOT
      CASE WHEN length(x->>'qty') BETWEEN 1 AND 30 AND x->>'qty'~'^[0-9]+([.][0-9]+)?$' THEN (x->>'qty')::numeric>0 ELSE false END) invalid_fragrance
  FROM products p
 ), findings AS (
  SELECT code,name,category,updated_at,
   CASE WHEN empty_recipe THEN 'missing_recipe'
    WHEN invalid_fragrance AND NOT has_fragrance THEN 'invalid_fragrance_quantity'
    WHEN NOT has_fragrance AND NOT explicit_unscented AND explicit_scent THEN 'probable_missing_fragrance'
    WHEN NOT has_fragrance AND NOT explicit_unscented THEN 'confirm_unscented_intent'
   END kind
  FROM checks
 ), relevant AS (
  SELECT *,CASE kind WHEN 'missing_recipe' THEN 1 WHEN 'invalid_fragrance_quantity' THEN 1 WHEN 'probable_missing_fragrance' THEN 1 ELSE 2 END priority
  FROM findings WHERE kind IS NOT NULL
 ), limited AS (
  SELECT * FROM relevant ORDER BY priority,updated_at DESC NULLS LAST,code LIMIT 100
 )
 SELECT jsonb_build_object('status','ready','sourceRevision',snap.revision,'capturedAt',clock_timestamp(),'checked',(SELECT count(*) FROM products),'total',(SELECT count(*) FROM relevant),
  'counts',(SELECT coalesce(jsonb_object_agg(kind,n),'{}'::jsonb) FROM (SELECT kind,count(*) n FROM relevant GROUP BY kind) q),
  'alerts',(SELECT coalesce(jsonb_agg(jsonb_build_object('code',code,'name',name,'category',category,'kind',kind,'priority',priority,'agent','producao','coordinator','director','requiresApproval',true) ORDER BY priority,updated_at DESC NULLS LAST,code),'[]'::jsonb) FROM limited),
  'coverage','Produtos ativos de velas e wax melts. A identificação de fragrância usa referências dos materiais e indícios textuais; não confirma a composição real. Sem quantidade válida, o sistema sinaliza revisão. Uma vela sem aroma pode ser intencional. Não altera fichas nem saldos; até 100 alertas por consulta.')
 INTO result;
 RETURN result;
END;
$alerts$;
REVOKE ALL ON FUNCTION public.artessencia_intelligence_technical_alerts_v1() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.artessencia_intelligence_technical_alerts_v1() TO authenticated;
COMMIT;
