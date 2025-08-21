-- Create proofs storage bucket if it doesn't exist
-- This ensures the bucket is available for uploads

-- Note: This migration should be run after manually creating the bucket in Supabase Dashboard
-- Storage → New Bucket
-- Name: "proofs"
-- Public: false (privat)
-- File size limit: 10MB
-- Allowed MIME types: image/*

-- The bucket creation itself needs to be done manually in the dashboard
-- This migration just ensures the policies are applied correctly

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Members can upload to their challenge folders" ON storage.objects;
DROP POLICY IF EXISTS "Members can view challenge proofs" ON storage.objects;
DROP POLICY IF EXISTS "Members can delete own uploads" ON storage.objects;

-- Create RLS Policies für den Bucket
-- Policy 1: Mitglieder können in ihre Challenge-Ordner schreiben
CREATE POLICY "Members can upload to their challenge folders"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'proofs' AND
  auth.uid()::text = (storage.foldername(name))[4] AND
  public.is_member_of_challenge((storage.foldername(name))[2]::uuid)
);

-- Policy 2: Mitglieder können alle Bilder ihrer Challenge lesen
CREATE POLICY "Members can view challenge proofs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'proofs' AND
  public.is_member_of_challenge((storage.foldername(name))[2]::uuid)
);

-- Policy 3: Mitglieder können ihre eigenen Uploads löschen (für Korrekturen)
CREATE POLICY "Members can delete own uploads"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'proofs' AND
  auth.uid()::text = (storage.foldername(name))[4]
);
