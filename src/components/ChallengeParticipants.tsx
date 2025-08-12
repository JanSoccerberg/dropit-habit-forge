
import { useChallengeMembers } from "@/hooks/useChallengeMembers";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";

type Props = {
  challengeId: string;
};

export default function ChallengeParticipants({ challengeId }: Props) {
  const { user } = useSupabaseAuth();
  const members = useChallengeMembers(challengeId);

  if (!user) {
    return <p className="text-sm text-muted-foreground">Bitte einloggen, um Teilnehmer zu sehen.</p>;
  }
  if (members.isLoading) {
    return <p className="text-sm text-muted-foreground">Lade…</p>;
  }
  if (members.error) {
    return <p className="text-sm text-destructive">Teilnehmer konnten nicht geladen werden.</p>;
  }
  const list = members.data ?? [];
  if (list.length === 0) {
    return <p className="text-sm text-muted-foreground">Keine Teilnehmer</p>;
  }

  return (
    <div className="space-y-2">
      {list.map((m) => {
        const isMe = m.user_id === user.id;
        const label = isMe ? `${m.user_name} (Du)` : m.user_name;
        return (
          <div key={m.user_id} className="flex items-center gap-3 text-sm">
            <div className="h-8 w-8 rounded-full bg-muted" />
            <div>
              <p className="font-medium">{label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
