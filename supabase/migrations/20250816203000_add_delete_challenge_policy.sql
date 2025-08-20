-- Add RLS policy to allow challenge creators to delete their challenges
-- This will cascade delete related records (members, check-ins, stakes)

CREATE POLICY "Creator can delete their own challenge"
  ON public.challenges
  FOR DELETE
  TO authenticated
  USING (creator_id = auth.uid());

COMMENT ON POLICY "Creator can delete their own challenge" ON public.challenges IS 
  'Challenge creators can delete their own challenges, which will cascade delete related data';
