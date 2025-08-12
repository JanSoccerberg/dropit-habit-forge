
-- 1) Add user_name to profiles and backfill from existing fields
alter table public.profiles
  add column if not exists user_name text not null default 'User';

-- Backfill: prefer display_name, then name, else keep existing default
update public.profiles p
set user_name = coalesce(nullif(btrim(p.display_name), ''), nullif(btrim(p.name), ''), p.user_name)
where p.user_name is null or p.user_name = 'User';

-- 2) Ensure new profiles use user_name
create or replace function public.ensure_profile_exists()
returns void
language plpgsql
security definer
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

-- 3) Leaderboards: include user_name
create or replace function public.get_success_counts(p_challenge_id uuid)
returns table(user_id uuid, user_name text, days integer)
language plpgsql
security definer
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
  join public.profiles p on p.id = ci.user_id
  where ci.challenge_id = p_challenge_id
    and ci.status = 'success'
  group by ci.user_id, p.user_name
  order by days desc, user_name asc;
end;
$function$;

create or replace function public.get_fail_counts(p_challenge_id uuid)
returns table(user_id uuid, user_name text, days integer)
language plpgsql
security definer
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
  join public.profiles p on p.id = ci.user_id
  where ci.challenge_id = p_challenge_id
    and ci.status = 'fail'
  group by ci.user_id, p.user_name
  order by days desc, user_name asc;
end;
$function$;
