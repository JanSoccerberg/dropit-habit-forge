
import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useSupabaseAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
    });

    supabase.auth.getSession().then(({ data: { session: current } }) => {
      setSession(current);
      setUser(current?.user ?? null);
      setInitializing(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, name?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: name ? { name } : undefined,
      },
    });
    return { error };
  };

  const cleanupAuthState = () => {
    try {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('supabase.auth.') || key.includes('sb-')) localStorage.removeItem(key);
      });
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith('supabase.auth.') || key.includes('sb-')) sessionStorage.removeItem(key);
      });
    } catch {}
  };

  const signInWithGoogle = async () => {
    cleanupAuthState();
    try { await supabase.auth.signOut({ scope: 'global' }); } catch {}
    const redirectTo = `${window.location.origin}/`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    return { error };
  };

  const signOut = async () => {
    cleanupAuthState();
    const { error } = await supabase.auth.signOut({ scope: 'global' });
    return { error };
  };
  return { session, user, initializing, signIn, signUp, signInWithGoogle, signOut };
}

