import SEO from "@/components/SEO";
import MobileShell from "@/components/layout/MobileShell";
import { Button } from "@/components/ui/button";
import { useChallengesStore } from "@/store/challenges";
import ChallengeCard from "@/components/ChallengeCard";
import { NavLink } from "react-router-dom";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";

const Index = () => {
  const participations = useChallengesStore((s) => s.participations);
  const userId = useChallengesStore((s) => s.user.id);
  const { user, initializing } = useSupabaseAuth();

  const myChallengeIds = Object.values(participations)
    .filter((p) => p.userId === userId)
    .map((p) => p.challengeId);

  const loading = initializing || (!!user && userId !== user.id);

  return (
    <MobileShell title="DropIt">
      <SEO title="DropIt – Übersicht" description="Alle aktiven Challenges im Blick." />

      {loading ? (
        <div className="text-center space-y-5 py-12">
          <h2 className="text-2xl font-bold">Lade deine Challenges…</h2>
          <p className="text-muted-foreground">Synchronisiere mit deinem Konto.</p>
        </div>
      ) : myChallengeIds.length === 0 ? (
        <div className="text-center space-y-5 py-12">
          <h2 className="text-2xl font-bold">Starte deine erste Challenge</h2>
          <p className="text-muted-foreground">Brich schlechte Gewohnheiten mit täglichem Check‑in.</p>
          <div className="flex gap-3 justify-center">
            <Button asChild variant="hero">
              <NavLink to="/create">Neue Challenge</NavLink>
            </Button>
            <Button asChild variant="outline">
              <NavLink to="/join">Challenge beitreten</NavLink>
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {myChallengeIds.map((id) => (
            <ChallengeCard key={id} id={id} />
          ))}
        </div>
      )}

    </MobileShell>
  );
};

export default Index;
