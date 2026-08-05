-- 1. Create Products Table
create table if not exists public.products (
  id text primary key,
  name text not null,
  url text not null,
  selector text default '',
  target_price numeric default 0,
  active boolean default true,
  added_at timestamptz default now()
);

-- 2. Create Price History Table
create table if not exists public.price_history (
  id bigint generated always as identity primary key,
  product_id text references public.products(id) on delete cascade,
  price numeric,
  currency text default '€',
  status text default 'success',
  error text,
  timestamp timestamptz default now()
);

-- 3. Enable Row Level Security (RLS)
alter table public.products enable row level security;
alter table public.price_history enable row level security;

-- 4. Create Public Access Policies for Frontend (Select, Insert, Update, Delete)
drop policy if exists "Allow public read access on products" on public.products;
create policy "Allow public read access on products"
  on public.products for select using (true);

drop policy if exists "Allow public insert access on products" on public.products;
create policy "Allow public insert access on products"
  on public.products for insert with check (true);

drop policy if exists "Allow public update access on products" on public.products;
create policy "Allow public update access on products"
  on public.products for update using (true);

drop policy if exists "Allow public delete access on products" on public.products;
create policy "Allow public delete access on products"
  on public.products for delete using (true);

drop policy if exists "Allow public read access on price_history" on public.price_history;
create policy "Allow public read access on price_history"
  on public.price_history for select using (true);
