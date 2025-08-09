// Admin-only Edge Function to create and auto-confirm a user
// Uses a shared ADMIN_CREATE_USER_TOKEN header for access and the service role key for admin actions

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const adminToken = req.headers.get("x-admin-key") || "";
    const expectedToken = Deno.env.get("ADMIN_CREATE_USER_TOKEN") || "";

    if (!expectedToken || adminToken !== expectedToken) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { email, password, name } = await req.json().catch(() => ({ email: "" }));

    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "Missing or invalid 'email'" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const SUPABASE_URL = "https://adjwxqbdglbffzmqvmmt.supabase.co";
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: "Service role key not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Create user with email confirmed and optional password
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: typeof password === "string" && password.length >= 6 ? password : cryptoRandomPassword(16),
      email_confirm: true,
      user_metadata: name ? { name } : undefined,
    });

    if (createErr || !created?.user) {
      return new Response(JSON.stringify({ error: createErr?.message || "Failed to create user" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Try to upsert profile (ignore failures)
    try {
      const profileInsert = {
        id: created.user.id,
        name: name ?? created.user.user_metadata?.name ?? "User",
        // Optional fields — default values if your schema supports them
        // locale, push_enabled, dark_mode may have defaults via DB
      } as Record<string, unknown>;

      await admin.from("profiles").upsert(profileInsert, { onConflict: "id" });
    } catch (_) {
      // ignore
    }

    return new Response(
      JSON.stringify({
        message: "User created and confirmed",
        userId: created.user.id,
        email: created.user.email,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});

function cryptoRandomPassword(length = 16) {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}
