-- Create proofs storage bucket and RLS policies
-- This migration sets up secure storage for challenge proof images

-- Note: The bucket "proofs" needs to be created manually in Supabase Dashboard
-- Storage → New Bucket
-- Name: "proofs"
-- Public: false (privat)
-- File size limit: 10MB
-- Allowed MIME types: image/*

-- RLS Policies für den Bucket
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
