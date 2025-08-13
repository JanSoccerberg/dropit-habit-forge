-- 1) profiles.user_name absichern: hinzufügen (falls fehlt), auffüllen, Default setzen
alter table public.profiles
  add column if not exists user_name text;

update public.profiles
set user_name = coalesce(
  nullif(btrim(user_name), ''),
  nullif(btrim(display_name), ''),
  'User'
)
where user_name is null or btrim(coalesce(user_name, '')) = '';

alter table public.profiles
  alter column user_name set default 'User';

-- 2) Alte Funktionen löschen (um Rückgabetypen zu ändern)
drop function if exists public.get_success_counts(uuid);
drop function if exists public.get_fail_counts(uuid);
drop function if exists public.get_challenge_members(uuid);

-- 3) ensure_profile_exists: user_name statt name
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
    insert into public.profiles (id, user_name)
    values (auth.uid(), 'User');
  end if;
end;
$$;

-- 4) Leaderboard-RPCs inkl. user_name neu erstellen
create function public.get_success_counts(p_challenge_id uuid)
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

create function public.get_fail_counts(p_challenge_id uuid)
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

-- 5) Teilnehmerliste-RPC neu erstellen
create function public.get_challenge_members(p_challenge_id uuid)
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

-- 6) GRANT EXECUTE permissions
grant execute on function public.get_success_counts(uuid) to authenticated;
grant execute on function public.get_fail_counts(uuid) to authenticated;
grant execute on function public.get_challenge_members(uuid) to authenticated;
grant execute on function public.is_member_of_challenge(uuid) to authenticated;
grant execute on function public.ensure_profile_exists() to authenticated;

-- 7) PostgREST Schema Cache neu laden
notify pgrst, 'reload schema';