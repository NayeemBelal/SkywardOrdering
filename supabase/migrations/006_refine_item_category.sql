-- Refine item category classification with broader heuristics
-- Categories: consumables, supply, equipment

with src as (
  select id,
         lower(coalesce(nullif(trim(name), ''), '')) as n,
         lower(coalesce(nullif(trim(sku), ''), '')) as k,
         lower(coalesce(nullif(trim(name), ''), '') || ' ' || coalesce(nullif(trim(sku), ''), '')) as all_text
  from public.app_items
)
update public.app_items i
set category = (
  case
    -- Equipment: durable machines and fixtures
    when s.all_text ~* '(vacuum|auto\s?-?scrubber|autoscrubber|machine|burnisher|buffer|extractor|polisher|propane|battery|ride\s?on|floor\s?machine|carpet\s?extractor|dispenser\b|bucket\b|cart\b|wringer|backpack)'
      then 'equipment'

    -- Consumables: paper, chemicals, liners, soaps, refills
    when s.all_text ~* '(towel|tissue|toilet|bath|liner|bag|can\s?liner|trash\s?bag|soap|sanitiz|wipe|wipes|napkin|roll\b|pad\b|refill|chemical|degreaser|glass\s?cleaner|cleaner|disinfect|urinal|screen|urinal\s?screen|odor|fragrance|air\s?fresh|tabs?\b|tablet|packet|sachet|filter)'
      then 'consumables'

    -- Supplies: tools and accessories
    when s.all_text ~* '(mop|broom|brush|duster|dust\s?pan|dustpan|squeegee|spray\s?bottle|bottle\b|caddy|holder|sign|wet\s?floor|cone\b|gloves?|goggles?|mask\b|scraper|sponges?|mitt|microfiber|cloth|rag|handle\b|frame\b|pad\s?holder|bucket\b|cart\b|wringer)'
      then 'supply'

    else coalesce(i.category, 'supply')
  end
)
from src s
where i.id = s.id;

create index if not exists app_items_category_idx on public.app_items (category);

