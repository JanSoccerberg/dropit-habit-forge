-- 1) Helper functions to avoid RLS recursion
create or replace function public.is_member_of_challenge(p_challenge_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.challenge_members
    where challenge_id = p_challenge_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_creator_of_challenge(p_challenge_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.challenges
    where id = p_challenge_id and creator_id = auth.uid()
  );
$$;

-- 2) Replace flawed RLS policies on challenge_members
alter table public.challenge_members enable row level security;

-- Drop existing policies if they exist (use IF EXISTS to be idempotent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'challenge_members' AND policyname = 'Members can view members of own challenges'
  ) THEN
    DROP POLICY "Members can view members of own challenges" ON public.challenge_members;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'challenge_members' AND policyname = 'Users can insert their own membership'
  ) THEN
    DROP POLICY "Users can insert their own membership" ON public.challenge_members;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'challenge_members' AND policyname = 'Creators can remove members'
  ) THEN
    DROP POLICY "Creators can remove members" ON public.challenge_members;
  END IF;
END$$;

-- Recreate safe policies
create policy "Members can view members of own challenges"
  on public.challenge_members
  for select
  using (public.is_member_of_challenge(challenge_id));

create policy "Users can insert their own membership"
  on public.challenge_members
  for insert
  with check (user_id = auth.uid());

create policy "Creators can remove members"
  on public.challenge_members
  for delete
  using (public.is_creator_of_challenge(challenge_id));

-- 3) Replace flawed RLS policies on challenges
alter table public.challenges enable row level security;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'challenges' AND policyname = 'Members can view challenge'
  ) THEN
    DROP POLICY "Members can view challenge" ON public.challenges;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'challenges' AND policyname = 'Creator can insert challenge'
  ) THEN
    DROP POLICY "Creator can insert challenge" ON public.challenges;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'challenges' AND policyname = 'Creator can update challenge'
  ) THEN
    DROP POLICY "Creator can update challenge" ON public.challenges;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'challenges' AND policyname = 'Creator can delete challenge'
  ) THEN
    DROP POLICY "Creator can delete challenge" ON public.challenges;
  END IF;
END$$;

create policy "Members can view challenge"
  on public.challenges
  for select
  using (
    creator_id = auth.uid() OR public.is_member_of_challenge(id)
  );

create policy "Creator can insert challenge"
  on public.challenges
  for insert
  with check (creator_id = auth.uid());

create policy "Creator can update challenge"
  on public.challenges
  for update
  using (creator_id = auth.uid())
  with check (creator_id = auth.uid());

create policy "Creator can delete challenge"
  on public.challenges
  for delete
  using (creator_id = auth.uid());

-- 4) Attach missing triggers
-- challenges: before insert (generate join_code), before update (updated_at), after insert (add creator membership)
DO $$
BEGIN
  -- drop if exists then create to be idempotent
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_challenges_before_insert') THEN
    DROP TRIGGER trg_challenges_before_insert ON public.challenges;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_challenges_updated_at') THEN
    DROP TRIGGER trg_challenges_updated_at ON public.challenges;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_challenges_add_creator') THEN
    DROP TRIGGER trg_challenges_add_creator ON public.challenges;
  END IF;
END$$;

create trigger trg_challenges_before_insert
before insert on public.challenges
for each row
execute function public.challenges_before_insert();

create trigger trg_challenges_updated_at
before update on public.challenges
for each row
execute function public.update_updated_at_column();

create trigger trg_challenges_add_creator
after insert on public.challenges
for each row
execute function public.add_creator_membership();

-- profiles: validation, defaults, updated_at
alter table public.profiles enable row level security;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_profiles_validate') THEN
    DROP TRIGGER trg_profiles_validate ON public.profiles;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_profiles_fill_defaults') THEN
    DROP TRIGGER trg_profiles_fill_defaults ON public.profiles;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_profiles_updated_at') THEN
    DROP TRIGGER trg_profiles_updated_at ON public.profiles;
  END IF;
END$$;

create trigger trg_profiles_validate
before insert or update on public.profiles
for each row
execute function public.profiles_validate();

create trigger trg_profiles_fill_defaults
before insert on public.profiles
for each row
execute function public.profiles_fill_defaults();

create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute function public.update_updated_at_column();