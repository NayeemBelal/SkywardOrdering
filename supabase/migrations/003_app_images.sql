-- Add per-site image path for items
alter table public.app_site_items
add column if not exists image_path text;

-- Keep existing RLS; anon select already allowed on app_site_items


