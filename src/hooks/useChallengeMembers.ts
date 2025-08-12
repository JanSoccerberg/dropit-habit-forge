
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseAuth } from "./useSupabaseAuth";

export type MemberRow = {
  user_id: string;
  user_name: string;
};

export function useChallengeMembers(challengeId?: string) {
  const { user } = useSupabaseAuth();

  return useQuery({
    queryKey: ["challenge_members", challengeId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_challenge_members", {
        p_challenge_id: challengeId,
      });
      if (error) throw error;
      return (data ?? []) as MemberRow[];
    },
    enabled: !!user && !!challengeId,
  });
}
