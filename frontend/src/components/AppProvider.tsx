"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_PREFS, loadPrefs, savePrefs, type Prefs } from "@/lib/local/prefs";
import { getSession, isAuthConfigured, signOut as doSignOut, type Session } from "@/lib/auth";
import { config, isMock } from "@/lib/config";

interface Ctx {
  prefs: Prefs;
  updatePrefs: (patch: Partial<Prefs>, consentEvent?: { scope: string; granted: boolean }) => void;
  session: Session | null;
  signOut: () => void;
  ready: boolean;
  mode: "mock" | "real";
  /** True when requests are authenticated by a bearer token or a dev header. */
  hasIdentity: boolean;
}
const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside AppProvider");
  return c;
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPrefs(loadPrefs());
    setSession(getSession());
    setReady(true);
    const onAuth = () => setSession(getSession());
    window.addEventListener("la:auth", onAuth);
    return () => window.removeEventListener("la:auth", onAuth);
  }, []);

  const updatePrefs = useCallback((patch: Partial<Prefs>, ev?: { scope: string; granted: boolean }) => {
    setPrefs((cur) => {
      const next: Prefs = {
        ...cur, ...patch,
        consentLog: ev ? [{ at: new Date().toISOString(), ...ev }, ...cur.consentLog].slice(0, 20) : cur.consentLog,
      };
      savePrefs(next);
      return next;
    });
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      prefs, updatePrefs, session, ready, signOut: doSignOut, mode: isMock ? "mock" : "real",
      hasIdentity: isMock || Boolean(session) || Boolean(config.devUserId),
    }),
    [prefs, updatePrefs, session, ready],
  );
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
export { isAuthConfigured };
