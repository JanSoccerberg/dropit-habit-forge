-- Create/refresh triggers for challenges
-- Ensures: join_code auto-generation, updated_at maintenance, and automatic creator membership

-- 1) BEFORE INSERT: auto-generate join_code
DROP TRIGGER IF EXISTS trg_challenges_before_insert_join_code ON public.challenges;
CREATE TRIGGER trg_challenges_before_insert_join_code
BEFORE INSERT ON public.challenges
FOR EACH ROW
EXECUTE FUNCTION public.challenges_before_insert();

-- 2) BEFORE UPDATE: maintain updated_at
DROP TRIGGER IF EXISTS trg_challenges_before_update_updated_at ON public.challenges;
CREATE TRIGGER trg_challenges_before_update_updated_at
BEFORE UPDATE ON public.challenges
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 3) AFTER INSERT: create creator membership automatically
DROP TRIGGER IF EXISTS trg_challenges_after_insert_creator_membership ON public.challenges;
CREATE TRIGGER trg_challenges_after_insert_creator_membership
AFTER INSERT ON public.challenges
FOR EACH ROW
EXECUTE FUNCTION public.add_creator_membership();

-- 4) Backfill: insert missing creator memberships for existing challenges
INSERT INTO public.challenge_members (challenge_id, user_id, role)
SELECT c.id, c.creator_id, 'creator'
FROM public.challenges c
LEFT JOIN public.challenge_members m
  ON m.challenge_id = c.id AND m.user_id = c.creator_id
WHERE m.id IS NULL;