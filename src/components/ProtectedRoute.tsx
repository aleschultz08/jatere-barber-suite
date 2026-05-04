import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ReactNode } from "react";

type Role = "admin" | "barber" | "client";

export const ProtectedRoute = ({ children, allow }: { children: ReactNode; allow: Role[] }) => {
  const { user, role, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Cargando...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (role && !allow.includes(role)) {
    const dest = role === "admin" ? "/admin" : role === "barber" ? "/barber" : "/cliente";
    return <Navigate to={dest} replace />;
  }
  return <>{children}</>;
};
