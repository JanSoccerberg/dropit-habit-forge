
import SEO from "@/components/SEO";
import MobileShell from "@/components/layout/MobileShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { toast } from "@/hooks/use-toast";

export default function Auth() {
  const nav = useNavigate();
  const { signIn, signUp } = useSupabaseAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await signIn(email, password);
    if (error) {
      toast({ title: "Login fehlgeschlagen", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Eingeloggt" });
    nav("/");
  };

  const onSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await signUp(email, password, name || undefined);
    if (error) {
      toast({ title: "Registrierung fehlgeschlagen", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Registrierung gestartet",
      description: "Bitte bestätige ggf. deine E‑Mail. Danach kannst du dich einloggen.",
    });
    setMode("login");
  };

  return (
    <MobileShell title={mode === "login" ? "Einloggen" : "Registrieren"}>
      <SEO title="DropIt – Auth" description="Login oder Registrierung." />

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={mode === "login" ? "hero" : "outline"}
            onClick={() => setMode("login")}
          >
            Login
          </Button>
          <Button
            variant={mode === "signup" ? "hero" : "outline"}
            onClick={() => setMode("signup")}
          >
            Signup
          </Button>
        </div>

        <Card>
          <CardContent className="p-4">
            {mode === "login" ? (
              <form onSubmit={onLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label>E‑Mail</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Passwort</Label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <Button type="submit" variant="hero" className="w-full">Einloggen</Button>
              </form>
            ) : (
              <form onSubmit={onSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label>Name (optional)</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Dein Name" />
                </div>
                <div className="space-y-2">
                  <Label>E‑Mail</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Passwort</Label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <Button type="submit" variant="hero" className="w-full">Registrieren</Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </MobileShell>
  );
}

