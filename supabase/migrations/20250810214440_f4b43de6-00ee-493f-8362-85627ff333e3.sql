-- 1) Make creator membership trigger function idempotent (avoid duplicates)
CREATE OR REPLACE FUNCTION public.add_creator_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  -- Ensure only one membership per (challenge_id, user_id)
  begin
    insert into public.challenge_members (challenge_id, user_id, role)
    values (new.id, new.creator_id, 'creator');
  exception when unique_violation then
    -- already present; do nothing
    null;
  end;
  return new;
end;
$function$;

-- 2) Ensure triggers exist for challenges
DROP TRIGGER IF EXISTS trg_challenges_before_insert ON public.challenges;
CREATE TRIGGER trg_challenges_before_insert
BEFORE INSERT ON public.challenges
FOR EACH ROW
EXECUTE FUNCTION public.challenges_before_insert();

DROP TRIGGER IF EXISTS trg_challenges_after_insert_creator ON public.challenges;
CREATE TRIGGER trg_challenges_after_insert_creator
AFTER INSERT ON public.challenges
FOR EACH ROW
EXECUTE FUNCTION public.add_creator_membership();

DROP TRIGGER IF EXISTS trg_challenges_updated_at ON public.challenges;
CREATE TRIGGER trg_challenges_updated_at
BEFORE UPDATE ON public.challenges
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Ensure triggers exist for profiles (defaults, validation, updated_at)
DROP TRIGGER IF EXISTS trg_profiles_before_insert ON public.profiles;
CREATE TRIGGER trg_profiles_before_insert
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.profiles_fill_defaults();

DROP TRIGGER IF EXISTS trg_profiles_before_update_validate ON public.profiles;
CREATE TRIGGER trg_profiles_before_update_validate
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.profiles_validate();

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Enforce one membership per user per challenge
CREATE UNIQUE INDEX IF NOT EXISTS uq_challenge_members_challenge_user
ON public.challenge_members (challenge_id, user_id);
