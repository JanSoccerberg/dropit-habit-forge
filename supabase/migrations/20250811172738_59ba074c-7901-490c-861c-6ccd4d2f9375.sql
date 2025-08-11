
-- 1) Enum für Status
do $$
begin
  if not exists (select 1 from pg_type where typname = 'checkin_status') then
    create type public.checkin_status as enum ('success', 'fail');
  end if;
end$$;

-- 2) Tabelle für tägliche Check-ins
create table if not exists public.check_ins (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null,
  user_id uuid not null,
  "date" date not null,
  status public.checkin_status not null,
  screenshot_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (challenge_id, user_id, "date")
);

-- Index für schnelle Filterung (challenge, user, date)
create index if not exists idx_check_ins_ch_user_date
  on public.check_ins (challenge_id, user_id, "date");

-- updated_at Trigger
drop trigger if exists trg_check_ins_set_updated_at on public.check_ins;
create trigger trg_check_ins_set_updated_at
before update on public.check_ins
for each row execute function public.update_updated_at_column();

-- 3) RLS aktivieren + Policies
alter table public.check_ins enable row level security;

do $$
begin
  -- SELECT: Mitglieder der Challenge dürfen Check-ins sehen
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'check_ins' and policyname = 'Members can view check-ins of own challenges'
  ) then
    create policy "Members can view check-ins of own challenges"
      on public.check_ins
      for select
      using (public.is_member_of_challenge(challenge_id));
  end if;

  -- INSERT: Nutzer dürfen eigene Check-ins in eigenen Challenges anlegen
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'check_ins' and policyname = 'Users can insert their own check-ins'
  ) then
    create policy "Users can insert their own check-ins"
      on public.check_ins
      for insert
      with check (
        user_id = auth.uid()
        and public.is_member_of_challenge(challenge_id)
      );
  end if;

  -- UPDATE: Nutzer dürfen eigene Check-ins in eigenen Challenges ändern
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'check_ins' and policyname = 'Users can update their own check-ins'
  ) then
    create policy "Users can update their own check-ins"
      on public.check_ins
      for update
      using (
        user_id = auth.uid()
        and public.is_member_of_challenge(challenge_id)
      )
      with check (
        user_id = auth.uid()
        and public.is_member_of_challenge(challenge_id)
      );
  end if;

  -- DELETE: optional – Nutzer dürfen eigene Check-ins löschen
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'check_ins' and policyname = 'Users can delete their own check-ins'
  ) then
    create policy "Users can delete their own check-ins"
      on public.check_ins
      for delete
      using (
        user_id = auth.uid()
        and public.is_member_of_challenge(challenge_id)
      );
  end if;
end$$;

-- 4) RPC: Upsert für Check-in (legt an oder aktualisiert)
create or replace function public.upsert_check_in(
  p_challenge_id uuid,
  p_date date,
  p_status public.checkin_status,
  p_screenshot_name text default null
) returns public.check_ins
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user uuid := auth.uid();
  v_row public.check_ins;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not public.is_member_of_challenge(p_challenge_id) then
    raise exception 'NOT_A_MEMBER';
  end if;

  insert into public.check_ins (challenge_id, user_id, "date", status, screenshot_name)
  values (p_challenge_id, v_user, p_date, p_status, p_screenshot_name)
  on conflict (challenge_id, user_id, "date")
  do update set
    status = excluded.status,
    screenshot_name = excluded.screenshot_name,
    updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

-- 5) RPC: Rangliste - Anzahl erfolgreicher Tage
create or replace function public.get_success_counts(p_challenge_id uuid)
returns table (user_id uuid, days int)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not public.is_member_of_challenge(p_challenge_id) then
    raise exception 'NOT_A_MEMBER';
  end if;

  return query
  select ci.user_id, count(*)::int as days
  from public.check_ins ci
  where ci.challenge_id = p_challenge_id
    and ci.status = 'success'
  group by ci.user_id
  order by days desc;
end;
$$;

-- 6) RPC: Rangliste - Anzahl nicht geschaffter Tage
create or replace function public.get_fail_counts(p_challenge_id uuid)
returns table (user_id uuid, days int)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not public.is_member_of_challenge(p_challenge_id) then
    raise exception 'NOT_A_MEMBER';
  end if;

  return query
  select ci.user_id, count(*)::int as days
  from public.check_ins ci
  where ci.challenge_id = p_challenge_id
    and ci.status = 'fail'
  group by ci.user_id
  order by days desc;
end;
$$;

-- 7) RPC: Kalenderdaten für einen (standardmäßig: aktuellen) Nutzer
create or replace function public.get_user_calendar(
  p_challenge_id uuid,
  p_user_id uuid default null
) returns table ("date" date, status public.checkin_status)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user uuid := coalesce(p_user_id, auth.uid());
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not public.is_member_of_challenge(p_challenge_id) then
    raise exception 'NOT_A_MEMBER';
  end if;

  return query
  select ci."date", ci.status
  from public.check_ins ci
  where ci.challenge_id = p_challenge_id
    and ci.user_id = v_user
  order by ci."date";
end;
$$;
