-- ArtEssencia — índice de suporte à FK de favoritos do desafio de lançamento
create index if not exists artessencia_catalog_launch_favorites_product_idx
  on public.artessencia_catalog_launch_favorites(product_id);
