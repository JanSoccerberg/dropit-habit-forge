-- First, add new column with proper time type
ALTER TABLE public.challenges 
ADD COLUMN checkin_time_new time;

-- Update existing data: convert text to time (assuming format like "22:00")
UPDATE public.challenges 
SET checkin_time_new = checkin_time::time 
WHERE checkin_time ~ '^[0-9]{1,2}:[0-9]{2}$';

-- Set default for any invalid entries
UPDATE public.challenges 
SET checkin_time_new = '23:59'::time 
WHERE checkin_time_new IS NULL;

-- Make the new column not null
ALTER TABLE public.challenges 
ALTER COLUMN checkin_time_new SET NOT NULL;

-- Drop old column and rename new one
ALTER TABLE public.challenges 
DROP COLUMN checkin_time;

ALTER TABLE public.challenges 
RENAME COLUMN checkin_time_new TO checkin_time;

-- Add locked and source columns to check_ins table
CREATE TYPE checkin_source AS ENUM ('user', 'system_cron', 'admin');

ALTER TABLE public.check_ins 
ADD COLUMN locked boolean NOT NULL DEFAULT false,
ADD COLUMN source checkin_source NOT NULL DEFAULT 'user';

-- Add unique constraint to ensure one check-in per challenge/user/date
ALTER TABLE public.check_ins 
ADD CONSTRAINT unique_checkin_per_user_date 
UNIQUE (challenge_id, user_id, date);