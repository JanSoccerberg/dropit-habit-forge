# Storage Bucket Setup - Schritt für Schritt

## Problem
Der Fehler "Bucket not found" tritt auf, weil der Storage-Bucket "proofs" noch nicht existiert.

## Lösung: Storage Bucket manuell erstellen

### 1. Supabase Dashboard öffnen
1. Gehe zu [supabase.com](https://supabase.com)
2. Wähle dein Projekt aus
3. Klicke auf **Storage** im linken Menü

### 2. Neuen Bucket erstellen
1. Klicke auf **"New Bucket"**
2. Fülle die Felder aus:
   - **Name:** `proofs`
   - **Public:** `false` (unbedingt auf false setzen!)
   - **File size limit:** `10MB`
   - **Allowed MIME types:** `image/*`
3. Klicke auf **"Create bucket"**

### 3. RLS-Policies anwenden
Nach dem Erstellen des Buckets werden automatisch die RLS-Policies aus der Migration angewendet.

### 4. Migrationen anwenden
```bash
# Im Projektverzeichnis
cd supabase
npx supabase db push
```

## Alternative: Über SQL Editor
Falls die Migrationen nicht funktionieren, kannst du die Policies manuell im SQL Editor erstellen:

```sql
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

-- Policy 3: Mitglieder können ihre eigenen Uploads löschen
CREATE POLICY "Members can delete own uploads"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'proofs' AND
  auth.uid()::text = (storage.foldername(name))[4]
);
```

## Testen
Nach der Einrichtung:
1. Erstelle eine Challenge mit Screenshot-Pflicht
2. Versuche einen Check-in mit Bild-Upload
3. Der Fehler "Bucket not found" sollte verschwunden sein

## Wichtige Hinweise
- Der Bucket muss **unbedingt privat** sein (Public: false)
- Die Dateigröße ist auf 10MB begrenzt
- Nur Bilddateien sind erlaubt
- RLS-Policies stellen sicher, dass nur Challenge-Mitglieder Zugriff haben
