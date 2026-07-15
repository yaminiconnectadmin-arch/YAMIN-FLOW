import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { CircleNotch } from "@phosphor-icons/react";

export default function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading || user === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F5F7]">
        <CircleNotch size={28} className="animate-spin text-[#F28C18]" />
      </div>
    );
  }
  if (user === false) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}
