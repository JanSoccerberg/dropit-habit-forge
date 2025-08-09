
import SEO from "@/components/SEO";
import MobileShell from "@/components/layout/MobileShell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { api, useChallengesStore } from "@/store/challenges";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";

type Preview = {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  check_in_time: string;
  require_screenshot: boolean;
  stake_text: string | null;
  stake_rule: "per-missed-day" | "overall-fail";
} | null;

export default function JoinChallenge() {
  const nav = useNavigate();
  const { user } = useSupabaseAuth();
  const [code, setCode] = useState("");
  const previewLocal = useChallengesStore((s) => s.findByCode(code.toUpperCase()));
  const [preview, setPreview] = useState<Preview>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const c = code.trim().toUpperCase();
      if (c.length !== 6) {
        setPreview(null);
        return;
      }
      setLoading(true);
      const { data, error } = await supabase.rpc("get_challenge_by_join_code", { p_code: c });
      if (!cancelled) {
        if (error) {
          console.warn("get_challenge_by_join_code error:", error);
          setPreview(null);
        } else {
          setPreview((data as any) ?? null);
        }
        setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [code]);

  const onJoin = async () => {
    const c = code.trim().toUpperCase();

    if (!user) {
      toast({ title: "Bitte einloggen", description: "Zum Beitreten ist ein Login nötig.", variant: "destructive" });
      nav("/auth");
      return;
    }

    const { data, error } = await supabase.rpc("join_challenge_by_code", { p_code: c });
    if (error) {
      toast({ title: "Beitreten fehlgeschlagen", description: error.message, variant: "destructive" });
      return;
    }

    // Update local state for current UI flow (falls Challenge bereits lokal bekannt)
    const res = api.joinChallengeByCode(c);
    if ((res as any).error) {
      // fallback: wenn lokal nicht existiert, navigieren wir zur Detailseite der DB-Challenge
      const challengeId = (data as any)?.[0]?.challenge_id;
      if (challengeId) {
        nav(`/challenge/${challengeId}`);
        return;
      }
      alert((res as any).error);
      return;
    }

    nav(`/challenge/${(res as any).id}`);
  };

  return (
    <MobileShell title="Challenge beitreten">
      <SEO title="DropIt – Challenge beitreten" description="Tritt mit Code einer Challenge bei." />

      <Card>
        <CardContent className="p-4 space-y-4">
          <Input placeholder="Code eingeben (6 Zeichen)" value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} className="uppercase" />

          {code.length === 6 && loading && (
            <p className="text-sm text-muted-foreground">Lade Vorschau…</p>
          )}

          {code.length === 6 && !loading && !preview && !previewLocal && (
            <p className="text-sm text-secondary">Challenge existiert nicht</p>
          )}

          {(preview || previewLocal) && (
            <div className="space-y-1 text-sm">
              <p className="font-medium">{preview?.title ?? previewLocal?.title}</p>
              <p className="text-muted-foreground">Zeitraum: {(preview?.start_date ?? previewLocal?.startDate) as any} – {(preview?.end_date ?? previewLocal?.endDate) as any}</p>
              <p className="text-muted-foreground">Check‑in täglich bis {(preview?.check_in_time ?? previewLocal?.checkInTime) as any} Uhr</p>
              <p className="text-muted-foreground">Screenshotpflicht: {(preview?.require_screenshot ?? previewLocal?.requireScreenshot) ? "Ja" : "Nein"}</p>
              {(preview?.stake_text ?? previewLocal?.stakeText) && <p className="text-muted-foreground">Einsatz: {(preview?.stake_text ?? previewLocal?.stakeText) as any}</p>}
            </div>
          )}

          <Button disabled={!(preview || previewLocal)} onClick={onJoin} variant="hero" className="w-full">Challenge beitreten</Button>
        </CardContent>
      </Card>
    </MobileShell>
  );
}

