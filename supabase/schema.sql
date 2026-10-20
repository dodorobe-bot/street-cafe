-- KAFE RADAR MVP schema for Supabase.
-- Run this in Supabase SQL Editor before launching the app.
create extension if not exists pgcrypto;

create table if not exists public.cafes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes(id) on delete cascade,
  title text not null,
  slug text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  name text not null,
  price integer not null default 0 check (price >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.responses (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  selected_menu text[] not null default '{}',
  price_range text not null default 'tidak_tahu' check (price_range in ('lebih_murah','sesuai','lebih_mahal','tidak_tahu')),
  purchase_intent text not null default 'maybe' check (purchase_intent in ('yes','maybe','no')),
  created_at timestamptz not null default now()
);

-- Promotion links: cafe_id = shown on every campaign of that cafe, campaign_id = extra link for one campaign.
create table if not exists public.social_links (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('instagram','facebook','x','tiktok','threads','whatsapp','youtube','other')),
  url text not null check (url ~* '^https?://'),
  cafe_id uuid references public.cafes(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (cafe_id is not null or campaign_id is not null)
);

alter table public.menu_items add column if not exists photo_path text;

alter table public.cafes enable row level security;alter table public.campaigns enable row level security;
alter table public.menu_items enable row level security;
alter table public.responses enable row level security;

-- Owners can manage their cafe profile.
create policy "owner reads own cafe" on public.cafes for select to authenticated using (owner_id = auth.uid());
create policy "owner inserts own cafe" on public.cafes for insert to authenticated with check (owner_id = auth.uid());
create policy "owner updates own cafe" on public.cafes for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Customers opening a campaign link need the cafe name, but must not browse all cafes.
-- security definer breaks the RLS cycle between cafes and campaigns (each policy would otherwise query the other).
create or replace function public.has_active_campaign(p_cafe uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from campaigns cp where cp.cafe_id = p_cafe and cp.is_active = true);
$$;
grant execute on function public.has_active_campaign(uuid) to anon, authenticated;
create policy "public reads cafe of active campaign" on public.cafes for select to anon, authenticated using (public.has_active_campaign(id));

-- Public can read active campaigns; owners can manage campaigns for their cafe.
create policy "public reads active campaigns" on public.campaigns for select to anon, authenticated using (is_active = true or exists (select 1 from public.cafes c where c.id = cafe_id and c.owner_id = auth.uid()));
create policy "owner creates campaigns" on public.campaigns for insert to authenticated with check (exists (select 1 from public.cafes c where c.id = cafe_id and c.owner_id = auth.uid()));
create policy "owner updates campaigns" on public.campaigns for update to authenticated using (exists (select 1 from public.cafes c where c.id = cafe_id and c.owner_id = auth.uid())) with check (exists (select 1 from public.cafes c where c.id = cafe_id and c.owner_id = auth.uid()));
create policy "owner deletes campaigns" on public.campaigns for delete to authenticated using (exists (select 1 from public.cafes c where c.id = cafe_id and c.owner_id = auth.uid()));

-- Menu items are readable for active campaigns; only the owner can manage them.
create policy "public reads menu for active campaign" on public.menu_items for select to anon, authenticated using (exists (select 1 from public.campaigns cp where cp.id = campaign_id and cp.is_active = true));
create policy "owner inserts menu items" on public.menu_items for insert to authenticated with check (exists (select 1 from public.campaigns cp join public.cafes c on c.id = cp.cafe_id where cp.id = campaign_id and c.owner_id = auth.uid()));
create policy "owner updates menu items" on public.menu_items for update to authenticated using (exists (select 1 from public.campaigns cp join public.cafes c on c.id = cp.cafe_id where cp.id = campaign_id and c.owner_id = auth.uid())) with check (exists (select 1 from public.campaigns cp join public.cafes c on c.id = cp.cafe_id where cp.id = campaign_id and c.owner_id = auth.uid()));
create policy "owner deletes menu items" on public.menu_items for delete to authenticated using (exists (select 1 from public.campaigns cp join public.cafes c on c.id = cp.cafe_id where cp.id = campaign_id and c.owner_id = auth.uid()));

-- Public can submit anonymous menu-interest responses. Owners can read responses to their campaigns.
create policy "public submits response to active campaign" on public.responses for insert to anon, authenticated with check (exists (select 1 from public.campaigns cp where cp.id = campaign_id and cp.is_active = true) and cardinality(selected_menu) > 0);
create policy "owner reads responses" on public.responses for select to authenticated using (exists (select 1 from public.campaigns cp join public.cafes c on c.id = cp.cafe_id where cp.id = campaign_id and c.owner_id = auth.uid()));

alter table public.social_links enable row level security;

-- Customers see the links of the campaign they opened, plus their cafe's default links.
create policy "owner reads own social links" on public.social_links for select to authenticated using (exists (select 1 from public.cafes c where c.id = social_links.cafe_id and c.owner_id = auth.uid()) or exists (select 1 from public.campaigns cp join public.cafes c on c.id = cp.cafe_id where cp.id = social_links.campaign_id and c.owner_id = auth.uid()));
create policy "public reads active social links" on public.social_links for select to anon, authenticated using ((campaign_id is not null and exists (select 1 from public.campaigns cp where cp.id = social_links.campaign_id and cp.is_active = true)) or (cafe_id is not null and public.has_active_campaign(cafe_id)));
create policy "owner inserts social links" on public.social_links for insert to authenticated with check (exists (select 1 from public.cafes c where c.id = social_links.cafe_id and c.owner_id = auth.uid()) or exists (select 1 from public.campaigns cp join public.cafes c on c.id = cp.cafe_id where cp.id = social_links.campaign_id and c.owner_id = auth.uid()));
create policy "owner updates social links" on public.social_links for update to authenticated using (exists (select 1 from public.cafes c where c.id = social_links.cafe_id and c.owner_id = auth.uid()) or exists (select 1 from public.campaigns cp join public.cafes c on c.id = cp.cafe_id where cp.id = social_links.campaign_id and c.owner_id = auth.uid())) with check (exists (select 1 from public.cafes c where c.id = social_links.cafe_id and c.owner_id = auth.uid()) or exists (select 1 from public.campaigns cp join public.cafes c on c.id = cp.cafe_id where cp.id = social_links.campaign_id and c.owner_id = auth.uid()));
create policy "owner deletes social links" on public.social_links for delete to authenticated using (exists (select 1 from public.cafes c where c.id = social_links.cafe_id and c.owner_id = auth.uid()) or exists (select 1 from public.campaigns cp join public.cafes c on c.id = cp.cafe_id where cp.id = social_links.campaign_id and c.owner_id = auth.uid()));

-- Menu photos live in Supabase Storage; the database only keeps the object path.
insert into storage.buckets (id, name, public) values ('menu-photos','menu-photos',true) on conflict (id) do nothing;
create policy "owner uploads menu photo" on storage.objects for insert to authenticated with check (bucket_id = 'menu-photos' and owner = auth.uid());
create policy "owner replaces own photo" on storage.objects for update to authenticated using (bucket_id = 'menu-photos' and owner = auth.uid());
create policy "owner removes own photo" on storage.objects for delete to authenticated using (bucket_id = 'menu-photos' and owner = auth.uid());
create policy "public reads menu photos" on storage.objects for select to anon, authenticated using (bucket_id = 'menu-photos');

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.cafes to authenticated;
grant select, insert, update, delete on public.campaigns to authenticated;
grant select, insert, update, delete on public.menu_items to authenticated;
grant select, insert on public.responses to anon, authenticated;
grant select, insert, update, delete on public.social_links to authenticated;
grant select on public.social_links to anon;
