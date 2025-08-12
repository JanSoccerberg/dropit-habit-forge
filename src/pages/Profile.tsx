
import SEO from "@/components/SEO";
import MobileShell from "@/components/layout/MobileShell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useChallengesStore, api } from "@/store/challenges";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { useAuthBridge } from "@/hooks/useAuthBridge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

export default function Profile() {
  const nav = useNavigate();
  const user = useChallengesStore((s) => s.user);
  const { user: authUser, signOut } = useSupabaseAuth();
  useAuthBridge();

  const updateRemote = async (patch: Partial<{ user_name: string; avatar_url: string | null; locale: string; push_enabled: boolean; dark_mode: boolean }>) => {
    if (!authUser) return;
    const { error } = await supabase.from("profiles").update(patch).eq("id", authUser.id);
    if (error) {
      toast({ title: "Speichern fehlgeschlagen", description: error.message, variant: "destructive" });
    }
  };

  return (
    <MobileShell title="Profil & Einstellungen">
      <SEO title="DropIt – Profil" description="Dein Profil und App‑Einstellungen." />

      {!authUser && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm">Du bist nicht eingeloggt. Logge dich ein, um dein Profil zu speichern und Challenges zu teilen.</p>
            <Button variant="hero" className="w-full" onClick={() => nav("/auth")}>Einloggen / Registrieren</Button>
          </CardContent>
        </Card>
      )}

      {authUser && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{authUser.email}</p>
              <Button variant="outline" size="sm" onClick={async () => {
                const { error } = await signOut();
                if (error) {
                  toast({ title: "Logout fehlgeschlagen", description: error.message, variant: "destructive" });
                } else {
                  toast({ title: "Ausgeloggt" });
                }
              }}>Logout</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="space-y-2">
            <Label>Benutzername</Label>
            <Input
              value={user.name}
              onChange={async (e) => {
                api.updateProfile({ name: e.target.value });
                await updateRemote({ user_name: e.target.value });
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>Sprache</Label>
            <Select value={user.locale} onValueChange={async (v) => {
              api.updateProfile({ locale: v });
              await updateRemote({ locale: v });
            }}>
              <SelectTrigger><SelectValue placeholder="Sprache" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="de">Deutsch</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Push aktivieren</p>
              <p className="text-xs text-muted-foreground">Frontend‑Toggle, keine echten Notifications</p>
            </div>
            <Switch checked={user.pushEnabled} onCheckedChange={async (v) => {
              api.updateProfile({ pushEnabled: v });
              await updateRemote({ push_enabled: v });
            }} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Dark Mode</p>
              <p className="text-xs text-muted-foreground">UI‑Umschaltung</p>
            </div>
            <Switch checked={user.darkMode} onCheckedChange={async (v) => {
              api.updateProfile({ darkMode: v });
              document.documentElement.classList.toggle("light", !v);
              document.documentElement.classList.toggle("dark", v);
              await updateRemote({ dark_mode: v });
            }} />
          </div>
          <Button variant="destructive" className="w-full" onClick={() => api.resetApp()}>App zurücksetzen</Button>
        </CardContent>
      </Card>
    </MobileShell>
  );
}

