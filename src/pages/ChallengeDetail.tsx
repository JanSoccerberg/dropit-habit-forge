import SEO from "@/components/SEO";
import MobileShell from "@/components/layout/MobileShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useParams } from "react-router-dom";
import { useChallengesStore, api } from "@/store/challenges";
import ProgressRing from "@/components/ProgressRing";
import { daysBetween, todayStr, toISODate } from "@/utils/date";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useEffect, useState } from "react";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useChallengeStats } from "@/hooks/useChallengeStats";
import ChallengeParticipants from "@/components/ChallengeParticipants";
import { useNavigate } from "react-router-dom";
import { nanoid } from "nanoid";

export default function ChallengeDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const challenge = useChallengesStore((s) => s.challenges[id!]);
  const progress = useChallengesStore((s) => s.getChallengeProgress(id!));
  const participation = useChallengesStore((s) => s.getUserParticipation(id!));
  const user = useChallengesStore((s) => s.user);
  const checkIns = useChallengesStore((s) => s.checkIns);
  const { user: authUser } = useSupabaseAuth();

  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<"success" | "fail">("success");
  const [fileObj, setFileObj] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string | undefined>(undefined);
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [attemptedFetch, setAttemptedFetch] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Modal für Tagesliste
  const [dayOpen, setDayOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayLoading, setDayLoading] = useState(false);
  const [dayError, setDayError] = useState<string | null>(null);
  const [dayItems, setDayItems] = useState<Array<{
    user_id: string;
    user_name: string;
    status: "success" | "fail";
    screenshot_name: string | null;
    signed_url?: string | null;
  }>>([]);

  const stats = useChallengeStats(id);

  if (!challenge) return <MobileShell title="Challenge"><p className="text-muted-foreground">{authUser && !attemptedFetch ? "Lade Challenge…" : "Challenge nicht gefunden."}</p></MobileShell>;

  const days = daysBetween(challenge.startDate, challenge.endDate);
  const userId = user.id;
  const getStatus = (dateISO: string) => {
    const key = `${id}:${userId}:${dateISO}`;
    return checkIns[key]?.status;
  };

  const getCheckIn = (dateISO: string) => {
    const key = `${id}:${userId}:${dateISO}`;
    return checkIns[key];
  };

  const today = todayStr();
  const todayStatus = getStatus(today);

  // Merge DB calendar into local store for current user
  useEffect(() => {
    if (!stats.calendar.data || !id) return;
    useChallengesStore.setState((s) => {
      const next = { ...s.checkIns };
      stats.calendar.data!.forEach((row: any) => {
        const key = `${id}:${userId}:${row.date}`;
        const prev = next[key];
        next[key] = {
          id: prev?.id ?? key,
          challengeId: id,
          userId,
          date: row.date,
          status: row.status,
          screenshotName: prev?.screenshotName,
          locked: row.locked || false,
          source: row.source || 'user',
          createdAt: row.created_at || prev?.createdAt,
        };
      });
      return { checkIns: next };
    });
  }, [stats.calendar.data, id, userId]);

  // Fallback: Falls Challenge lokal fehlt, aus der DB (Mitgliedschaft) nachladen
  useEffect(() => {
    let cancelled = false;
    const loadIfMissing = async () => {
      if (challenge || !authUser || !id) return;
      const { data } = await supabase
        .from("challenge_members")
        .select("challenges ( id, title, description, start_date, end_date, checkin_time, screenshot_required, bet_description, bet_amount, bet_unit, bet_rule, join_code, creator_id, created_at )")
        .eq("challenge_id", id)
        .maybeSingle();

      if (cancelled) return;
      const ch = (data as any)?.challenges;
      if (ch && ch.id) {
        api.addChallengeFromDB(ch);
      }
      setAttemptedFetch(true);
    };
    loadIfMissing();
    return () => { (cancelled = true); };
  }, [challenge, authUser, id]);

  useEffect(() => {
    let cancelled = false;
    const fetchCode = async () => {
      if (!authUser || !id) return;
      const { data, error } = await supabase
        .from("challenges")
        .select("join_code")
        .eq("id", id)
        .maybeSingle();
      if (!cancelled) {
        if (error) {
          console.warn("join_code fetch error:", error);
        } else {
          setJoinCode(data?.join_code ?? null);
        }
      }
    };
    fetchCode();
    return () => { (cancelled = true); };
  }, [authUser, id]);

  const onConfirm = async () => {
    if (!id) return;
    const today = todayStr();

    // Check if today's check-in is locked
    const todayKey = `${id}:${userId}:${today}`;
    const existingCheckIn = checkIns[todayKey];
    if (existingCheckIn?.locked) {
      toast({ 
        title: "Check‑in nicht möglich", 
        description: "Dieser Tag wurde bereits final bewertet und kann nicht mehr geändert werden.", 
        variant: "destructive" 
      });
      setOpen(false);
      return;
    }

    let uploadedPath: string | null = null;

    try {
      // 1. Optional: Bild hochladen
      if (authUser && result === "success" && fileObj) {
        setUploading(true);
        const ext = (fileObj.name.split(".").pop() || "jpg").toLowerCase();
        const rand = nanoid(10);
        const path = `checkins/${id}/${authUser.id}/${today}/${rand}.${ext}`;
        
        const { error: upErr } = await supabase
          .storage
          .from("checkins")
          .upload(path, fileObj, {
            cacheControl: "31536000",
            contentType: fileObj.type || "image/jpeg",
            upsert: false,
          });
        
        if (upErr) throw upErr;
        uploadedPath = path;
      }

      // 2. Persist Check-in (mit gespeichertem Pfad)
      if (!authUser) {
        toast({ title: "Bitte einloggen", description: "Check‑ins werden nur mit Login gespeichert.", variant: "destructive" });
      } else {
        const { data: newCheckIn, error } = await supabase.rpc("upsert_check_in_with_deadline", {
          p_challenge_id: id,
          p_date: today,
          p_status: result,
          p_screenshot_name: uploadedPath ?? null,
          p_source: 'user'
        });
        
        if (error) {
          let description = error.message;
          if (error.message.includes('CHECKIN_LOCKED_FINAL')) {
            description = "Dieser Check-in wurde bereits final bewertet und kann nicht mehr geändert werden.";
          } else if (error.message.includes('CHECKIN_DEADLINE_PASSED')) {
            description = `Die Deadline für heute (${challenge.checkInTime} Uhr) ist bereits abgelaufen.`;
          }
          toast({ title: "Check‑in fehlgeschlagen", description, variant: "destructive" });
          return;
        }

        // 3. Store mit DB-Daten aktualisieren
        if (newCheckIn && newCheckIn.length > 0) {
          api.updateCheckInFromDB(newCheckIn[0]);
        }
      }

      // 4. Lokalen Store aktualisieren
      try {
        api.checkIn(id!, result, uploadedPath ?? undefined);
        setOpen(false);
        setFileObj(null);
        toast({ title: "Check‑in gespeichert" });
      } catch (error: any) {
        if (error.message === 'CHECKIN_LOCKED_FINAL') {
          toast({ 
            title: "Check‑in nicht möglich", 
            description: "Dieser Tag wurde bereits final bewertet.", 
            variant: "destructive" 
          });
          setOpen(false);
        }
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({ 
        title: "Upload fehlgeschlagen", 
        description: error.message || "Bild konnte nicht hochgeladen werden.", 
        variant: "destructive" 
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteChallenge = async () => {
    if (!id || !authUser) return;
    
    setIsDeleting(true);
    try {
      // Delete from Supabase first
      const { error } = await supabase
        .from("challenges")
        .delete()
        .eq("id", id);
      
      if (error) {
        throw error;
      }
      
      // Remove from local store
      api.deleteChallenge(id);
      
      toast({ title: "Challenge gelöscht", description: "Die Challenge wurde erfolgreich gelöscht." });
      navigate("/");
    } catch (error: any) {
      console.error("Error deleting challenge:", error);
      toast({ 
        title: "Fehler beim Löschen", 
        description: error.message || "Die Challenge konnte nicht gelöscht werden.", 
        variant: "destructive" 
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  // Tagesdaten laden, wenn Dialog geöffnet und Datum gewählt
  useEffect(() => {
    const loadDayCheckins = async () => {
      if (!authUser || !id || !selectedDate || !dayOpen) return;
      
      setDayLoading(true);
      setDayError(null);
      
      try {
        const { data, error } = await supabase.rpc('get_day_checkins', {
          p_challenge_id: id,
          p_date: selectedDate
        });
        
        if (error) throw error;

        // Signierte URLs für Bilder generieren
        const withUrls = await Promise.all(
          data.map(async (item) => {
            if (!item.screenshot_name) return { ...item, signed_url: null };
            
            const { data: urlData, error: urlErr } = await supabase
              .storage
              .from('checkins')
              .createSignedUrl(item.screenshot_name, 3600);
              
            if (urlErr) {
              console.warn("Signed URL error:", urlErr);
              return { ...item, signed_url: null };
            }
            
            return { ...item, signed_url: urlData?.signedUrl ?? null };
          })
        );

        setDayItems(withUrls);
      } catch (e: any) {
        setDayError(e.message || "Konnte Tagesdaten nicht laden.");
      } finally {
        setDayLoading(false);
      }
    };
    
    loadDayCheckins();
  }, [authUser, id, selectedDate, dayOpen]);

  return (
    <MobileShell title={challenge.title}>
      <SEO title={`DropIt – ${challenge.title}`} description="Challenge-Details und Check‑ins." />

      <Card>
        <CardContent className="p-4 flex items-center gap-4">
          <ProgressRing percent={progress.percent} size={84} thickness={12} fillColor={todayStatus === "success" ? "hsl(var(--success))" : "hsl(var(--primary))"} />
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">{challenge.startDate} – {challenge.endDate}</p>
            <p className="font-semibold">Fortschritt: {progress.elapsed} / {progress.total} Tage</p>
            <p className="text-xs text-muted-foreground">Check‑in täglich bis {challenge.checkInTime} Uhr</p>
          </div>
        </CardContent>
      </Card>

      {(challenge.stakeText || challenge.stakeAmount) && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm">Einsatz: <span className="font-medium">{challenge.stakeAmount ? `${challenge.stakeAmount} ${challenge.stakeUnit ?? ''}` : ''}{challenge.stakeText ? (challenge.stakeAmount ? ' – ' : '') + challenge.stakeText : ''}</span></p>
          </CardContent>
        </Card>
      )}

      {joinCode && (
        <section className="space-y-2">
          <h3 className="font-semibold">Teilen</h3>
          <div className="flex items-center justify-between border rounded-md p-3">
            <div>
              <p className="text-sm">Beitrittscode</p>
              <p className="font-mono text-lg tracking-wider">{joinCode}</p>
            </div>
            <Button variant="secondary" onClick={() => {
              const url = `${window.location.origin}/join`;
              const text = `Tritt meiner Challenge bei! Code: ${joinCode} – ${url}`;
              navigator.clipboard.writeText(text);
              toast({ title: "Kopiert", description: "Code & Link in Zwischenablage" });
            }}>Kopieren</Button>
          </div>
        </section>
      )}

      {/* Teilnehmerliste */}
      <section className="space-y-2">
        <h3 className="font-semibold">Teilnehmer</h3>
        <ChallengeParticipants challengeId={id} />
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">Kalender</h3>
        <div className="grid grid-cols-7 gap-1 text-center">
          {days.map((d) => {
            const iso = toISODate(d);
            const checkIn = getCheckIn(iso);
            const status = checkIn?.status;
            const isLocked = checkIn?.locked;
            const isPast = iso < today;
            
            let cls = "";
            let lockIndicator = "";
            
            if (status === "success") {
              cls = "bg-success/30 text-success";
            } else if (status === "fail") {
              cls = "bg-secondary/30 text-secondary";
            } else if (isPast) {
              cls = "bg-muted/50 text-muted-foreground";
            } else {
              cls = "bg-card/60 text-muted-foreground";
            }
            
            if (isLocked) {
              cls += " ring-2 ring-destructive/50";
              lockIndicator = " 🔒";
            }
            
            return (
              <div 
                key={iso} 
                className={`rounded-md px-2 py-3 text-xs relative ${cls} cursor-pointer hover:opacity-80 transition-opacity`}
                title={isLocked ? "Final bewertet - kann nicht geändert werden" : "Klicken für Details"}
                onClick={() => {
                  setSelectedDate(iso);
                  setDayOpen(true);
                }}
              >
                {d.getDate()}{lockIndicator}
              </div>
            );
          })}
        </div>
        {/* Legende */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>🔒 = Final bewertet (automatisch um {challenge.checkInTime} Uhr)</p>
          <p>⚠️ Check-ins müssen vor {challenge.checkInTime} Uhr erfolgen</p>
          <p>💡 Klicke auf einen Tag für Details</p>
        </div>
      </section>

      {/* Leaderboards */}
      {authUser && (
        <section className="space-y-3">
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="font-semibold">Rangliste: Geschafft</h3>
              <div className="space-y-1">
                {(stats.success.data ?? []).map((r) => {
                  const isMe = r.user_id === authUser.id;
                  const label = isMe ? `${r.user_name} (Du)` : r.user_name;
                  return (
                    <div key={`s-${r.user_id}`} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium">{r.days} Tage</span>
                    </div>
                  );
                })}
                {stats.success.isLoading && <p className="text-xs text-muted-foreground">Lade…</p>}
                {stats.success.error && <p className="text-xs text-destructive">Konnte Rangliste nicht laden.</p>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="font-semibold">Rangliste: Nicht geschafft</h3>
              <div className="space-y-1">
                {(stats.fail.data ?? []).map((r) => {
                  const isMe = r.user_id === authUser.id;
                  const label = isMe ? `${r.user_name} (Du)` : r.user_name;
                  const amount = (challenge.stakeAmount ?? 0) * (r.days ?? 0);
                  const unit = challenge.stakeUnit ?? "";
                  return (
                    <div key={`f-${r.user_id}`} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium">
                        {r.days} Tage{challenge.stakeAmount ? ` · ${amount} ${unit || ''}` : ''}
                      </span>
                    </div>
                  );
                })}
                {stats.fail.isLoading && <p className="text-xs text-muted-foreground">Lade…</p>}
                {stats.fail.error && <p className="text-xs text-destructive">Konnte Rangliste nicht laden.</p>}
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      <section className="space-y-3">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            {(() => {
              const todayKey = `${id}:${userId}:${today}`;
              const todayCheckIn = checkIns[todayKey];
              const isLocked = todayCheckIn?.locked;
              const hasCheckIn = !!todayCheckIn;
              
              if (isLocked) {
                return (
                  <Button variant="secondary" className="w-full" disabled>
                    {todayCheckIn.status === 'success' ? '✅ Geschafft (final)' : '❌ Nicht geschafft (final)'}
                  </Button>
                );
              } else if (hasCheckIn) {
                return (
                  <Button variant="outline" className="w-full">
                    {todayCheckIn.status === 'success' ? '✅ Geschafft (ändern)' : '❌ Nicht geschafft (ändern)'}
                  </Button>
                );
              } else {
                return <Button variant="hero" className="w-full">Heute einchecken</Button>;
              }
            })()}
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dein Check‑in</DialogTitle>
            </DialogHeader>
            <RadioGroup value={result} onValueChange={(v) => setResult(v as any)} className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2 border rounded-md p-3">
                <RadioGroupItem value="success" id="r1" />
                <Label htmlFor="r1">Geschafft</Label>
              </div>
              <div className="flex items-center space-x-2 border rounded-md p-3">
                <RadioGroupItem value="fail" id="r2" />
                <Label htmlFor="r2">Nicht geschafft</Label>
              </div>
            </RadioGroup>
            {challenge.requireScreenshot && result === "success" && (
              <div className="space-y-2">
                <Label>Bild (optional)</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setFileObj(f);
                    setFileName(f?.name);
                  }}
                />
                {fileObj && (
                  <p className="text-xs text-muted-foreground">
                    Ausgewählt: {fileObj.name} ({(fileObj.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>
            )}
            <Button 
              onClick={onConfirm} 
              variant="hero" 
              className="w-full mt-2"
              disabled={uploading}
            >
              {uploading ? "Lade hoch..." : "Speichern"}
            </Button>
          </DialogContent>
        </Dialog>

        <div className="flex items-center justify-between border rounded-md p-3">
          <div>
            <p className="font-medium">Reminder: 1h vorher</p>
            <p className="text-xs text-muted-foreground">UI‑vorbereitet, keine Notifications</p>
          </div>
          <Switch checked={participation?.reminders.before1h ?? false} onCheckedChange={(val) => {
            const p = useChallengesStore.getState().getUserParticipation(id!);
            if (!p) return;
            useChallengesStore.setState((s) => ({
              participations: { ...s.participations, [`${id}:${user.id}`]: { ...p, reminders: { before1h: val } } }
            }));
          }} />
        </div>
      </section>

      {/* Delete Challenge Button - Only visible to creator */}
      {authUser && challenge?.creatorId === authUser.id && (
        <section className="space-y-3">
          <Card>
            <CardContent className="p-4">
              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold text-destructive">Challenge löschen</h3>
                  <p className="text-sm text-muted-foreground">
                    Diese Aktion kann nicht rückgängig gemacht werden. Alle Teilnehmer, Check-ins und Daten werden unwiderruflich gelöscht.
                  </p>
                </div>
                <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="destructive" className="w-full">
                      Challenge löschen
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Challenge wirklich löschen?</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Möchtest du die Challenge "{challenge.title}" wirklich löschen? 
                        Diese Aktion kann nicht rückgängig gemacht werden.
                      </p>
                      <div className="flex gap-3">
                        <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                          Abbrechen
                        </Button>
                        <Button 
                          variant="destructive" 
                          onClick={handleDeleteChallenge}
                          disabled={isDeleting}
                        >
                          {isDeleting ? "Lösche..." : "Challenge löschen"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Tages-Dialog: Teilnehmer & Bilder */}
      <Dialog open={dayOpen} onOpenChange={(o) => { 
        setDayOpen(o); 
        if (!o) { 
          setDayItems([]); 
          setDayError(null); 
        } 
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedDate ? `Check-ins am ${selectedDate}` : "Check-ins"}
            </DialogTitle>
          </DialogHeader>

          {dayLoading && <p className="text-sm text-muted-foreground">Lade…</p>}
          {dayError && <p className="text-sm text-destructive">{dayError}</p>}

          {!dayLoading && !dayError && dayItems.length === 0 && (
            <p className="text-sm text-muted-foreground">Keine Einträge für diesen Tag.</p>
          )}

          <div className="space-y-4 max-h-96 overflow-y-auto">
            {dayItems.map((it) => {
              const ok = it.status === "success";
              return (
                <div key={it.user_id} className="border rounded-md p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{it.user_name}</span>
                    <span className={ok ? "text-green-600" : "text-red-600"}>
                      {ok ? "✅ Erfolg" : "❌ Fehlversuch"}
                    </span>
                  </div>
                  <div className="mt-2">
                    {it.signed_url ? (
                      <img
                        src={it.signed_url}
                        alt="Check-in Bild"
                        className="w-full max-h-48 object-contain rounded-md bg-muted"
                        loading="lazy"
                        onError={(e) => {
                          console.warn("Image load error:", e);
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">Kein Bild hochgeladen.</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </MobileShell>
  );
}
