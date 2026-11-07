import { config } from "./config";

/**
 * Minimal Supabase Auth (GoTrue REST) client so the browser never needs a
 * service key — only the public anon key. The access token is kept in
 * sessionStorage and attached by the API client as a Bearer token.
 */
const KEY = "la.session";
export interface Session {
  access_token: string;
  refresh_token?: string;
  expires_at: number; // epoch seconds
  email?: string;
}

export function isAuthConfigured() {
  return Boolean(config.supabaseUrl && config.supabaseAnonKey);
}

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    return s.expires_at * 1000 > Date.now() ? s : null;
  } catch {
    return null;
  }
}

export function getAccessToken(): string | null {
  return getSession()?.access_token ?? null;
}

export function signOut() {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {}
  window.dispatchEvent(new Event("la:auth"));
}

export async function signInWithPassword(email: string, password: string): Promise<Session> {
  if (!isAuthConfigured()) throw new Error("Supabase Auth is not configured.");
  const res = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: config.supabaseAnonKey },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error("Sign-in failed. Check your email and password.");
  const j = await res.json();
  const session: Session = {
    access_token: j.access_token,
    refresh_token: j.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + (j.expires_in ?? 3600),
    email: j.user?.email ?? email,
  };
  window.sessionStorage.setItem(KEY, JSON.stringify(session));
  window.dispatchEvent(new Event("la:auth"));
  return session;
}
