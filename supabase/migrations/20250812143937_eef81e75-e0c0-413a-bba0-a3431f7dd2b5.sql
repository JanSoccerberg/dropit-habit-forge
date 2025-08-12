
-- 1) Add user_name to profiles and backfill from existing fields
alter table public.profiles
  add column if not exists user_name text;

update public.profiles
set user_name = left(
  coalesce(nullif(btrim(display_name), ''), nullif(btrim(name), ''), 'User'),
  50
)
where user_name is null or btrim(coalesce(user_name, '')) = '';

-- 2) Ensure new profiles get user_name by default
create or replace function public.ensure_profile_exists()
returns void
language plpgsql
security definER
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not exists (select 1 from public.profiles where id = auth.uid()) then
    insert into public.profiles (id, user_name)
    values (auth.uid(), 'User');
  end if;
end;
$function$;

-- 3) Leaderboards with usernames
create or replace function public.get_success_counts(p_challenge_id uuid)
returns table(user_id uuid, user_name text, days integer)
language plpgsql
security definER
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not public.is_member_of_challenge(p_challenge_id) then
    raise exception 'NOT_A_MEMBER';
  end if;

  return query
  select
    ci.user_id,
    coalesce(p.user_name, 'User') as user_name,
    count(*)::int as days
  from public.check_ins ci
  left join public.profiles p on p.id = ci.user_id
  where ci.challenge_id = p_challenge_id
    and ci.status = 'success'
  group by ci.user_id, p.user_name
  order by days desc, user_name asc nulls last;
end;
$function$;

create or replace function public.get_fail_counts(p_challenge_id uuid)
returns table(user_id uuid, user_name text, days integer)
language plpgsql
security definER
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not public.is_member_of_challenge(p_challenge_id) then
    raise exception 'NOT_A_MEMBER';
  end if;

  return query
  select
    ci.user_id,
    coalesce(p.user_name, 'User') as user_name,
    count(*)::int as days
  from public.check_ins ci
  left join public.profiles p on p.id = ci.user_id
  where ci.challenge_id = p_challenge_id
    and ci.status = 'fail'
  group by ci.user_id, p.user_name
  order by days desc, user_name asc nulls last;
end;
$function$;

-- 4) Teilnehmerliste with usernames for all members
create or replace function public.get_challenge_members(p_challenge_id uuid)
returns table(user_id uuid, user_name text)
language plpgsql
security definER
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not public.is_member_of_challenge(p_challenge_id) then
    raise exception 'NOT_A_MEMBER';
  end if;

  return query
  select
    m.user_id,
    coalesce(p.user_name, 'User') as user_name
  from public.challenge_members m
  left join public.profiles p on p.id = m.user_id
  where m.challenge_id = p_challenge_id
  order by user_name asc nulls last;
end;
$function$;
