-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the auto-fail-checkins function to run daily at 2:00 AM UTC
-- This ensures it runs after all possible check-in times for the previous day
SELECT cron.schedule(
  'auto-fail-checkins-daily',
  '0 2 * * *', -- Every day at 2:00 AM UTC
  $$
  SELECT
    net.http_post(
        url := 'https://adjwxqbdglbffzmqvmmt.supabase.co/functions/v1/auto-fail-checkins',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkand4cWJkZ2xiZmZ6bXF2bW10Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDc0NzQzNSwiZXhwIjoyMDcwMzIzNDM1fQ.gKlST2GVNH1VRdJbLEX6p8fW7OQpEo-3dxKtBWRXJNE"}'::jsonb,
        body := '{"source": "cron"}'::jsonb
    ) AS request_id;
  $$
);

-- Create a function to check cron job status (useful for debugging)
CREATE OR REPLACE FUNCTION public.get_cron_jobs()
RETURNS TABLE(jobid bigint, schedule text, command text, nodename text, nodeport integer, database text, username text, active boolean, jobname text)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT * FROM cron.job;
$$;

-- Grant permission to view cron jobs for debugging
GRANT EXECUTE ON FUNCTION public.get_cron_jobs() TO authenticated;