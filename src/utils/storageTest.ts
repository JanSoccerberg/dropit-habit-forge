import { supabase } from '@/integrations/supabase/client';

export async function testStorageBucket(): Promise<{ exists: boolean; error?: string }> {
  try {
    // Versuche eine Liste der Buckets abzurufen
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      return { exists: false, error: error.message };
    }
    
    // Prüfe ob der "proofs" Bucket existiert
    const proofsBucket = buckets?.find(bucket => bucket.name === 'proofs');
    
    if (!proofsBucket) {
      return { exists: false, error: 'Bucket "proofs" nicht gefunden' };
    }
    
    // Versuche eine Liste der Objekte im Bucket abzurufen (sollte funktionieren wenn Policies korrekt sind)
    const { error: listError } = await supabase.storage
      .from('proofs')
      .list('', { limit: 1 });
    
    if (listError) {
      return { exists: true, error: `Bucket existiert aber Policies sind fehlerhaft: ${listError.message}` };
    }
    
    return { exists: true };
    
  } catch (error) {
    return { exists: false, error: `Unbekannter Fehler: ${error}` };
  }
}

export async function createTestFile(): Promise<{ success: boolean; error?: string }> {
  try {
    // Erstelle eine kleine Test-Datei
    const testContent = 'test';
    const testFile = new File([testContent], 'test.txt', { type: 'text/plain' });
    
    const { error } = await supabase.storage
      .from('proofs')
      .upload('test/test.txt', testFile);
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    // Lösche die Test-Datei wieder
    await supabase.storage.from('proofs').remove(['test/test.txt']);
    
    return { success: true };
    
  } catch (error) {
    return { success: false, error: `Test fehlgeschlagen: ${error}` };
  }
}

// Neue Funktion: Teste ob wir auf hochgeladene Dateien zugreifen können
export async function testFileAccess(filePath: string): Promise<{ success: boolean; signedUrl?: string; error?: string }> {
  try {
    console.log('🔍 Teste Datei-Zugriff für:', filePath);
    
    // Versuche eine signierte URL zu generieren
    const { data, error } = await supabase.storage
      .from('proofs')
      .createSignedUrl(filePath, 3600);
    
    if (error) {
      console.error('❌ Fehler beim Generieren der signierten URL:', error);
      return { success: false, error: error.message };
    }
    
    if (!data?.signedUrl) {
      return { success: false, error: 'Keine signierte URL erhalten' };
    }
    
    console.log('✅ Signierte URL generiert:', data.signedUrl);
    return { success: true, signedUrl: data.signedUrl };
    
  } catch (error) {
    console.error('❌ Unbekannter Fehler beim Testen des Datei-Zugriffs:', error);
    return { success: false, error: String(error) };
  }
}

// Funktion: Liste alle Dateien im proofs Bucket auf
export async function listAllProofs(): Promise<{ success: boolean; files?: any[]; error?: string }> {
  try {
    console.log('🔍 Liste alle Dateien im proofs Bucket auf...');
    
    const { data, error } = await supabase.storage
      .from('proofs')
      .list('', { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });
    
    if (error) {
      console.error('❌ Fehler beim Auflisten der Dateien:', error);
      return { success: false, error: error.message };
    }
    
    console.log('✅ Dateien gefunden:', data);
    return { success: true, files: data };
    
  } catch (error) {
    console.error('❌ Unbekannter Fehler beim Auflisten:', error);
    return { success: false, error: String(error) };
  }
}
