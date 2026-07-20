import axios from "axios";

const rawUrl = process.env.REACT_APP_BACKEND_URL;
const backendUrl = rawUrl && rawUrl !== "undefined" ? rawUrl : "http://localhost:8000";
export const API_BASE = `${backendUrl.replace(/\/$/, "")}/api`;

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// Attach access token from localStorage as a fallback (bearer)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("yf_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function formatApiErrorDetail(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).filter(Boolean).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export const fmt = {
  inr: (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,
  num: (n) => Number(n || 0).toLocaleString("en-IN"),
  kg: (n) => `${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 3 })} KG`,
  pcs: (n) => `${Number(n || 0).toLocaleString("en-IN")} PCS`,
  date: (s) => {
    if (!s) return "—";
    try { return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); } catch { return s; }
  },
  datetime: (s) => {
    if (!s) return "—";
    try { return new Date(s).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); } catch { return s; }
  },
};
