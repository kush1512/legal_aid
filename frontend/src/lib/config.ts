/**
 * Runtime configuration. Only NEXT_PUBLIC_* values are read, so nothing here
 * can contain a secret. NEXT_PUBLIC_API_BASE_URL is the backend ORIGIN
 * (e.g. https://api.example.com) — the client appends `/api/v1`.
 */
export type ApiMode = "mock" | "real";

export const config = {
  apiMode: (process.env.NEXT_PUBLIC_API_MODE === "real" ? "real" : "mock") as ApiMode,
  apiBaseUrl: (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000").replace(/\/+$/, ""),
  apiPrefix: "/api/v1",
  supabaseUrl: (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, ""),
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  /** Development-only: sent as X-Dev-User-ID. The backend ignores it outside development. */
  devUserId: process.env.NEXT_PUBLIC_DEV_USER_ID ?? "",
};

export const isMock = config.apiMode === "mock";
