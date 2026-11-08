import { config } from "../config";
import { getAccessToken } from "../auth";
import { ApiError } from "./errors";
import type { LegalAidApi } from "./client";
import type * as T from "./types";

function qs(params: Record<string, string | number | undefined>) {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") p.set(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** The backend returns `{error:{code,...}}`, but FastAPI HTTPExceptions may be `{detail: string|{code,message}}`. Handle both. */
async function toApiError(res: Response): Promise<ApiError> {
  let body: any = null;
  try {
    body = await res.json();
  } catch {}
  const e = body?.error ?? (typeof body?.detail === "object" && !Array.isArray(body?.detail) ? body.detail : null);
  if (e?.code) {
    return new ApiError(res.status, e.code, e.message ?? res.statusText, e.details ?? [], e.request_id);
  }
  if (Array.isArray(body?.detail)) {
    // FastAPI default 422 shape
    return new ApiError(
      res.status,
      "VALIDATION_ERROR",
      "Validation failed",
      body.detail.map((d: any) => ({ field: (d.loc ?? []).slice(1).join("."), issue: d.msg })),
    );
  }
  const code =
    res.status === 401 ? "AUTHENTICATION_REQUIRED" : res.status === 404 ? "RESOURCE_NOT_FOUND" : res.status === 429 ? "RATE_LIMITED" : "UNKNOWN";
  return new ApiError(res.status, code, typeof body?.detail === "string" ? body.detail : res.statusText || "Request failed");
}

async function request<R>(path: string, init: RequestInit & { json?: unknown; formData?: FormData } = {}): Promise<R> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  else if (config.devUserId) headers["X-Dev-User-ID"] = config.devUserId;
  let body: BodyInit | undefined;
  if (init.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.json);
  } else if (init.formData) {
    body = init.formData; // browser sets multipart boundary
  }
  let res: Response;
  try {
    res = await fetch(`${config.apiBaseUrl}${config.apiPrefix}${path}`, {
      method: init.method ?? (body ? "POST" : "GET"),
      headers,
      body,
      cache: "no-store",
      signal: init.signal,
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Network request failed");
  }
  if (!res.ok) throw await toApiError(res);
  return (await res.json()) as R;
}

export const realApi: LegalAidApi = {
  mode: "real",
  health: () => request("/health"),
  createCase: (req) => request("/cases", { json: req }),
  listCases: (q = {}) => request(`/cases${qs({ ...q })}`),
  getCase: (id) => request(`/cases/${encodeURIComponent(id)}`),
  updateCasePrivacy: (id, privateConversation) => request(`/cases/${encodeURIComponent(id)}/privacy`, { method: "PATCH", json: { private_conversation: privateConversation } }),
  sendMessage: (id, req) => request(`/cases/${encodeURIComponent(id)}/messages`, { json: req }),
  getAssessment: (id) => request(`/cases/${encodeURIComponent(id)}/assessment`),
  generateAssessment: (id, req) => request(`/cases/${encodeURIComponent(id)}/assessment`, { method: "POST", json: req }),
  listCaseDocuments: (id) => request(`/cases/${encodeURIComponent(id)}/documents`),
  searchLegal: (req) => request("/legal/search", { json: req }),
  getProvision: (id) => request(`/legal/provision/${encodeURIComponent(id)}`),
  generateDocument: (req) => request("/documents/generate", { json: req }),
  listPosts: (q = {}) => request(`/community/posts${qs({ ...q })}`),
  createPost: (req) => request("/community/posts", { json: req }),
  listLawyers: (q = {}) => request(`/lawyers${qs({ ...q })}`),
  getLawyer: (id) => request(`/lawyers/${encodeURIComponent(id)}`),
  transcribe: (file, opts) => {
    const fd = new FormData();
    fd.append("file", file, (file as File).name || "recording.webm");
    if (opts.caseId) fd.append("case_id", opts.caseId);
    fd.append("external_ai_consent", String(opts.externalAiConsent));
    return request("/speech/transcribe", { formData: fd });
  },
};
