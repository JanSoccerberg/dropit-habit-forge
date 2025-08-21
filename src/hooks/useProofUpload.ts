import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export function useProofUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadProof = async (
    challengeId: string,
    date: string,
    userId: string,
    file: File
  ): Promise<string | null> => {
    try {
      setIsUploading(true);
      setUploadProgress(0);

      // Generiere eindeutigen Dateinamen
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const storagePath = `proofs/${challengeId}/${date}/${userId}/${fileName}`;

      // Upload zur Supabase Storage
      const { data, error } = await supabase.storage
        .from('proofs')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Upload error:', error);
        
        let description = error.message;
        if (error.message.includes('Bucket not found')) {
          description = "Storage-Bucket 'proofs' existiert nicht. Bitte erstelle ihn im Supabase Dashboard.";
        }
        
        toast({
          title: "Upload fehlgeschlagen",
          description,
          variant: "destructive"
        });
        return null;
      }

      setUploadProgress(100);
      return storagePath;

    } catch (error) {
      console.error('Upload failed:', error);
      toast({
        title: "Upload fehlgeschlagen",
        description: "Unbekannter Fehler beim Hochladen",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Neue Funktion: Upload und Check-in in einem Schritt
  const uploadAndCheckIn = async (
    challengeId: string,
    date: string,
    userId: string,
    file: File | null,
    status: 'success' | 'fail'
  ): Promise<{ success: boolean; storagePath?: string }> => {
    try {
      setIsUploading(true);
      setUploadProgress(0);

      let storagePath: string | null = null;

      // Wenn eine Datei vorhanden ist, lade sie hoch
      if (file) {
        storagePath = await uploadProof(challengeId, date, userId, file);
        if (!storagePath) {
          return { success: false };
        }
      }

      // Jetzt führe den Check-in durch
      const { error } = await supabase.rpc("upsert_check_in_with_deadline", {
        p_challenge_id: challengeId,
        p_date: date,
        p_status: status,
        p_screenshot_name: storagePath,
        p_source: 'user'
      });

      if (error) {
        // Wenn der Check-in fehlschlägt, lösche das hochgeladene Bild
        if (storagePath) {
          await supabase.storage.from('proofs').remove([storagePath]);
        }
        
        let description = error.message;
        if (error.message.includes('SCREENSHOT_REQUIRED_FOR_SUCCESS')) {
          description = "Für diese Challenge ist ein Screenshot erforderlich";
        } else if (error.message.includes('CHECKIN_LOCKED_FINAL')) {
          description = "Dieser Tag wurde bereits final bewertet und kann nicht mehr geändert werden.";
        } else if (error.message.includes('CHECKIN_DEADLINE_PASSED')) {
          description = `Die Deadline für heute ist bereits abgelaufen.`;
        }
        
        toast({ 
          title: "Check-in fehlgeschlagen", 
          description, 
          variant: "destructive" 
        });
        return { success: false };
      }

      // Erfolg
      if (storagePath) {
        toast({
          title: "Check-in erfolgreich",
          description: "Bild hochgeladen und Check-in gespeichert",
        });
      } else {
        toast({
          title: "Check-in erfolgreich",
          description: "Check-in gespeichert",
        });
      }

      return { success: true, storagePath };

    } catch (error) {
      console.error('Upload and check-in failed:', error);
      toast({
        title: "Fehler",
        description: "Unbekannter Fehler beim Speichern",
        variant: "destructive"
      });
      return { success: false };
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return {
    uploadProof,
    uploadAndCheckIn,
    isUploading,
    uploadProgress
  };
}
