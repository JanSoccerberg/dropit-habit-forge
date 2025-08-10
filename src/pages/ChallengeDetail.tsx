
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

  if (!challenge) return <MobileShell title="Challenge"><p className="text-muted-foreground">Challenge nicht gefunden.</p></MobileShell>;

  const days = daysBetween(challenge.startDate, challenge.endDate);
  const userId = user.id;
  const getStatus = (dateISO: string) => {
    const key = `${id}:${userId}:${dateISO}`;
    return checkIns[key]?.status;
  };

  const today = todayStr();
  const todayStatus = getStatus(today);

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
    return () => { cancelled = true; };
  }, [authUser, id]);

  const onConfirm = async () => {
    // Persist to DB if logged in
    if (!authUser) {
      toast({ title: "Bitte einloggen", description: "Check‑ins werden nur mit Login gespeichert.", variant: "destructive" });
    } else {
      const { error } = await supabase.rpc("upsert_check_in", {
        p_challenge_id: id,
        p_status: result,
        p_screenshot_name: fileName ?? null,
      });
      if (error) {
        toast({ title: "Check‑in fehlgeschlagen", description: error.message, variant: "destructive" });
        return;
      }
    }

    // Always update local for current UI
    api.checkIn(id!, result, fileName);
    setOpen(false);
    toast({ title: "Check‑in gespeichert" });
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

      <section className="space-y-2">
        <h3 className="font-semibold">Kalender</h3>
        <div className="grid grid-cols-7 gap-1 text-center">
          {days.map((d) => {
            const iso = d.toISOString().slice(0, 10);
            const status = getStatus(iso);
            const isPast = iso < today;
            const cls = status === "success" ? "bg-success/30 text-success" : status === "fail" ? "bg-secondary/30 text-secondary" : isPast ? "bg-muted/50 text-muted-foreground" : "bg-card/60 text-muted-foreground";
            return (
              <div key={iso} className={`rounded-md px-2 py-3 text-xs ${cls}`}>{d.getDate()}</div>
            );
          })}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">Teilnehmer</h3>
        <div className="flex items-center gap-3 text-sm">
          <div className="h-8 w-8 rounded-full bg-muted" />
          <div>
            <p className="font-medium">{user.name}</p>
            <p className="text-xs text-muted-foreground">Streak: {participation?.streak ?? 0} Tage</p>
          </div>
        </div>
      </section>

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

