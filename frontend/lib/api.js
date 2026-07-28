import axios from "axios";
import { readStoredSession } from "@/lib/session-storage";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 90000
});

api.interceptors.request.use((config) => {
  const storedSession = typeof window !== "undefined" ? readStoredSession() : null;

  if (storedSession?.token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${storedSession.token}`;
  }

  return config;
});

export function buildGoogleAuthUrl(returnTo = "/dashboard") {
  const encodedReturnTo = encodeURIComponent(returnTo);
  return `${API_BASE_URL}/auth/google/start?returnTo=${encodedReturnTo}`;
}
