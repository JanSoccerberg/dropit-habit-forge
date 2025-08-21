# Proof Upload Setup Guide

## Übersicht
Diese Implementierung fügt Screenshot-Upload-Funktionalität zu Challenges hinzu. Nutzer können Bilder hochladen, die dann pro Kalendertag angezeigt werden.

## Manuelle Einrichtung

### 1. Storage Bucket erstellen
Im Supabase Dashboard:
1. Gehe zu **Storage** → **New Bucket**
2. Name: `proofs`
3. Public: `false` (privat)
4. File size limit: `10MB`
5. Allowed MIME types: `image/*`

### 2. Migrationen anwenden
```bash
# Im Projektverzeichnis
cd supabase
supabase db reset
# Oder einzelne Migrationen:
supabase migration up
```

## Funktionalität

### Screenshot-Pflicht
- Wenn `screenshot_required = true` bei einer Challenge gesetzt ist, muss beim Check-in ein Bild hochgeladen werden
- Der "Speichern"-Button ist deaktiviert, bis ein Bild hochgeladen wurde

### Upload-Flow
1. Nutzer wählt Bild aus (max. 10MB, nur Bilder)
2. Klickt "Hochladen" → Bild wird zu Supabase Storage hochgeladen
3. Nach erfolgreichem Upload kann der Check-in gespeichert werden

### Tages-Galerie
- Klick auf einen Kalendertag öffnet alle Beweise des Tages
- Zeigt Username, Upload-Zeit und das Bild
- Bilder können heruntergeladen werden
- Klick auf Bild öffnet Vollbild-Ansicht

## Technische Details

### Storage-Pfad
```
proofs/{challenge_id}/{YYYY-MM-DD}/{user_id}/{uuid}.{ext}
```

### RLS-Policies
- Mitglieder können in ihre Challenge-Ordner schreiben
- Mitglieder können alle Bilder ihrer Challenge lesen
- Mitglieder können ihre eigenen Uploads löschen

### Datenbank
- Nutzt bestehende `check_ins.screenshot_name` Spalte
- Neue RPC `get_day_proofs()` für Tages-Galerie
- Erweiterte `upsert_check_in_with_deadline()` mit Pflichtprüfung

## Fehlerbehandlung
- Dateigröße > 10MB → Toast-Fehlermeldung
- Kein Bild → Toast-Fehlermeldung
- Upload-Fehler → Toast-Fehlermeldung
- Screenshot-Pflicht nicht erfüllt → Check-in blockiert

## Sicherheit
- Nur Challenge-Mitglieder können Bilder hochladen/sehen
- Bilder sind privat (nicht öffentlich zugänglich)
- Signierte URLs für Bildanzeige (1 Stunde gültig)
