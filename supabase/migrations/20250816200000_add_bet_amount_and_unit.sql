-- Add per-fail bet amount and unit to challenges
ALTER TABLE public.challenges
ADD COLUMN IF NOT EXISTS bet_amount integer,
ADD COLUMN IF NOT EXISTS bet_unit text;

-- Optional: backfill bet_unit from bet_description when it looks like a simple unit
-- (No-op by default; keep data as-is)

COMMENT ON COLUMN public.challenges.bet_amount IS 'Per-fail stake amount (integer) used to compute debts)';
COMMENT ON COLUMN public.challenges.bet_unit IS 'Unit/label for the stake amount (e.g., EUR, Euro, Liegestützen)';


