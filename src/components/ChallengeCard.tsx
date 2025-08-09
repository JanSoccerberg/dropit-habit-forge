import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ProgressRing from "./ProgressRing";
import { useChallengesStore } from "@/store/challenges";
import { daysBetween, todayStr } from "@/utils/date";

export default function ChallengeCard({ id }: { id: string }) {
  const challenge = useChallengesStore((s) => s.challenges[id]);
  const progress = useChallengesStore((s) => s.getChallengeProgress(id));
  const userId = useChallengesStore((s) => s.user.id);
  const checkIns = useChallengesStore((s) => s.checkIns);

  const today = todayStr();
  const todayKey = `${id}:${userId}:${today}`;
  const todayDone = !!checkIns[todayKey];

  const total = daysBetween(challenge.startDate, challenge.endDate).length;
  const left = Math.max(0, total - progress.elapsed);

  const color = todayDone ? "hsl(var(--success))" : "hsl(var(--secondary))";

  return (
    <Card className="bg-card/80">
      <CardContent className="p-4 flex items-center gap-4">
        <ProgressRing percent={progress.percent} size={72} thickness={12} fillColor={color} />
        <div className="flex-1 text-left">
          <h3 className="font-semibold leading-tight">{challenge.title}</h3>
          <p className="text-sm text-muted-foreground">Verbleibend: {left} Tage</p>
          <p className="text-xs text-muted-foreground">Heute: {todayDone ? "erledigt" : "offen"}</p>
        </div>
        <Button asChild variant="hero" className="px-3 py-2">
          <Link to={`/challenge/${id}`}>Zur Challenge</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
