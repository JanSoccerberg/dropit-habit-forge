
-- Enums
create type public.challenge_rule as enum ('per-missed-day', 'overall-fail');
create type public.check_in_status as enum ('success', 'fail');

-- Profiles (User-Infos per App, referenziert auth.users)
create table public.profiles (
  id uuid not null primary key references auth.users(id) on delete cascade,
  name text,
  avatar_url text,
  locale text not null default 'de',
  push_enabled boolean not null default false,
  dark_mode boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can select their own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id);

-- Profile-Autopopulation bei Signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', 'User'));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Challenges
create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  start_date date not null,
  end_date date not null,
  check_in_time time not null,
  require_screenshot boolean not null default false,
  stake_text text,
  stake_rule public.challenge_rule not null default 'per-missed-day',
  join_code text not null unique,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint join_code_format check (join_code ~ '^[A-Z0-9]{6}$'),
  constraint start_before_end check (start_date <= end_date)
);

alter table public.challenges enable row level security;

create policy "Members and creator can view challenge"
  on public.challenges
  for select
  to authenticated
  using (
    creator_id = auth.uid()
    or exists (
      select 1 from public.challenge_members m
      where m.challenge_id = challenges.id and m.user_id = auth.uid()
    )
  );

create policy "Creator can create challenge"
  on public.challenges
  for insert
  to authenticated
  with check (creator_id = auth.uid());

create policy "Only creator can update challenge"
  on public.challenges
  for update
  to authenticated
  using (creator_id = auth.uid());

create policy "Only creator can delete challenge"
  on public.challenges
  for delete
  to authenticated
  using (creator_id = auth.uid());

-- Generiere 6-stelligen Join-Code serverseitig (uppercase, eindeutig)
create or replace function public.generate_challenge_join_code()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_code text;
begin
  if new.join_code is null then
    loop
      v_code := upper(translate(encode(gen_random_bytes(4), 'base64'), '/+=', '___'));
      v_code := regexp_replace(v_code, '[^A-Z0-9]', '', 'g');
      v_code := substr(v_code, 1, 6);
      exit when not exists (select 1 from public.challenges where join_code = v_code);
    end loop;
    new.join_code := v_code;
  else
    new.join_code := upper(new.join_code);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_generate_challenge_join_code on public.challenges;
create trigger trg_generate_challenge_join_code
before insert on public.challenges
for each row execute procedure public.generate_challenge_join_code();

-- Challenge Members (Teilnahmen)
create table public.challenge_members (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  streak integer not null default 0,
  last_check_in_date date,
  reminders jsonb not null default jsonb_build_object('before1h', false),
  unique (challenge_id, user_id)
);

create index on public.challenge_members (challenge_id);
create index on public.challenge_members (user_id);

alter table public.challenge_members enable row level security;

create policy "Members and creator can read members"
  on public.challenge_members
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.challenges c
      where c.id = challenge_members.challenge_id and c.creator_id = auth.uid()
    )
  );

create policy "Users can join challenges"
  on public.challenge_members
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.challenges c where c.id = challenge_members.challenge_id)
  );

create policy "Member or creator can update membership"
  on public.challenge_members
  for update
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.challenges c
      where c.id = challenge_members.challenge_id and c.creator_id = auth.uid()
    )
  );

create policy "Member or creator can delete membership"
  on public.challenge_members
  for delete
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.challenges c
      where c.id = challenge_members.challenge_id and c.creator_id = auth.uid()
    )
  );

-- Check-Ins
create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  status public.check_in_status not null,
  screenshot_name text,
  created_at timestamptz not null default now(),
  unique (challenge_id, user_id, date)
);

create index on public.check_ins (challenge_id, user_id, date);

alter table public.check_ins enable row level security;

create policy "Members and creator can read check_ins"
  on public.check_ins
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.challenges c
      where c.id = check_ins.challenge_id and c.creator_id = auth.uid()
    )
  );

create policy "Members can insert own check_in"
  on public.check_ins
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.challenge_members m
      where m.challenge_id = check_ins.challenge_id and m.user_id = auth.uid()
    )
  );

create policy "Owners can update own check_in"
  on public.check_ins
  for update
  to authenticated
  using (user_id = auth.uid());

-- RPCs
-- 1) Vorschau einer Challenge per Join-Code (ohne Mitgliedschaft)
create or replace function public.get_challenge_by_join_code(p_code text)
returns table (
  id uuid,
  title text,
  description text,
  start_date date,
  end_date date,
  check_in_time time,
  require_screenshot boolean,
  stake_text text,
  stake_rule public.challenge_rule
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.title, c.description, c.start_date, c.end_date, c.check_in_time,
         c.require_screenshot, c.stake_text, c.stake_rule
  from public.challenges c
  where c.join_code = upper(p_code)
  limit 1
$$;

grant execute on function public.get_challenge_by_join_code(text) to anon, authenticated;

-- 2) Atomar beitreten per Code
create or replace function public.join_challenge_by_code(p_code text)
returns table (challenge_id uuid, member_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_challenge_id uuid;
  v_member_id uuid;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select id into v_challenge_id
  from public.challenges
  where join_code = upper(p_code)
  limit 1;

  if v_challenge_id is null then
    raise exception 'Challenge not found';
  end if;

  insert into public.challenge_members (challenge_id, user_id)
  values (v_challenge_id, v_user_id)
  on conflict (challenge_id, user_id)
  do update set joined_at = excluded.joined_at
  returning id into v_member_id;

  return query select v_challenge_id, v_member_id;
end;
$$;

grant execute on function public.join_challenge_by_code(text) to authenticated;

-- 3) Atomarer Check-In inkl. Streak-Update
create or replace function public.upsert_check_in(p_challenge_id uuid, p_status public.check_in_status, p_screenshot_name text default null)
returns table (check_in_id uuid, new_streak int, date date)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (now() at time zone 'utc')::date;
  v_yesterday date := ((now() at time zone 'utc')::date - 1);
  v_prev_last date;
  v_prev_streak int;
  v_id uuid;
  v_new_streak int;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.challenge_members m
    where m.challenge_id = p_challenge_id and m.user_id = v_user_id
  ) then
    raise exception 'Not a member of this challenge';
  end if;

  insert into public.check_ins (challenge_id, user_id, date, status, screenshot_name)
  values (p_challenge_id, v_user_id, v_today, p_status, p_screenshot_name)
  on conflict (challenge_id, user_id, date)
  do update set status = excluded.status, screenshot_name = excluded.screenshot_name
  returning id into v_id;

  select streak, last_check_in_date into v_prev_streak, v_prev_last
  from public.challenge_members
  where challenge_id = p_challenge_id and user_id = v_user_id;

  if p_status = 'success' then
    if v_prev_last = v_yesterday then
      v_new_streak := coalesce(v_prev_streak, 0) + 1;
    else
      v_new_streak := greatest(1, coalesce(v_prev_streak, 0) + 1);
    end if;
  else
    v_new_streak := 0;
  end if;

  update public.challenge_members
  set streak = v_new_streak, last_check_in_date = v_today
  where challenge_id = p_challenge_id and user_id = v_user_id;

  return query select v_id, v_new_streak, v_today;
end;
$$;

grant execute on function public.upsert_check_in(uuid, public.check_in_status, text) to authenticated;

-- Realtime
alter table public.challenges replica identity full;
alter table public.challenge_members replica identity full;
alter table public.check_ins replica identity full;

alter publication supabase_realtime add table public.challenges;
alter publication supabase_realtime add table public.challenge_members;
alter publication supabase_realtime add table public.check_ins;
