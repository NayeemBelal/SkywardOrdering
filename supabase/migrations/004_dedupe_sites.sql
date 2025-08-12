-- Deduplicate sites by case-insensitive name and enforce uniqueness going forward
-- 1) For each normalized name (lower(trim(name))), keep the smallest id as canonical
-- 2) Repoint foreign keys to canonical id
-- 3) Delete duplicates
-- 4) Add unique index on normalized name

do $$
declare
begin
  -- Create a temp mapping of canonical site per normalized name
  create temporary table tmp_site_canonical as
  with ranked as (
    select id,
           name,
           lower(trim(name)) as norm,
           row_number() over (partition by lower(trim(name)) order by id) as rn
    from public.app_sites
  )
  select norm, min(id) as canonical_id
  from ranked
  where rn = 1
  group by norm;

  -- Build mapping of duplicate site ids to canonical ids
  create temporary table tmp_site_dups as
  select s.id as dup_id, t.canonical_id
  from public.app_sites s
  join tmp_site_canonical t on t.norm = lower(trim(s.name))
  where s.id <> t.canonical_id;

  -- For site_employees: insert canonical rows, ignore duplicates, then delete dup rows
  insert into public.app_site_employees (site_id, employee_id)
  select d.canonical_id, se.employee_id
  from public.app_site_employees se
  join tmp_site_dups d on d.dup_id = se.site_id
  on conflict (site_id, employee_id) do nothing;

  delete from public.app_site_employees se
  using tmp_site_dups d
  where se.site_id = d.dup_id;

  -- For site_items: insert canonical rows, ignore duplicates, then delete dup rows
  insert into public.app_site_items (site_id, item_id, image_path)
  select d.canonical_id, si.item_id, si.image_path
  from public.app_site_items si
  join tmp_site_dups d on d.dup_id = si.site_id
  on conflict (site_id, item_id) do nothing;

  delete from public.app_site_items si
  using tmp_site_dups d
  where si.site_id = d.dup_id;

  -- Delete duplicate site rows (those that are not canonical)
  delete from public.app_sites s
  using tmp_site_dups d
  where s.id = d.dup_id;

  drop table if exists tmp_site_dups;
  drop table if exists tmp_site_canonical;
end $$;

-- Add unique index on normalized name to prevent future duplicates
create unique index if not exists app_sites_norm_unique on public.app_sites ((lower(trim(name))));


