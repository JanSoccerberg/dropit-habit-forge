
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import CreateChallenge from "./pages/CreateChallenge";
import JoinChallenge from "./pages/JoinChallenge";
import ChallengeDetail from "./pages/ChallengeDetail";
import Profile from "./pages/Profile";
import Auth from "./pages/Auth";
import { useAuthBridge } from "@/hooks/useAuthBridge";
import { useBootstrapChallenges } from "@/hooks/useBootstrapChallenges";
 
 const queryClient = new QueryClient();

const App = () => {
  // Bridge Auth/Profile global für die App (synchronisiert Supabase ⟷ lokaler Store)
  useAuthBridge();
  // Bootstrap: lade alle DB‑Challenges des Users in den lokalen Store
  useBootstrapChallenges();
  return (
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/create" element={<CreateChallenge />} />
              <Route path="/join" element={<JoinChallenge />} />
              <Route path="/challenge/:id" element={<ChallengeDetail />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/auth" element={<Auth />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </HelmetProvider>
    </QueryClientProvider>
  );
};

export default App;

