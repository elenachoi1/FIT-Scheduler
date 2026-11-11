-- FIT Scheduler — Supabase schema
-- Paste this whole file into Supabase → SQL Editor → Run.

-- ───────────────────────── Tables ─────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  owner_id uuid not null references public.profiles on delete cascade,
  invite_code text not null unique
    default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- All times are New York wall-clock times (America/New_York).
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  dates date[] not null check (cardinality(dates) between 1 and 31),
  start_minute int not null check (start_minute between 0 and 1440),
  end_minute int not null check (end_minute between 0 and 1440),
  slot_minutes int not null default 30 check (slot_minutes in (15, 30, 60)),
  created_by uuid not null references public.profiles on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  check (end_minute > start_minute)
);

-- One row per person per event; slots look like "2026-11-12_540" (date_minuteOfDay, NY time).
create table if not exists public.availability (
  event_id uuid not null references public.events on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  slots text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

-- ───────────────────────── Profile on sign-up ─────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────── Helpers ─────────────────────────
create or replace function public.is_group_member(gid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_members where group_id = gid and user_id = auth.uid());
$$;

create or replace function public.is_event_member(eid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from events e join group_members m on m.group_id = e.group_id
    where e.id = eid and m.user_id = auth.uid());
$$;

-- Create a group and make the caller its owner.
create or replace function public.create_group(p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare gid uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  insert into groups (name, owner_id) values (trim(p_name), auth.uid()) returning id into gid;
  insert into group_members (group_id, user_id, role) values (gid, auth.uid(), 'owner');
  return gid;
end $$;

-- Join a group with its invite code.
create or replace function public.join_group(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare gid uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select id into gid from groups where invite_code = p_code;
  if gid is null then raise exception 'Invite link is not valid'; end if;
  insert into group_members (group_id, user_id) values (gid, auth.uid()) on conflict do nothing;
  return gid;
end $$;

grant execute on function public.create_group(text), public.join_group(text),
  public.is_group_member(uuid), public.is_event_member(uuid) to authenticated;

-- ───────────────────────── Row Level Security ─────────────────────────
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.events enable row level security;
alter table public.availability enable row level security;

drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select to authenticated using (true);
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "groups read" on public.groups;
create policy "groups read" on public.groups for select to authenticated using (public.is_group_member(id));
drop policy if exists "groups rename by owner" on public.groups;
create policy "groups rename by owner" on public.groups for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "groups delete by owner" on public.groups;
create policy "groups delete by owner" on public.groups for delete to authenticated using (owner_id = auth.uid());

drop policy if exists "members read" on public.group_members;
create policy "members read" on public.group_members for select to authenticated using (public.is_group_member(group_id));
drop policy if exists "members leave" on public.group_members;
create policy "members leave" on public.group_members for delete to authenticated
  using (user_id = auth.uid() and role <> 'owner');

drop policy if exists "events read" on public.events;
create policy "events read" on public.events for select to authenticated using (public.is_group_member(group_id));
drop policy if exists "events create" on public.events;
create policy "events create" on public.events for insert to authenticated
  with check (public.is_group_member(group_id) and created_by = auth.uid());
drop policy if exists "events edit by creator" on public.events;
create policy "events edit by creator" on public.events for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());
drop policy if exists "events delete by creator" on public.events;
create policy "events delete by creator" on public.events for delete to authenticated using (created_by = auth.uid());

drop policy if exists "availability read" on public.availability;
create policy "availability read" on public.availability for select to authenticated using (public.is_event_member(event_id));
drop policy if exists "availability insert own" on public.availability;
create policy "availability insert own" on public.availability for insert to authenticated
  with check (user_id = auth.uid() and public.is_event_member(event_id));
drop policy if exists "availability update own" on public.availability;
create policy "availability update own" on public.availability for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_event_member(event_id));

-- ───────────────────────── Live updates ─────────────────────────
do $$ begin
  alter publication supabase_realtime add table public.availability;
exception when duplicate_object then null; end $$;
