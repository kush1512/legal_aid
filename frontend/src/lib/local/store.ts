/**
 * Tiny typed wrapper over web storage. All access is try/catch-guarded
 * because storage can be unavailable (private mode, quota, SSR).
 */
type Kind = "local" | "session";

function area(kind: Kind): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readJson<T>(key: string, fallback: T, kind: Kind = "local"): T {
  const s = area(kind);
  if (!s) return fallback;
  try {
    const raw = s.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown, kind: Kind = "local") {
  const s = area(kind);
  if (!s) return;
  try {
    s.setItem(key, JSON.stringify(value));
  } catch {}
}

export function removeKey(key: string, kind: Kind = "local") {
  try {
    area(kind)?.removeItem(key);
  } catch {}
}
