-- Update get_user_calendar function to include locked, source, and created_at
CREATE OR REPLACE FUNCTION public.get_user_calendar(p_challenge_id uuid, p_user_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(date date, status checkin_status, locked boolean, source checkin_source, created_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  select ci."date", ci.status, ci.locked, ci.source, ci.created_at
  from public.check_ins ci
  where ci.challenge_id = p_challenge_id
    and ci.user_id = v_user
  order by ci."date";
end;
$$;