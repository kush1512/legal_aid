/**
 * Types mirror API_CONTRACT.md v1.0.0 of the backend repository
 * (github.com/kush1512/legal_aid). Do not add fields the backend does not
 * return. Frontend-only concepts live in `src/lib/local/types.ts`.
 */
export type CaseCategory =
  | "property_real_estate"
  | "marriage_family"
  | "digital_fraud_cybercrime"
  | "personal_safety_privacy";

export type CaseStatus = "intake" | "needs_information" | "analysed" | "closed";
export type InputMode = "text" | "voice_transcription";

export interface Jurisdiction {
  country: "IN";
  state?: string;
  district?: string;
  city?: string;
}

export interface Case {
  id: string;
  title: string;
  category: CaseCategory;
  status: CaseStatus;
  jurisdiction: Jurisdiction;
  preferred_language: string;
  sensitive: boolean;
  synthetic_demo?: boolean;
  created_at: string;
  updated_at: string;
  latest_message_at?: string | null;
}

export interface AiMetadata {
  provider: string;
  model: string;
  is_mock: boolean;
  version?: string | null;
  blocked?: boolean;
}

export interface CaseMessage {
  id: string;
  case_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  ai_metadata?: AiMetadata | null;
}

export interface ExtractedFact {
  id?: string;
  key: string;
  value: unknown;
  source: "user_provided" | "document" | "ai_inference";
  confidence?: number | null;
  verified: boolean;
}

export type SourceStatus = "verified" | "unverified" | "historical" | "superseded";

export interface LegalCitation {
  id: string;
  legal_document_id: string;
  act_name: string;
  section_label?: string | null;
  title?: string | null;
  source_url: string;
  source_status: SourceStatus;
  effective_from?: string | null;
  effective_to?: string | null;
  excerpt: string;
}

export type Applicability = "likely" | "possible" | "uncertain" | "not_applicable";

export interface CaseAssessment {
  id: string;
  case_id: string;
  generated_at: string;
  summary: string;
  parties: Array<{ name?: string; role?: string; description?: string }>;
  timeline: Array<{ date?: string; event: string; source: string }>;
  evidence: Array<{ item: string; status?: string; relevance?: string }>;
  established_facts: string[];
  assumptions: string[];
  unknowns: string[];
  legal_position: string;
  potentially_relevant_laws: Array<{
    citation: LegalCitation;
    explanation: string;
    applicability: Applicability;
  }>;
  options: Array<{ title: string; description: string; risks: string[]; next_steps: string[] }>;
  follow_up_questions: string[];
  overall_uncertainty: "low" | "medium" | "high";
  confidence: number;
  escalation_required: boolean;
  escalation_reason?: string | null;
  disclaimer: string;
  model: { provider: string; name: string; version?: string; is_mock: boolean };
}

export type DocumentType =
  | "legal_notice"
  | "complaint"
  | "reply"
  | "application"
  | "incident_summary"
  | "evidence_checklist";

export interface GeneratedDraft {
  id: string;
  case_id?: string | null;
  document_type: DocumentType;
  title: string;
  content: string;
  placeholders: string[];
  citations: LegalCitation[];
  review_required: true;
  created_at: string;
  model: { provider: string; name: string; is_mock: boolean };
}

export interface CaseDocument {
  id: string;
  case_id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  download_url?: string;
  download_url_expires_at?: string;
}

export interface Lawyer {
  id: string;
  display_name: string;
  bar_council_enrolment?: string | null;
  jurisdictions: string[];
  practice_areas: CaseCategory[];
  languages: string[];
  verification_status: "pending" | "verified" | "rejected";
  bio?: string | null;
  city?: string | null;
  state?: string | null;
}

export interface CommunityPost {
  id: string;
  title: string;
  content: string;
  category: CaseCategory;
  display_name: string;
  anonymous: boolean;
  created_at: string;
  comment_count: number;
  vote_count: number;
  /** Returned by POST /community/posts only. */
  moderation_status?: string;
}

export interface Provision {
  citation: LegalCitation;
  full_text: string;
  document_version?: string;
  effective_from?: string | null;
  effective_to?: string | null;
  jurisdiction?: string;
}

export interface LegalSearchItem {
  citation: LegalCitation;
  relevance_score: number;
  retrieval_method: "hybrid" | "keyword" | "semantic";
}

export interface Page {
  limit: number;
  offset: number;
  total: number;
  has_more: boolean;
}
export interface Paginated<T> {
  items: T[];
  page: Page;
}

export interface HealthStatus {
  status: string;
  version: string;
  environment: string;
  dependencies: { database: string; llm: string; embeddings: string };
}

// ---- Requests ----
export interface CreateCaseRequest {
  title?: string;
  category: CaseCategory;
  description: string;
  jurisdiction?: Jurisdiction;
  preferred_language?: string;
  sensitive?: boolean;
  external_ai_consent?: boolean;
  synthetic_demo?: boolean;
}
export interface CreateCaseResponse {
  case: Case;
  initial_message: CaseMessage;
}
export interface SendMessageRequest {
  content: string;
  language?: string;
  input_mode?: InputMode;
  external_ai_consent?: boolean;
}
export interface SendMessageResponse {
  user_message: CaseMessage;
  assistant_message: CaseMessage;
  case_status: CaseStatus;
  follow_up_questions: string[];
  extracted_facts: ExtractedFact[];
  ai: AiMetadata;
}
export interface LegalSearchRequest {
  query: string;
  category?: CaseCategory;
  jurisdiction?: Jurisdiction;
  language?: string;
  limit?: number;
}
export interface LegalSearchResponse {
  results: LegalSearchItem[];
  warning: string;
}
export interface GenerateDocumentRequest {
  document_type: DocumentType;
  case_id?: string;
  instructions?: string;
  language?: string;
  facts?: Record<string, unknown>;
  external_ai_consent?: boolean;
}
export interface CreatePostRequest {
  title: string;
  content: string;
  category: CaseCategory;
  anonymous: boolean;
}
export interface ListCasesQuery {
  limit?: number;
  offset?: number;
  category?: CaseCategory;
  status?: CaseStatus;
}
export interface ListPostsQuery {
  limit?: number;
  offset?: number;
  category?: CaseCategory;
  sort?: "newest" | "popular";
}
export interface ListLawyersQuery {
  limit?: number;
  offset?: number;
  category?: CaseCategory;
  state?: string;
  city?: string;
  language?: string;
}
export interface TranscribeResponse {
  transcript: string;
  provider: string;
  model: string;
  audio_stored: boolean;
}
