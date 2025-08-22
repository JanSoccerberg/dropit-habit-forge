import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { X, Download } from 'lucide-react';

interface DayProof {
  user_id: string;
  username: string;
  screenshot_name: string;
  status: 'success' | 'fail';
  created_at: string;
}

interface DayProofsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  challengeId: string;
  date: string;
}

export function DayProofsModal({ open, onOpenChange, challengeId, date }: DayProofsModalProps) {
  const [proofs, setProofs] = useState<DayProof[]>([]);
  const [loading, setLoading] = useState(false);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    if (open && challengeId && date) {
      loadDayProofs();
    }
  }, [open, challengeId, date]);

  const loadDayProofs = async () => {
    setLoading(true);
    try {

      
              // Versuche zuerst die RPC-Funktion
        let data = null;
        let error = null;
        
        try {
          const result = await supabase.rpc('get_day_proofs', {
            p_challenge_id: challengeId,
            p_date: date
          });
          data = result.data;
          error = result.error;
        } catch (rpcError) {
          console.error('RPC-Aufruf fehlgeschlagen:', rpcError);
          error = rpcError;
        }

        // Fallback: Direkte Abfrage wenn RPC fehlschlägt
        if (error || !data) {
          console.log('Verwende Fallback-Abfrage...');
          const fallbackResult = await supabase
            .from('check_ins')
            .select(`
              user_id,
              screenshot_name,
              status,
              created_at,
              profiles!inner(username)
            `)
            .eq('challenge_id', challengeId)
            .eq('date', date)
            .not('screenshot_name', 'is', null);
          
          if (fallbackResult.error) {
            console.error('Fallback-Abfrage fehlgeschlagen:', fallbackResult.error);
            setProofs([]);
            setImageUrls({});
            return;
          }
          
          // Konvertiere das Ergebnis in das erwartete Format
          data = fallbackResult.data?.map((item: any) => ({
            user_id: item.user_id,
            username: item.profiles?.username || 'Unbekannt',
            screenshot_name: item.screenshot_name,
            status: item.status,
            created_at: item.created_at
          })) || [];
        }

      setProofs(data || []);
      
      // Generiere signierte URLs für alle Bilder
      const urls: Record<string, string> = {};
      for (const proof of data || []) {
        const { data: urlData, error: urlError } = await supabase.storage
          .from('proofs')
          .createSignedUrl(proof.screenshot_name, 3600); // 1 Stunde gültig
        
        if (urlError) {
          console.error('URL-Generierung Fehler für', proof.screenshot_name, ':', urlError);
        } else if (urlData?.signedUrl) {
          urls[proof.screenshot_name] = urlData.signedUrl;
        }
      }
      setImageUrls(urls);

    } catch (error) {
      console.error('Failed to load day proofs:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const downloadImage = async (storagePath: string, username: string) => {
    try {
      const { data } = await supabase.storage
        .from('proofs')
        .createSignedUrl(storagePath, 3600);
      
      if (data?.signedUrl) {
        const link = document.createElement('a');
        link.href = data.signedUrl;
        link.download = `beweis_${username}_${date}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
          <DialogTitle>Beweise für {formatDate(date)}</DialogTitle>

        </DialogHeader>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-24 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : proofs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-lg">
                Keine Beweise für diesen Tag vorhanden
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Teilnehmer können ihre Screenshots beim Check-in hochladen
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {proofs.map((proof) => (
                <div key={proof.screenshot_name} className="space-y-3 p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>
                          {proof.username.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{proof.username}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(proof.created_at)} um {formatTime(proof.created_at)}
                        </p>
                      </div>
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadImage(proof.screenshot_name, proof.username)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Herunterladen
                    </Button>
                  </div>
                  
                  {imageUrls[proof.screenshot_name] && (
                    <div className="relative">
                      <img
                        src={imageUrls[proof.screenshot_name]}
                        alt={`Beweis von ${proof.username}`}
                        className="w-full rounded-lg border cursor-pointer hover:opacity-90 transition-opacity"
                        loading="lazy"
                        onClick={() => setSelectedImage(imageUrls[proof.screenshot_name])}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Lightbox für Vollbild-Ansicht */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-full max-h-full">
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-4 right-4 text-white hover:bg-white/20"
              onClick={() => setSelectedImage(null)}
            >
              <X className="h-6 w-6" />
            </Button>
            <img
              src={selectedImage}
              alt="Vollbild-Ansicht"
              className="max-w-full max-h-full object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}
