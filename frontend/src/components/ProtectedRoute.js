import React, { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { CircleNotch } from "@phosphor-icons/react";

export default function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (user && location.pathname !== "/" && location.pathname !== "/login") {
      localStorage.setItem("yf_last_path", location.pathname + location.search);
    }
  }, [user, location]);

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
