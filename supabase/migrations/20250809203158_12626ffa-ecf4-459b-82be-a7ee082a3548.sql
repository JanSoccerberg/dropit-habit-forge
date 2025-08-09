-- Enable required extensions (safe if already enabled)
create extension if not exists pgcrypto;

-- Enums
create type public.bet_rule as enum ('per_day', 'end_fail');
create type public.member_role as enum ('creator', 'member');

-- Utility: update updated_at
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Profiles table (superset to support current UI and spec)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  -- legacy UI fields
  name text,
  avatar_url text check (avatar_url is null or avatar_url ~ '^(https?|data):'),
  locale text not null default 'de',
  push_enabled boolean not null default false,
  dark_mode boolean not null default false,
  -- spec fields
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure display_name is within 1..50 if provided
create or replace function public.profiles_validate()
returns trigger as $$
begin
  if new.display_name is not null then
    if length(btrim(new.display_name)) < 1 or length(new.display_name) > 50 then
      raise exception 'display_name must be 1..50 characters';
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

create or replace function public.profiles_fill_defaults()
returns trigger as $$
begin
  if (new.display_name is null or length(btrim(coalesce(new.display_name, ''))) = 0) then
    if new.name is not null and length(btrim(new.name)) > 0 then
      new.display_name := left(new.name, 50);
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger profiles_before_ins
before insert on public.profiles
for each row execute function public.profiles_fill_defaults();

create trigger profiles_before_upd_validate
before insert or update on public.profiles
for each row execute function public.profiles_validate();

create trigger profiles_updated_at
before update on public.profiles
for each row execute function public.update_updated_at_column();

-- RLS for profiles
alter table public.profiles enable row level security;

create policy "Own profile: select"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Own profile: insert"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Own profile: update"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Challenges table
create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  start_date date not null,
  end_date date not null,
  checkin_time text not null,
  screenshot_required boolean not null default false,
  bet_description text,
  bet_rule public.bet_rule not null,
  join_code text not null unique,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint title_len check (char_length(title) between 3 and 80),
  constraint description_len check (description is null or char_length(description) <= 1000),
  constraint bet_description_len check (bet_description is null or char_length(bet_description) <= 140),
  constraint date_range_ok check (end_date >= start_date),
  constraint checkin_time_fmt check (
    checkin_time ~ '^[0-2][0-9]:[0-5][0-9]$' and
    substring(checkin_time from 1 for 2)::int between 0 and 23 and
    substring(checkin_time from 4 for 2)::int between 0 and 59
  )
);

create index if not exists idx_challenges_creator on public.challenges(creator_id);
create index if not exists idx_challenges_start on public.challenges(start_date);
create index if not exists idx_challenges_end on public.challenges(end_date);
create unique index if not exists uq_challenges_join_code on public.challenges(join_code);

-- Challenge members
create table if not exists public.challenge_members (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.member_role not null,
  joined_at timestamptz not null default now(),
  unique (challenge_id, user_id)
);

create index if not exists idx_members_challenge on public.challenge_members(challenge_id);
create index if not exists idx_members_user on public.challenge_members(user_id);

-- Event logs (basic analytics)
create table if not exists public.event_logs (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('challenge_created','challenge_joined','rotate_code')),
  user_id uuid references public.profiles(id) on delete set null,
  challenge_id uuid references public.challenges(id) on delete set null,
  payload jsonb,
  created_at timestamptz not null default now()
);

alter table public.event_logs enable row level security;
create policy "Own logs: select" on public.event_logs for select using (auth.uid() = user_id);
create policy "All auth can insert logs" on public.event_logs for insert to authenticated with check (true);

-- Join code generation
create or replace function public.generate_unique_join_code()
returns text as $$
declare
  chars constant text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  code text := '';
  i int;
  exists_code int;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    end loop;

    select count(*) into exists_code from public.challenges where join_code = code;

    exit when exists_code = 0;
  end loop;

  return code;
end;
$$ language plpgsql;

-- BEFORE INSERT trigger to set join_code when missing
create or replace function public.challenges_before_insert()
returns trigger as $$
begin
  if new.join_code is null or not (new.join_code ~ '^[A-Z0-9]{6}$') then
    new.join_code := public.generate_unique_join_code();
  end if;
  return new;
end;
$$ language plpgsql;

create trigger challenges_before_ins
before insert on public.challenges
for each row execute function public.challenges_before_insert();

-- Auto update updated_at
create trigger challenges_updated_at
before update on public.challenges
for each row execute function public.update_updated_at_column();

-- Auto add creator as member
create or replace function public.add_creator_membership()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.challenge_members (challenge_id, user_id, role)
  values (new.id, new.creator_id, 'creator');
  return new;
end;
$$;

create trigger challenges_after_ins_creator_member
after insert on public.challenges
for each row execute function public.add_creator_membership();

-- RLS for challenges
alter table public.challenges enable row level security;

create policy "Members can view challenge"
  on public.challenges for select
  using (
    creator_id = auth.uid() or exists (
      select 1 from public.challenge_members m
      where m.challenge_id = id and m.user_id = auth.uid()
    )
  );

create policy "Creator can insert challenge"
  on public.challenges for insert
  with check (creator_id = auth.uid());

create policy "Creator can update challenge"
  on public.challenges for update
  using (creator_id = auth.uid())
  with check (creator_id = auth.uid());

create policy "Creator can delete challenge"
  on public.challenges for delete
  using (creator_id = auth.uid());

-- RLS for challenge_members
alter table public.challenge_members enable row level security;

create policy "Members can view members of own challenges"
  on public.challenge_members for select
  using (
    exists (
      select 1 from public.challenge_members m2
      where m2.challenge_id = challenge_id and m2.user_id = auth.uid()
    )
  );

create policy "Users can insert their own membership"
  on public.challenge_members for insert to authenticated
  with check (user_id = auth.uid());

create policy "Creators can remove members"
  on public.challenge_members for delete to authenticated
  using (
    exists (
      select 1 from public.challenges c
      where c.id = challenge_id and c.creator_id = auth.uid()
    )
  );

-- RPC: get challenge by join code (public preview for authenticated users)
create or replace function public.get_challenge_by_join_code(p_join_code text)
returns public.challenges
language sql
security definer
set search_path = public
as $$
  select * from public.challenges where join_code = p_join_code limit 1;
$$;

-- RPC: join challenge by code
create or replace function public.join_challenge_by_code(p_join_code text)
returns public.challenges
language plpgsql
security definer set search_path = public
as $$
declare
  ch public.challenges;
begin
  if p_join_code !~ '^[A-Z0-9]{6}$' then
    raise exception 'INVALID_JOIN_CODE_FORMAT';
  end if;

  select * into ch from public.challenges where join_code = p_join_code;
  if ch.id is null then
    raise exception 'CHALLENGE_NOT_FOUND';
  end if;

  -- insert membership if not exists
  begin
    insert into public.challenge_members (challenge_id, user_id, role)
    values (ch.id, auth.uid(), 'member');
  exception when unique_violation then
    -- already a member, ignore
    null;
  end;

  -- log event
  insert into public.event_logs (event_type, user_id, challenge_id, payload)
  values ('challenge_joined', auth.uid(), ch.id, jsonb_build_object('join_code', p_join_code));

  return ch;
end;
$$;

-- RPC: rotate join code (creator only)
create or replace function public.rotate_join_code(p_challenge_id uuid)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  ch public.challenges;
  new_code text;
begin
  select * into ch from public.challenges where id = p_challenge_id;
  if ch.id is null then
    raise exception 'CHALLENGE_NOT_FOUND';
  end if;
  if ch.creator_id <> auth.uid() then
    raise exception 'ONLY_CREATOR_CAN_EDIT';
  end if;

  loop
    new_code := public.generate_unique_join_code();
    begin
      update public.challenges set join_code = new_code, updated_at = now() where id = p_challenge_id;
      exit;
    exception when unique_violation then
      -- retry on rare collision
      null;
    end;
  end loop;

  insert into public.event_logs (event_type, user_id, challenge_id, payload)
  values ('rotate_code', auth.uid(), ch.id, jsonb_build_object('old_code', ch.join_code, 'new_code', new_code));

  return new_code;
end;
$$;
