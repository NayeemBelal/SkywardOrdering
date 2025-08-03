-- Schema for Cleaning Supply Requester
create table sites (
  id serial primary key,
  name text not null
);

create table employees (
  id serial primary key,
  full_name text not null
);

create table items (
  id serial primary key,
  name_es text not null,
  name_en text not null,
  sku text,
  image_url text
);

create table site_employees (
  site_id int references sites(id),
  employee_id int references employees(id),
  primary key (site_id, employee_id)
);

create table site_items (
  site_id int references sites(id),
  item_id int references items(id),
  primary key (site_id, item_id)
);

create table requests (
  id uuid primary key default gen_random_uuid(),
  site_id int references sites(id),
  employee_id int references employees(id),
  submitted_at timestamptz default now(),
  xlsx_path text
);

create table request_items (
  request_id uuid references requests(id) on delete cascade,
  item_id int references items(id),
  on_hand int,
  order_qty int,
  primary key (request_id, item_id)
);

-- RLS policies
alter table sites enable row level security;
alter table employees enable row level security;
alter table items enable row level security;
alter table site_employees enable row level security;
alter table site_items enable row level security;
alter table requests enable row level security;
alter table request_items enable row level security;

create policy "anon can read sites" on sites for select using (true);
create policy "anon read site_employees" on site_employees for select using (true);
create policy "anon read site_items" on site_items for select using (true);

create policy "anon insert requests" on requests for insert with check (true);
create policy "anon insert request_items" on request_items for insert with check (true);

create policy "admin full" on sites for all using (auth.role() = 'authenticated');
create policy "admin full employees" on employees for all using (auth.role() = 'authenticated');
create policy "admin full items" on items for all using (auth.role() = 'authenticated');
create policy "admin full se" on site_employees for all using (auth.role() = 'authenticated');
create policy "admin full si" on site_items for all using (auth.role() = 'authenticated');
create policy "admin full req" on requests for all using (auth.role() = 'authenticated');
create policy "admin full req_items" on request_items for all using (auth.role() = 'authenticated');
