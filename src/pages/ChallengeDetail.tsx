import SEO from "@/components/SEO";
import MobileShell from "@/components/layout/MobileShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useParams } from "react-router-dom";
import { useChallengesStore, api } from "@/store/challenges";
import ProgressRing from "@/components/ProgressRing";
import { daysBetween, todayStr } from "@/utils/date";
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

export default function ChallengeDetail() {
  const { id = "" } = useParams();
  const challenge = useChallengesStore((s) => s.challenges[id!]);
  const progress = useChallengesStore((s) => s.getChallengeProgress(id!));
  const participation = useChallengesStore((s) => s.getUserParticipation(id!));
  const user = useChallengesStore((s) => s.user);
  const checkIns = useChallengesStore((s) => s.checkIns);
  const { user: authUser } = useSupabaseAuth();

  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<"success" | "fail">("success");
  const [fileName, setFileName] = useState<string | undefined>(undefined);
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [attemptedFetch, setAttemptedFetch] = useState(false);

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
        .select("challenges ( id, title, description, start_date, end_date, checkin_time, screenshot_required, bet_description, bet_rule, join_code, creator_id, created_at )")
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

    // Persist to DB if logged in
    if (!authUser) {
      toast({ title: "Bitte einloggen", description: "Check‑ins werden nur mit Login gespeichert.", variant: "destructive" });
    } else {
      const { error } = await supabase.rpc("upsert_check_in_with_deadline", {
        p_challenge_id: id,
        p_date: today,
        p_status: result,
        p_screenshot_name: fileName ?? null,
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
    }

    // Always update local for current UI
    try {
      api.checkIn(id!, result, fileName);
      setOpen(false);
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
  };

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

      {challenge.stakeText && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm">Einsatz: <span className="font-medium">{challenge.stakeText}</span></p>
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
            const iso = d.toISOString().slice(0, 10);
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
                className={`rounded-md px-2 py-3 text-xs relative ${cls}`}
                title={isLocked ? "Final bewertet - kann nicht geändert werden" : undefined}
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
                  return (
                    <div key={`f-${r.user_id}`} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium">{r.days} Tage</span>
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
            <Button variant="hero" className="w-full">Heute einchecken</Button>
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
                <Label>Screenshot (kein Upload – nur Platzhalter)</Label>
                <Input type="file" onChange={(e) => setFileName(e.target.files?.[0]?.name)} />
              </div>
            )}
            <Button onClick={onConfirm} variant="hero" className="w-full mt-2">Speichern</Button>
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
    </MobileShell>
  );
}
