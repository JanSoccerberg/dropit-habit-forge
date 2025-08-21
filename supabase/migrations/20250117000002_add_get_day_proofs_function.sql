-- Create function to get all proofs for a specific day in a challenge
-- This will be used to display all uploaded images for a calendar day

CREATE OR REPLACE FUNCTION public.get_day_proofs(
  p_challenge_id uuid,
  p_date date
)
RETURNS TABLE(
  user_id uuid,
  username text,
  screenshot_name text,
  status checkin_status,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF NOT public.is_member_of_challenge(p_challenge_id) THEN
    RAISE EXCEPTION 'NOT_A_MEMBER';
  END IF;

  RETURN QUERY
  SELECT 
    ci.user_id,
    COALESCE(p.username, 'Unbekannt') as username,
    ci.screenshot_name,
    ci.status,
    ci.created_at
  FROM public.check_ins ci
  LEFT JOIN public.profiles p ON p.user_id = ci.user_id
  WHERE ci.challenge_id = p_challenge_id 
    AND ci.date = p_date
    AND ci.screenshot_name IS NOT NULL
  ORDER BY ci.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_day_proofs TO authenticated;
