-- Add category to items and backfill based on descriptive text
-- Categories: consumables, supply, equipment

alter table public.app_items
  add column if not exists category text;

-- Optional: constrain values
do $$ begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'app_items_category_check'
  ) then
    alter table public.app_items
      add constraint app_items_category_check
      check (category is null or category in ('consumables','supply','equipment'));
  end if;
exception when others then null; end $$;

-- Backfill using heuristics on descriptive text
with src as (
  select id,
         coalesce(nullif(trim(sku), ''), nullif(trim(name), ''), '') as desc
  from public.app_items
)
update public.app_items i
set category = (
  case
    -- Equipment keywords
    when s.desc ~* '(vacuum|machine|auto[\s-]?scrubber|burnisher|buffer|extractor|carpet|polisher|propane|battery|dispenser|bucket|cart|handle|frame)' then 'equipment'
    -- Consumables keywords
    when s.desc ~* '(towel|tissue|toilet|bath|liner|bag|soap|sanitiz|wipes?|napkin|roll|pad|refill|chemical|degreaser|glass|cleaner|disinfect|urinal|odor|fragrance|can liner|trash bag)' then 'consumables'
    -- Supplies (tools and general)
    when s.desc ~* '(mop|broom|brush|duster|dustpan|squeegee|spray|bottle|caddy|holder|sign|cone|glove|goggles|scraper|sponge|mitt)' then 'supply'
    else 'supply'
  end
)
from src s
where i.id = s.id
  and (i.category is null or i.category = '');

-- Index to help category queries
create index if not exists app_items_category_idx on public.app_items (category);


