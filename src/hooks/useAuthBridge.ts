
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseAuth } from "./useSupabaseAuth";
import { api } from "@/store/challenges";

type ProfileRow = {
  id: string;
  user_name: string | null;
  avatar_url: string | null;
  locale: string;
  push_enabled: boolean;
  dark_mode: boolean;
};

export function useAuthBridge() {
  const { user } = useSupabaseAuth();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const prevUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      api.resetApp();
      return;
    }

    let cancelled = false;

    const load = async () => {
      // Reset local state if the authenticated user changed
      if (prevUserIdRef.current !== user.id) {
        api.resetApp();
        prevUserIdRef.current = user.id;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.warn("Failed to fetch profile:", error);
        return;
      }

      let row = data as ProfileRow | null;

      if (!row) {
        const { data: inserted, error: insErr } = await supabase
          .from("profiles")
          .insert({ id: user.id, user_name: "User" })
          .select("*")
          .maybeSingle();

        if (insErr) {
          console.warn("Failed to insert default profile:", insErr);
          return;
        }
        row = inserted as ProfileRow | null;
      }

      if (!cancelled && row) {
        setProfile(row);
        // Bridge to local store
        api.updateProfile({
          id: user.id,
          name: row.user_name ?? "User",
          avatarUrl: row.avatar_url ?? undefined,
          locale: row.locale,
          pushEnabled: row.push_enabled,
          darkMode: row.dark_mode,
        });

        document.documentElement.classList.toggle("light", !row.dark_mode);
        document.documentElement.classList.toggle("dark", row.dark_mode);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [user]);

  return { profile };
}

