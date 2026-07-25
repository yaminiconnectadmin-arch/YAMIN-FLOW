import React, { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { CircleNotch } from "@phosphor-icons/react";
import ForcePasswordReset from "@/components/ForcePasswordReset";

/**
 * ProtectedRoute — guards routes by role and, for admin staff, by allowed_tabs.
 *
 * Props:
 *   roles    – array of allowed role strings (e.g. ["admin", "mnp"])
 *   tabKey   – the tab key for this route (e.g. "products").
 *              If provided, staff admins must have this key in their allowed_tabs.
 *   children – the protected page component
 */
export default function ProtectedRoute({ roles, tabKey, children }) {
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

  // Role-level gate
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;

  // Tab-level gate for staff admins
  // super_admins and allowed_tabs=["all"] always pass
  if (
    tabKey &&
    user.role === "admin" &&
    user.admin_role === "staff"
  ) {
    const tabs = user.allowed_tabs || [];
    if (!tabs.includes("all") && !tabs.includes(tabKey)) {
      // Find the first tab they DO have access to
      const TAB_PATHS = {
        dashboard: "/dashboard",
        analytics: "/analytics",
        products: "/products",
        inventory: "/inventory",
        orders: "/orders",
        procurement: "/procurement",
        "purchase-orders": "/purchase-orders",
        dealers: "/dealers",
        mnp: "/mnp",
        suppliers: "/suppliers",
        warehouses: "/warehouses",
        tally: "/tally",
        notifications: "/notifications",
        audit: "/audit",
        settings: "/settings",
      };
      const firstAllowedTab = tabs.find((t) => TAB_PATHS[t]);
      if (firstAllowedTab) {
        return <Navigate to={TAB_PATHS[firstAllowedTab]} replace />;
      }
      return <Navigate to="/login" replace />;
    }
  }

  // Force password reset overlay — non-dismissible
  if (user.must_change_password) {
    return (
      <>
        {children}
        <ForcePasswordReset />
      </>
    );
  }

  return children;
}
