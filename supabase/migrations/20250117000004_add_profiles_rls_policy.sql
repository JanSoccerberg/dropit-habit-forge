-- Add RLS policy to profiles table to allow authenticated users to read usernames
-- This is crucial for the get_day_proofs RPC to correctly fetch usernames

-- Enable RLS on profiles table if not already enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it conflicts or is too restrictive
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile." ON public.profiles;

-- Policy: Allow authenticated users to read all profiles (or at least their username)
-- This policy is broad enough to allow the RPC to fetch usernames for all members of a challenge.
CREATE POLICY "Authenticated users can read profiles" ON public.profiles
  FOR SELECT USING (auth.role() = 'authenticated');

-- Optional: If you want more restrictive policies, you might need to adjust this.
-- For example, only allow reading profiles of challenge members:
-- CREATE POLICY "Challenge members can read other members profiles" ON public.profiles
--   FOR SELECT USING (EXISTS (SELECT 1 FROM public.challenge_members cm WHERE cm.user_id = auth.uid() AND cm.challenge_id IN (SELECT ci.challenge_id FROM public.check_ins ci WHERE ci.user_id = profiles.id)));
