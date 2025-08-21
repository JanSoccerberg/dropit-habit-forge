# Proof Upload - Schnelle Einrichtung

## Fehler beheben: "Bucket not found"

Der Fehler tritt auf, weil der Storage-Bucket "proofs" noch nicht existiert.

### Lösung in 3 Schritten:

#### 1. Storage Bucket erstellen
- Gehe zu [supabase.com](https://supabase.com)
- Wähle dein Projekt
- Klicke auf **Storage** → **New Bucket**
- **Name:** `proofs`
- **Public:** `false` (wichtig!)
- **File size limit:** `10MB`
- **Allowed MIME types:** `image/*`
- Klicke **Create bucket**

#### 2. Migrationen anwenden
```bash
cd supabase
npx supabase db push
```

#### 3. Testen
- Erstelle eine Challenge mit Screenshot-Pflicht
- Versuche Check-in mit Bild-Upload
- Der Fehler sollte verschwunden sein

## Was wurde implementiert:

✅ **Upload + Speichern in einem Button** - Kein separater Upload-Button mehr
✅ **Screenshot-Pflicht** - Wird serverseitig erzwungen  
✅ **Tages-Galerie** - Alle Beweise eines Tages mit Username
✅ **Vollbild-Ansicht** - Klick auf Bild öffnet Lightbox
✅ **Download-Funktion** - Bilder können heruntergeladen werden

## Funktionalität:

1. **Bild auswählen** → Datei-Input
2. **SPEICHERN klicken** → Upload + Check-in in einem Schritt
3. **Kalender-Tag klicken** → Tages-Galerie mit allen Beweisen

## Sicherheit:
- Nur Challenge-Mitglieder haben Zugriff
- Bilder sind privat (nicht öffentlich)
- RLS-Policies schützen vor unbefugtem Zugriff
