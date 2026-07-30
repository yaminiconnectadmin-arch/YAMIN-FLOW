import axios from "axios";

const rawUrl = process.env.REACT_APP_BACKEND_URL;
const isProd = typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1";
const fallbackUrl = isProd ? "https://yaminiflow-backend.vercel.app" : "http://localhost:8000";

const backendUrl = (rawUrl && rawUrl !== "undefined" && rawUrl !== "http://localhost:8000") ? rawUrl : fallbackUrl;
export const API_BASE = `${backendUrl.replace(/\/$/, "")}/api`;


export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});


// Attach access token from localStorage as a fallback (bearer)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("yf_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function formatApiErrorDetail(detail) {
  if (detail == null) return null;
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
