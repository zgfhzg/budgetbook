-- Budget Book initial Supabase schema.
-- Apply in Supabase SQL Editor or through the Supabase CLI.

create extension if not exists pgcrypto;

do $$
begin
  create type public.transaction_kind as enum ('expense', 'income', 'transfer');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.receipt_status as enum (
    'uploaded',
    'processing',
    'completed',
    'failed',
    'confirmed'
  );
exception
  when duplicate_object then null;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  default_currency char(3) not null default 'KRW',
  timezone text not null default 'Asia/Seoul',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_default_currency_format check (default_currency ~ '^[A-Z]{3}$')
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  kind public.transaction_kind not null default 'expense',
  color text not null default '#2f9f8f',
  icon text,
  sort_order integer not null default 0,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_system_owner_check check (
    (is_system = true and user_id is null)
    or (is_system = false and user_id is not null)
  ),
  constraint categories_color_format check (color ~ '^#[0-9A-Fa-f]{6}$')
);

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  address text,
  phone text,
  country text,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  place_provider text,
  place_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  store_id uuid references public.stores(id) on delete set null,
  kind public.transaction_kind not null default 'expense',
  title text not null,
  amount numeric(14, 2) not null,
  currency char(3) not null default 'KRW',
  occurred_at timestamptz not null default now(),
  local_date date not null,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint transactions_amount_positive check (amount >= 0),
  constraint transactions_currency_format check (currency ~ '^[A-Z]{3}$')
);

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  store_id uuid references public.stores(id) on delete set null,
  transaction_id uuid references public.transactions(id) on delete set null,
  status public.receipt_status not null default 'uploaded',
  storage_bucket text not null default 'receipts',
  storage_path text not null,
  source_file_name text,
  mime_type text,
  country text,
  language text,
  currency char(3),
  purchased_at timestamptz,
  subtotal numeric(14, 2),
  tax numeric(14, 2) not null default 0,
  tip numeric(14, 2) not null default 0,
  total numeric(14, 2),
  confidence numeric(4, 3),
  ocr_text text,
  parsed_json jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint receipts_currency_format check (currency is null or currency ~ '^[A-Z]{3}$'),
  constraint receipts_confidence_range check (confidence is null or confidence between 0 and 1),
  constraint receipts_storage_bucket_check check (storage_bucket = 'receipts'),
  constraint receipts_storage_path_owner_check check (
    storage_path like (user_id::text || '/%')
  )
);

create table if not exists public.receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.receipts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  quantity numeric(12, 3) not null default 1,
  unit_price numeric(14, 2),
  total_price numeric(14, 2) not null,
  currency char(3) not null,
  category_id uuid references public.categories(id) on delete set null,
  line_index integer not null default 0,
  raw_text text,
  confidence numeric(4, 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint receipt_items_quantity_positive check (quantity > 0),
  constraint receipt_items_total_price_nonnegative check (total_price >= 0),
  constraint receipt_items_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint receipt_items_confidence_range check (confidence is null or confidence between 0 and 1)
);

create index if not exists profiles_updated_at_idx on public.profiles(updated_at desc);
create index if not exists categories_user_id_idx on public.categories(user_id);
create unique index if not exists categories_system_unique_idx
on public.categories(name, kind)
where is_system = true;
create unique index if not exists categories_user_unique_idx
on public.categories(user_id, name, kind)
where is_system = false;
create index if not exists stores_user_id_idx on public.stores(user_id);
create index if not exists stores_user_place_idx on public.stores(user_id, place_provider, place_id);
create index if not exists transactions_user_date_idx on public.transactions(user_id, local_date desc);
create index if not exists transactions_user_category_idx on public.transactions(user_id, category_id);
create index if not exists transactions_user_store_idx on public.transactions(user_id, store_id);
create index if not exists receipts_user_status_idx on public.receipts(user_id, status);
create index if not exists receipts_user_created_idx on public.receipts(user_id, created_at desc);
create index if not exists receipt_items_user_receipt_idx on public.receipt_items(user_id, receipt_id);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_categories_updated_at on public.categories;
create trigger set_categories_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

drop trigger if exists set_stores_updated_at on public.stores;
create trigger set_stores_updated_at
before update on public.stores
for each row execute function public.set_updated_at();

drop trigger if exists set_transactions_updated_at on public.transactions;
create trigger set_transactions_updated_at
before update on public.transactions
for each row execute function public.set_updated_at();

drop trigger if exists set_receipts_updated_at on public.receipts;
create trigger set_receipts_updated_at
before update on public.receipts
for each row execute function public.set_updated_at();

drop trigger if exists set_receipt_items_updated_at on public.receipt_items;
create trigger set_receipt_items_updated_at
before update on public.receipt_items
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.stores enable row level security;
alter table public.transactions enable row level security;
alter table public.receipts enable row level security;
alter table public.receipt_items enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "categories_select_own_or_system" on public.categories;
create policy "categories_select_own_or_system"
on public.categories for select
to authenticated
using (is_system = true or (select auth.uid()) = user_id);

drop policy if exists "categories_insert_own" on public.categories;
create policy "categories_insert_own"
on public.categories for insert
to authenticated
with check ((select auth.uid()) = user_id and is_system = false);

drop policy if exists "categories_update_own" on public.categories;
create policy "categories_update_own"
on public.categories for update
to authenticated
using ((select auth.uid()) = user_id and is_system = false)
with check ((select auth.uid()) = user_id and is_system = false);

drop policy if exists "categories_delete_own" on public.categories;
create policy "categories_delete_own"
on public.categories for delete
to authenticated
using ((select auth.uid()) = user_id and is_system = false);

drop policy if exists "stores_all_own" on public.stores;
create policy "stores_all_own"
on public.stores for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "transactions_all_own" on public.transactions;
create policy "transactions_all_own"
on public.transactions for all
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and (
    category_id is null
    or exists (
      select 1
      from public.categories
      where categories.id = transactions.category_id
        and (categories.is_system = true or categories.user_id = (select auth.uid()))
    )
  )
  and (
    store_id is null
    or exists (
      select 1
      from public.stores
      where stores.id = transactions.store_id
        and stores.user_id = (select auth.uid())
    )
  )
);

drop policy if exists "receipts_all_own" on public.receipts;
create policy "receipts_all_own"
on public.receipts for all
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and storage_path like ((select auth.uid())::text || '/%')
  and (
    store_id is null
    or exists (
      select 1
      from public.stores
      where stores.id = receipts.store_id
        and stores.user_id = (select auth.uid())
    )
  )
  and (
    transaction_id is null
    or exists (
      select 1
      from public.transactions
      where transactions.id = receipts.transaction_id
        and transactions.user_id = (select auth.uid())
    )
  )
);

drop policy if exists "receipt_items_all_own" on public.receipt_items;
create policy "receipt_items_all_own"
on public.receipt_items for all
to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.receipts
    where receipts.id = receipt_items.receipt_id
      and receipts.user_id = (select auth.uid())
  )
)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.receipts
    where receipts.id = receipt_items.receipt_id
      and receipts.user_id = (select auth.uid())
  )
  and (
    category_id is null
    or exists (
      select 1
      from public.categories
      where categories.id = receipt_items.category_id
        and (categories.is_system = true or categories.user_id = (select auth.uid()))
    )
  )
);

insert into public.categories (name, kind, color, icon, sort_order, is_system)
values
  ('식비', 'expense', '#2f9f8f', 'utensils', 10, true),
  ('카페', 'expense', '#b15e32', 'coffee', 20, true),
  ('교통', 'expense', '#4b6f9f', 'train', 30, true),
  ('생활', 'expense', '#7b6fb0', 'shopping-bag', 40, true),
  ('의료', 'expense', '#c85b68', 'cross', 50, true),
  ('급여', 'income', '#3f8f5f', 'wallet', 60, true)
on conflict do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts',
  'receipts',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "receipt_objects_select_own" on storage.objects;
create policy "receipt_objects_select_own"
on storage.objects for select
to authenticated
using (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "receipt_objects_insert_own" on storage.objects;
create policy "receipt_objects_insert_own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "receipt_objects_update_own" on storage.objects;
create policy "receipt_objects_update_own"
on storage.objects for update
to authenticated
using (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "receipt_objects_delete_own" on storage.objects;
create policy "receipt_objects_delete_own"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
