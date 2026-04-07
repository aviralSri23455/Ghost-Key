import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GhostKeyProvider } from "@/lib/GhostKeyContext";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import { Auth0ProviderWithNavigate } from "@/lib/Auth0ProviderWithNavigate";
import AppLayout from "@/components/AppLayout";
import AIAgentChat from "@/components/AIAgentChat";
import Index from "./pages/Index";
import ConsentPage from "./pages/ConsentPage";
import AuditPage from "./pages/AuditPage";
import DemoPage from "./pages/DemoPage";
import NotFound from "./pages/NotFound";
import LoginPage from "./pages/LoginPage";
import LandingPage from "./pages/LandingPage";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <GhostKeyProvider>
      <AppLayout>
        <Routes>
          <Route index element={<Index />} />
          <Route path="consent" element={<ConsentPage />} />
          <Route path="audit" element={<AuditPage />} />
          <Route path="demo" element={<DemoPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppLayout>
      <AIAgentChat />
    </GhostKeyProvider>
  );
}

function AppRoutes() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/app/*" element={<ProtectedRoutes />} />
        <Route path="/consent" element={<Navigate to="/app/consent" replace />} />
        <Route path="/audit" element={<Navigate to="/app/audit" replace />} />
        <Route path="/demo" element={<Navigate to="/app/demo" replace />} />
      </Routes>
    </AuthProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Auth0ProviderWithNavigate>
          <AppRoutes />
        </Auth0ProviderWithNavigate>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
