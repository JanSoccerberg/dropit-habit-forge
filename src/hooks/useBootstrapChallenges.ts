// useBootstrapChallenges: Lädt alle Challenges des eingeloggten Users aus Supabase
// und spiegelt sie in den lokalen Zustand (Zustand-Store) via api.addChallengeFromDB.
// Aufruf: import { useBootstrapChallenges } from "@/hooks/useBootstrapChallenges";
//         useBootstrapChallenges();

import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { api, useChallengesStore } from "@/store/challenges";
import { useSupabaseAuth } from "./useSupabaseAuth";

export function useBootstrapChallenges() {
  const { user } = useSupabaseAuth();
  const loadedRef = useRef<string | null>(null);
  const challenges = useChallengesStore((s) => s.challenges);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!user) return;
      // Verhindere wiederholtes Laden für denselben User
      if (loadedRef.current === user.id && Object.keys(challenges).length > 0) return;

      // Lade sowohl Challenges über Mitgliedschaften (challenge_members) als auch Challenges,
      // die der Nutzer selbst erstellt hat (creator_id = user.id). Beide Quellen werden dedupliziert zusammengeführt.
      const [membersRes, creatorRes] = await Promise.all([
        supabase
          .from("challenge_members")
          .select(
            "challenge_id, challenges ( id, title, description, start_date, end_date, checkin_time, screenshot_required, bet_description, bet_rule, join_code, creator_id, created_at )"
          )
          .eq("user_id", user.id),
        supabase
          .from("challenges")
          .select(
            "id, title, description, start_date, end_date, checkin_time, screenshot_required, bet_description, bet_rule, join_code, creator_id, created_at"
          )
          .eq("creator_id", user.id),
      ]);

      if (cancelled) return;

      if (membersRes.error || creatorRes.error) {
        if (membersRes.error) console.warn("Bootstrap: Laden der Mitgliedschafts-Challenges fehlgeschlagen:", membersRes.error);
        if (creatorRes.error) console.warn("Bootstrap: Laden der eigenen Challenges fehlgeschlagen:", creatorRes.error);
        // Wir fahren fort und nutzen, was vorhanden ist
      }

      const map = new Map<string, any>();

      const rows = (membersRes.data || []) as any[];
      rows.forEach((r) => {
        const ch = r?.challenges;
        if (ch && ch.id && !map.has(ch.id)) {
          map.set(ch.id, ch);
        }
      });

      const creatorRows = (creatorRes.data || []) as any[];
      creatorRows.forEach((ch) => {
        if (ch && ch.id && !map.has(ch.id)) {
          map.set(ch.id, ch);
        }
      });

      map.forEach((ch) => api.addChallengeFromDB(ch));

      loadedRef.current = user.id;
    };

    run();
    return () => { cancelled = true; };
  }, [user]);
}
