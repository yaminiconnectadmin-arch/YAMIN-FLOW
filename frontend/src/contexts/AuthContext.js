import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = checking, false = unauth
  const [loading, setLoading] = useState(true);

  const check = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      // Ensure RBAC fields default correctly for non-admin roles
      if (data.role === "admin") {
        data.admin_role = data.admin_role || "super_admin";
        data.allowed_tabs = data.allowed_tabs || ["all"];
        data.must_change_password = data.must_change_password ?? false;
      }
      setUser(data);
    } catch {
      setUser(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { check(); }, [check]);

  const login = async (loginIdOrEmail, password) => {
    try {
      const { data } = await api.post("/auth/login", {
        login_id: loginIdOrEmail,
        email: loginIdOrEmail,
        user_code: loginIdOrEmail,
        password,
      });
      if (data.access_token) localStorage.setItem("yf_token", data.access_token);
      const u = data.user;
      if (u.role === "admin") {
        u.admin_role = u.admin_role || "super_admin";
        u.allowed_tabs = u.allowed_tabs || ["all"];
        u.must_change_password = u.must_change_password ?? false;
      }
      setUser(u);
      return { ok: true, user: u };
    } catch (e) {
      return { ok: false, error: formatApiErrorDetail(e.response?.data?.detail) || e.message };
    }
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch (e) { /* ignore */ }
    localStorage.removeItem("yf_token");
    localStorage.removeItem("yf_last_path");
    setUser(false);
  };

  /** Call after a successful password change to refresh the user object */
  const refreshUser = async (newToken) => {
    if (newToken) localStorage.setItem("yf_token", newToken);
    await check();
  };

  return (
    <AuthCtx.Provider value={{ user, loading, login, logout, refresh: check, refreshUser }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
