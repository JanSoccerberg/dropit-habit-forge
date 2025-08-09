import SEO from "@/components/SEO";
import MobileShell from "@/components/layout/MobileShell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { api, useChallengesStore } from "@/store/challenges";
import { useNavigate } from "react-router-dom";

export default function JoinChallenge() {
  const nav = useNavigate();
  const [code, setCode] = useState("");
  const preview = useChallengesStore((s) => s.findByCode(code.toUpperCase()));

  const onJoin = () => {
    const res = api.joinChallengeByCode(code.trim().toUpperCase());
    if ((res as any).error) return alert((res as any).error);
    nav(`/challenge/${(res as any).id}`);
  };

  return (
    <MobileShell title="Challenge beitreten">
      <SEO title="DropIt – Challenge beitreten" description="Tritt mit Code einer Challenge bei." />

      <Card>
        <CardContent className="p-4 space-y-4">
          <Input placeholder="Code eingeben (6 Zeichen)" value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} className="uppercase" />

          {code.length === 6 && !preview && (
            <p className="text-sm text-secondary">Challenge existiert nicht</p>
          )}

          {preview && (
            <div className="space-y-1 text-sm">
              <p className="font-medium">{preview.title}</p>
              <p className="text-muted-foreground">Zeitraum: {preview.startDate} – {preview.endDate}</p>
              <p className="text-muted-foreground">Check‑in täglich bis {preview.checkInTime} Uhr</p>
              <p className="text-muted-foreground">Screenshotpflicht: {preview.requireScreenshot ? "Ja" : "Nein"}</p>
              {preview.stakeText && <p className="text-muted-foreground">Einsatz: {preview.stakeText}</p>}
            </div>
          )}

          <Button disabled={!preview} onClick={onJoin} variant="hero" className="w-full">Challenge beitreten</Button>
        </CardContent>
      </Card>
    </MobileShell>
  );
}
