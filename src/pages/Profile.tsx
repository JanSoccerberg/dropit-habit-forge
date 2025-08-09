import SEO from "@/components/SEO";
import MobileShell from "@/components/layout/MobileShell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useChallengesStore, api } from "@/store/challenges";

export default function Profile() {
  const user = useChallengesStore((s) => s.user);

  return (
    <MobileShell title="Profil & Einstellungen">
      <SEO title="DropIt – Profil" description="Dein Profil und App‑Einstellungen." />

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={user.name} onChange={(e) => api.updateProfile({ name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Avatar (URL, optional)</Label>
            <Input value={user.avatarUrl ?? ""} onChange={(e) => api.updateProfile({ avatarUrl: e.target.value })} placeholder="https://…" />
          </div>
          <div className="space-y-2">
            <Label>Sprache</Label>
            <Select value={user.locale} onValueChange={(v) => api.updateProfile({ locale: v })}>
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
            <Switch checked={user.pushEnabled} onCheckedChange={(v) => api.updateProfile({ pushEnabled: v })} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Dark Mode</p>
              <p className="text-xs text-muted-foreground">UI‑Umschaltung</p>
            </div>
            <Switch checked={user.darkMode} onCheckedChange={(v) => {
              api.updateProfile({ darkMode: v });
              document.documentElement.classList.toggle("light", !v);
              document.documentElement.classList.toggle("dark", v);
            }} />
          </div>
          <Button variant="destructive" className="w-full" onClick={() => api.resetApp()}>App zurücksetzen</Button>
        </CardContent>
      </Card>
    </MobileShell>
  );
}
