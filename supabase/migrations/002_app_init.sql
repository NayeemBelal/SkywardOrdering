-- app-specific schema for sites, employees, items, and join tables
-- All tables live in public schema

-- Drop existing app tables if re-running migration locally (idempotent-ish in dev)
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='app_site_items') then
    drop table public.app_site_items cascade;
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='app_site_employees') then
    drop table public.app_site_employees cascade;
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='app_items') then
    drop table public.app_items cascade;
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='app_employees') then
    drop table public.app_employees cascade;
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='app_sites') then
    drop table public.app_sites cascade;
  end if;
exception when others then null; end $$;

create table public.app_sites (
  id bigserial primary key,
  name text not null
);

create table public.app_employees (
  id bigserial primary key,
  full_name text not null
);

create table public.app_items (
  id bigserial primary key,
  name text not null,
  sku text not null,
  constraint app_items_sku_unique unique (sku)
);

create table public.app_site_employees (
  site_id bigint not null references public.app_sites(id) on delete cascade,
  employee_id bigint not null references public.app_employees(id) on delete cascade,
  primary key (site_id, employee_id)
);

create table public.app_site_items (
  site_id bigint not null references public.app_sites(id) on delete cascade,
  item_id bigint not null references public.app_items(id) on delete cascade,
  primary key (site_id, item_id)
);

-- Enable Row Level Security
alter table public.app_sites enable row level security;
alter table public.app_employees enable row level security;
alter table public.app_items enable row level security;
alter table public.app_site_employees enable row level security;
alter table public.app_site_items enable row level security;

-- Policies: allow anonymous read for app tables
create policy app_sites_anon_select on public.app_sites for select using (true);
create policy app_employees_anon_select on public.app_employees for select using (true);
create policy app_items_anon_select on public.app_items for select using (true);
create policy app_site_employees_anon_select on public.app_site_employees for select using (true);
create policy app_site_items_anon_select on public.app_site_items for select using (true);

-- Policies: authenticated can do everything (for admin usage)
create policy app_sites_auth_all on public.app_sites for all using (auth.role() = 'authenticated');
create policy app_employees_auth_all on public.app_employees for all using (auth.role() = 'authenticated');
create policy app_items_auth_all on public.app_items for all using (auth.role() = 'authenticated');
create policy app_site_employees_auth_all on public.app_site_employees for all using (auth.role() = 'authenticated');
create policy app_site_items_auth_all on public.app_site_items for all using (auth.role() = 'authenticated');


