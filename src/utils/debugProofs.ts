import { supabase } from '@/integrations/supabase/client';

export async function debugProofs(challengeId: string, date: string) {
  console.log('🔍 Debug Proofs für:', { challengeId, date });
  
  try {
    // 1. Teste die get_day_proofs Funktion
    console.log('📋 Teste get_day_proofs RPC...');
    const { data: proofs, error: proofsError } = await supabase.rpc('get_day_proofs', {
      p_challenge_id: challengeId,
      p_date: date
    });
    
    if (proofsError) {
      console.error('❌ get_day_proofs Fehler:', proofsError);
    } else {
      console.log('✅ get_day_proofs Ergebnis:', proofs);
    }
    
    // 2. Teste direkte Abfrage der check_ins Tabelle
    console.log('📋 Teste direkte check_ins Abfrage...');
    const { data: checkIns, error: checkInsError } = await supabase
      .from('check_ins')
      .select('*')
      .eq('challenge_id', challengeId)
      .eq('date', date);
    
    if (checkInsError) {
      console.error('❌ check_ins Abfrage Fehler:', checkInsError);
    } else {
      console.log('✅ check_ins Ergebnis:', checkIns);
      
      // Prüfe speziell auf screenshot_name
      checkIns?.forEach((checkIn, index) => {
        console.log(`📸 Check-in ${index + 1}:`, {
          id: checkIn.id,
          user_id: checkIn.user_id,
          status: checkIn.status,
          screenshot_name: checkIn.screenshot_name,
          has_screenshot: !!checkIn.screenshot_name
        });
      });
    }
    
    // 3. Teste ob der Nutzer Mitglied der Challenge ist
    console.log('📋 Teste Challenge-Mitgliedschaft...');
    const { data: membership, error: membershipError } = await supabase
      .from('challenge_members')
      .select('*')
      .eq('challenge_id', challengeId)
      .eq('user_id', (await supabase.auth.getUser()).data.user?.id);
    
    if (membershipError) {
      console.error('❌ Mitgliedschafts-Abfrage Fehler:', membershipError);
    } else {
      console.log('✅ Mitgliedschaft:', membership);
    }
    
    // 4. Teste Storage-Zugriff
    console.log('📋 Teste Storage-Zugriff...');
    const { data: storageList, error: storageError } = await supabase.storage
      .from('proofs')
      .list('', { limit: 10 });
    
    if (storageError) {
      console.error('❌ Storage-Liste Fehler:', storageError);
    } else {
      console.log('✅ Storage-Inhalt:', storageList);
    }
    
    // 5. Teste spezifische Datei-Zugriffe
    if (checkIns && checkIns.length > 0) {
      console.log('📋 Teste Datei-Zugriffe...');
      for (const checkIn of checkIns) {
        if (checkIn.screenshot_name) {
          console.log(`🔍 Teste Zugriff auf: ${checkIn.screenshot_name}`);
          try {
            const { data: urlData, error: urlError } = await supabase.storage
              .from('proofs')
              .createSignedUrl(checkIn.screenshot_name, 3600);
            
            if (urlError) {
              console.error(`❌ URL-Fehler für ${checkIn.screenshot_name}:`, urlError);
            } else {
              console.log(`✅ URL erfolgreich für ${checkIn.screenshot_name}:`, urlData?.signedUrl?.substring(0, 50) + '...');
            }
          } catch (urlError) {
            console.error(`❌ URL-Exception für ${checkIn.screenshot_name}:`, urlError);
          }
        }
      }
    }
    
    return { 
      success: true, 
      proofs, 
      checkIns, 
      membership, 
      storageList 
    };
    
  } catch (error) {
    console.error('❌ Debug Fehler:', error);
    return { success: false, error: String(error) };
  }
}

export async function testStorageAccess() {
  console.log('🔍 Teste Storage-Zugriff...');
  
  try {
    // Teste ob wir den Bucket sehen können
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('❌ Bucket-Liste Fehler:', bucketsError);
      return false;
    }
    
    console.log('✅ Verfügbare Buckets:', buckets);
    
    const proofsBucket = buckets?.find(b => b.name === 'proofs');
    if (!proofsBucket) {
      console.error('❌ proofs Bucket nicht gefunden');
      return false;
    }
    
    console.log('✅ proofs Bucket gefunden:', proofsBucket);
    
    // Teste ob wir den Inhalt des Buckets sehen können
    const { data: files, error: filesError } = await supabase.storage
      .from('proofs')
      .list('', { limit: 5 });
    
    if (filesError) {
      console.error('❌ Datei-Liste Fehler:', filesError);
      return false;
    }
    
    console.log('✅ Dateien im proofs Bucket:', files);
    return true;
    
  } catch (error) {
    console.error('❌ Storage-Test Fehler:', error);
    return false;
  }
}
