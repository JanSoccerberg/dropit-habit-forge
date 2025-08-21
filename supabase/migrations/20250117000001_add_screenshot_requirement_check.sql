-- Add screenshot requirement checking to existing upsert_check_in_with_deadline function
-- This ensures that when screenshot_required is true, a screenshot_name must be provided

CREATE OR REPLACE FUNCTION public.upsert_check_in_with_deadline(
  p_challenge_id uuid, 
  p_date date, 
  p_status checkin_status, 
  p_screenshot_name text DEFAULT NULL,
  p_source checkin_source DEFAULT 'user',
  p_user_id uuid DEFAULT NULL
)
RETURNS check_ins
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := COALESCE(p_user_id, auth.uid());
  v_row public.check_ins;
  v_challenge public.challenges;
  v_deadline timestamp with time zone;
  v_now timestamp with time zone := now();
  v_existing_row public.check_ins;
BEGIN
  -- Get challenge details
  SELECT * INTO v_challenge FROM public.challenges WHERE id = p_challenge_id;
  IF v_challenge.id IS NULL THEN
    RAISE EXCEPTION 'CHALLENGE_NOT_FOUND';
  END IF;

  -- For system operations, user can be provided directly
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'USER_ID_REQUIRED';
  END IF;

  -- For user operations, check membership (skip for system_cron)
  IF p_source = 'user' AND NOT public.is_member_of_challenge(p_challenge_id) THEN
    RAISE EXCEPTION 'NOT_A_MEMBER';
  END IF;

  -- Check screenshot requirement for success check-ins
  IF p_source = 'user' AND p_status = 'success' AND v_challenge.screenshot_required AND p_screenshot_name IS NULL THEN
    RAISE EXCEPTION 'SCREENSHOT_REQUIRED_FOR_SUCCESS';
  END IF;

  -- Check if existing entry is locked
  SELECT * INTO v_existing_row 
  FROM public.check_ins 
  WHERE challenge_id = p_challenge_id 
    AND user_id = v_user
    AND date = p_date;

  IF v_existing_row.id IS NOT NULL AND v_existing_row.locked AND p_source = 'user' THEN
    RAISE EXCEPTION 'CHECKIN_LOCKED_FINAL';
  END IF;

  -- Calculate deadline for the date (date + checkin_time in UTC)
  v_deadline := (p_date + v_challenge.checkin_time) AT TIME ZONE 'UTC';

  -- For user check-ins, verify deadline hasn't passed
  IF p_source = 'user' AND p_status = 'success' AND v_now > v_deadline THEN
    RAISE EXCEPTION 'CHECKIN_DEADLINE_PASSED';
  END IF;

  -- Upsert the check-in
  INSERT INTO public.check_ins (challenge_id, user_id, date, status, screenshot_name, source, locked)
  VALUES (p_challenge_id, v_user, p_date, p_status, p_screenshot_name, p_source, 
          CASE WHEN p_source = 'system_cron' THEN true ELSE false END)
  ON CONFLICT (challenge_id, user_id, date)
  DO UPDATE SET
    status = CASE 
      WHEN check_ins.locked THEN check_ins.status 
      ELSE excluded.status 
    END,
    screenshot_name = CASE 
      WHEN check_ins.locked THEN check_ins.screenshot_name 
      ELSE excluded.screenshot_name 
    END,
    source = CASE 
      WHEN check_ins.locked THEN check_ins.source 
      ELSE excluded.source 
    END,
    locked = CASE 
      WHEN check_ins.locked THEN true 
      ELSE excluded.locked 
    END,
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;
