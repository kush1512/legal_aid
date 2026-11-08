import type * as T from "./types";

/**
 * The single interface the UI depends on. `real.ts` and `mock.ts` both
 * implement it, so screens never know which one is running.
 */
export interface LegalAidApi {
  readonly mode: "mock" | "real";
  health(): Promise<T.HealthStatus>;
  createCase(req: T.CreateCaseRequest): Promise<T.CreateCaseResponse>;
  listCases(q?: T.ListCasesQuery): Promise<T.Paginated<T.Case>>;
  getCase(id: string): Promise<{ case: T.Case }>;
  updateCasePrivacy(id: string, privateConversation: boolean): Promise<{ case: T.Case }>;
  /** Appends a user message and runs case understanding. The reply carries the assistant message. */
  sendMessage(caseId: string, req: T.SendMessageRequest): Promise<T.SendMessageResponse>;
  getAssessment(caseId: string): Promise<{ assessment: T.CaseAssessment }>;
  generateAssessment(caseId: string, req: { external_ai_consent?: boolean }): Promise<{ assessment: T.CaseAssessment }>;
  listCaseDocuments(caseId: string): Promise<T.Paginated<T.CaseDocument>>;
  searchLegal(req: T.LegalSearchRequest): Promise<T.LegalSearchResponse>;
  getProvision(id: string): Promise<{ provision: T.Provision }>;
  generateDocument(req: T.GenerateDocumentRequest): Promise<{ draft: T.GeneratedDraft }>;
  listPosts(q?: T.ListPostsQuery): Promise<T.Paginated<T.CommunityPost>>;
  createPost(req: T.CreatePostRequest): Promise<{ post: T.CommunityPost }>;
  listLawyers(q?: T.ListLawyersQuery): Promise<T.Paginated<T.Lawyer>>;
  getLawyer(id: string): Promise<{ lawyer: T.Lawyer }>;
  /** Additive voice endpoint (contract §4). */
  transcribe(file: Blob, opts: { caseId?: string; externalAiConsent: boolean }): Promise<T.TranscribeResponse>;
}
