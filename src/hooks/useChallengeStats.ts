
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseAuth } from "./useSupabaseAuth";

export type CountRow = { user_id: string; days: number };
export type CalendarRow = { date: string; status: "success" | "fail" };

export function useChallengeStats(challengeId?: string) {
  const { user } = useSupabaseAuth();

  const success = useQuery({
    queryKey: ["success_counts", challengeId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_success_counts", {
        p_challenge_id: challengeId,
      });
      if (error) throw error;
      return (data ?? []) as CountRow[];
    },
    enabled: !!user && !!challengeId,
  });

  const fail = useQuery({
    queryKey: ["fail_counts", challengeId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_fail_counts", {
        p_challenge_id: challengeId,
      });
      if (error) throw error;
      return (data ?? []) as CountRow[];
    },
    enabled: !!user && !!challengeId,
  });

  const calendar = useQuery({
    queryKey: ["user_calendar", challengeId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_user_calendar", {
        p_challenge_id: challengeId,
      });
      if (error) throw error;
      return (data ?? []) as CalendarRow[];
    },
    enabled: !!user && !!challengeId,
  });

  return { success, fail, calendar };
}
