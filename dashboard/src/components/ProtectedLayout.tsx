import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Loader } from "@/components/ui/Loader";

/**
 * Gate for the control-plane shell. While the control plane is unconfigured
 * (local build), the gate stays open with a demo identity so every surface
 * stays browsable and testable.
 */
export default function ProtectedLayout() {
  const { user, loading, controlPlaneConfigured } = useAuth();
  const location = useLocation();

  if (loading || (controlPlaneConfigured && !user)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!controlPlaneConfigured && !user) {
    // demo pass-through
  } else if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }
  return (
    <DashboardLayout>
      <Outlet />
    </DashboardLayout>
  );
}
