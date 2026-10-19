import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedLayout from "@/components/ProtectedLayout";
import Index from "@/pages/Index";
import Auth from "@/pages/Auth";
import NotFound from "@/pages/NotFound";
import Overview from "@/pages/dashboard/Overview";
import Keys from "@/pages/dashboard/Keys";
import Usage from "@/pages/dashboard/Usage";
import Models from "@/pages/dashboard/Models";
import Guide from "@/pages/dashboard/Guide";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15_000 },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route element={<ProtectedLayout />}>
              <Route path="/dashboard" element={<Overview />} />
              <Route path="/dashboard/keys" element={<Keys />} />
              <Route path="/dashboard/usage" element={<Usage />} />
              <Route path="/dashboard/models" element={<Models />} />
              <Route path="/dashboard/guide" element={<Guide />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
          <Toaster position="top-right" />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
