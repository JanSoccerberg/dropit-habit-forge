import SEO from "@/components/SEO";
import MobileShell from "@/components/layout/MobileShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/store/challenges";
import { toast } from "@/hooks/use-toast";

export default function CreateChallenge() {
  const nav = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState<string>(new Date(Date.now() + 1000*60*60*24*14).toISOString().slice(0, 10));
  const [checkInTime, setCheckInTime] = useState("22:00");
  const [requireScreenshot, setRequireScreenshot] = useState(false);
  const [stakeText, setStakeText] = useState("");
  const [stakeRule, setStakeRule] = useState("per-missed-day");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { id, joinCode } = api.createChallenge({
      title,
      description,
      startDate,
      endDate,
      checkInTime,
      requireScreenshot,
      stakeText,
      stakeRule: stakeRule as any,
    });
    toast({ title: "Challenge erstellt", description: `Code: ${joinCode}` });
    nav(`/challenge/${id}`);
  };

  return (
    <MobileShell title="Neue Challenge">
      <SEO title="DropIt – Neue Challenge" description="Erstelle eine neue Challenge." />

      <Card>
        <CardContent className="p-4">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Titel</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="z. B. Kein Zucker" />
            </div>
            <div className="space-y-2">
              <Label>Beschreibung</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ziel, Regeln, Motivation…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Startdatum</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Enddatum</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tägliche Check‑In‑Zeit</Label>
                <Input type="time" value={checkInTime} onChange={(e) => setCheckInTime(e.target.value)} required />
              </div>
              <div className="flex items-center justify-between mt-6">
                <div className="space-y-0.5">
                  <Label>Screenshotpflicht</Label>
                  <p className="text-xs text-muted-foreground">Beim Einchecken Nachweis verlangen</p>
                </div>
                <Switch checked={requireScreenshot} onCheckedChange={setRequireScreenshot} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Einsatz</Label>
              <Input value={stakeText} onChange={(e) => setStakeText(e.target.value)} placeholder="z. B. 5 € pro verpasstem Tag" />
            </div>
            <div className="space-y-2">
              <Label>Einsatzregel</Label>
              <Select value={stakeRule} onValueChange={setStakeRule}>
                <SelectTrigger><SelectValue placeholder="Regel wählen" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="per-missed-day">pro verpasstem Tag</SelectItem>
                  <SelectItem value="overall-fail">bei Gesamtversagen</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" variant="hero" className="w-full">Speichern</Button>
          </form>
        </CardContent>
      </Card>
    </MobileShell>
  );
}
