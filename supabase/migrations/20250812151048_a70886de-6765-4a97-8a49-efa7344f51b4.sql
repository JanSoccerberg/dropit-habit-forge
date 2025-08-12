
-- 1) profiles.user_name hinzufügen und befüllen
alter table public.profiles
  add column if not exists user_name text;

update public.profiles
set user_name = coalesce(
  nullif(btrim(display_name), ''),
  nullif(btrim(name), ''),
  'User'
)
where user_name is null;

-- Optional: sinnvolle Defaults/Not-Null setzen, damit neue Profile nie leer sind
alter table public.profiles
  alter column user_name set default 'User';

alter table public.profiles
  alter column user_name set not null;

-- 2) ensure_profile_exists auf user_name umstellen/ergänzen
create or replace function public.ensure_profile_exists()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not exists (select 1 from public.profiles where id = auth.uid()) then
    insert into public.profiles (id, user_name, name)
    values (auth.uid(), 'User', 'User');
  end if;
end;
$$;

-- 3) RPCs erweitern/neu erstellen

-- Erweitert: Erfolge mit user_name
create or replace function public.get_success_counts(p_challenge_id uuid)
returns table(user_id uuid, user_name text, days integer)
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
  select ci.user_id,
         coalesce(p.user_name, 'User') as user_name,
         count(*)::int as days
  from public.check_ins ci
  join public.profiles p on p.id = ci.user_id
  where ci.challenge_id = p_challenge_id
    and ci.status = 'success'
  group by ci.user_id, p.user_name
  order by days desc;
end;
$$;

-- Erweitert: Fails mit user_name
create or replace function public.get_fail_counts(p_challenge_id uuid)
returns table(user_id uuid, user_name text, days integer)
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
  select ci.user_id,
         coalesce(p.user_name, 'User') as user_name,
         count(*)::int as days
  from public.check_ins ci
  join public.profiles p on p.id = ci.user_id
  where ci.challenge_id = p_challenge_id
    and ci.status = 'fail'
  group by ci.user_id, p.user_name
  order by days desc;
end;
$$;

-- Neu: Teilnehmerliste mit user_name
create or replace function public.get_challenge_members(p_challenge_id uuid)
returns table(user_id uuid, user_name text)
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
  select m.user_id,
         coalesce(p.user_name, 'User') as user_name
  from public.challenge_members m
  join public.profiles p on p.id = m.user_id
  where m.challenge_id = p_challenge_id
  order by user_name asc;
end;
$$;

-- 4) PostgREST Schema Cache neu laden, damit der Client die neue Spalte sofort "sieht"
notify pgrst, 'reload schema';
