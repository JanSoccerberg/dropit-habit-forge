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

      const { data, error } = await supabase
        .from("challenge_members")
        .select(
          "challenge_id, challenges ( id, title, description, start_date, end_date, checkin_time, screenshot_required, bet_description, bet_rule, join_code, creator_id, created_at )"
        );

      if (cancelled) return;

      if (error) {
        console.warn("Bootstrap: Laden der Challenges fehlgeschlagen:", error);
        return;
      }

      const rows = (data || []) as any[];
      rows.forEach((r) => {
        const ch = r?.challenges;
        if (ch && ch.id) {
          api.addChallengeFromDB(ch);
        }
      });

      loadedRef.current = user.id;
    };

    run();
    return () => { cancelled = true; };
  }, [user]);
}
