# Legal Aid API Contract

**Version:** 1.0.0  
**Status:** Initial frontend integration contract  
**Base path:** `/api/v1`  
**Backend:** FastAPI / Pydantic  
**Database:** Supabase PostgreSQL  
**Authentication:** Supabase Auth JWT (Bearer)

This contract is authoritative for frontend/backend integration. Fields marked optional may be omitted; clients must not invent server-owned IDs or ownership fields.

## 1. Conventions

- JSON request and response bodies use UTF-8.
- IDs are UUID strings. Timestamps are ISO-8601 UTC strings.
- All authenticated routes require `Authorization: Bearer <supabase_access_token>`, except `GET /health`.
- The backend derives the user identity from the verified JWT. Never send `user_id` as an authorization input.
- List endpoints use `limit` (default 20, max 100) and `offset` (default 0).
- Unknown response fields should be ignored by clients for forward compatibility.
- Category values: `property_real_estate`, `marriage_family`, `digital_fraud_cybercrime`, `personal_safety_privacy`.
- Language is a BCP-47 tag where possible (e.g. `en`, `hi`, `as`, `bn`).
- Do not put confidential case information into free-tier external AI providers. The backend privacy gate may reject external processing.

## 2. Common envelopes

### Error
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request could not be processed.",
    "details": [{"field": "message", "issue": "Field is required"}],
    "request_id": "uuid"
  }
}
```

Clients should rely on `code`, not human-readable `message`.

### Pagination
List response shape:
```json
{
  "items": [],
  "page": {"limit": 20, "offset": 0, "total": 0, "has_more": false}
}
```

## 3. Shared schemas

### CaseCategory
```ts
type CaseCategory =
  | "property_real_estate"
  | "marriage_family"
  | "digital_fraud_cybercrime"
  | "personal_safety_privacy";
```

### CaseStatus
```ts
type CaseStatus = "intake" | "needs_information" | "analysed" | "closed";
```

### Case
```ts
interface Case {
  id: string;
  title: string;
  category: CaseCategory;
  status: CaseStatus;
  jurisdiction: {
    country: "IN";
    state?: string;
    district?: string;
    city?: string;
  };
  preferred_language: string;
  sensitive: boolean;
  synthetic_demo: boolean;
  created_at: string;
  updated_at: string;
  latest_message_at?: string | null;
}
```

### CaseMessage
```ts
interface CaseMessage {
  id: string;
  case_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  ai_metadata?: {
    provider: string;
    model: string;
    is_mock: boolean;
  } | null;
}
```

### ExtractedFact
```ts
interface ExtractedFact {
  id?: string;
  key: string;
  value: unknown;
  source: "user_provided" | "document" | "ai_inference";
  evidence_quote?: string | null;
  confidence?: number | null;
  verified: boolean;
}
```

### CommunityComment
```ts
interface CommunityComment {
  id: string;
  post_id: string;
  content: string;
  display_name: string;
  created_at: string;
  moderation_status: "pending" | "approved" | "rejected" | "removed";
}
```

### LegalCitation
```ts
interface LegalCitation {
  id: string;
  legal_document_id: string;
  act_name: string;
  section_label?: string | null;
  title?: string | null;
  source_url: string;
  source_status: "verified" | "unverified" | "historical" | "superseded";
  effective_from?: string | null;
  effective_to?: string | null;
  excerpt: string;
}
```

### CaseAssessment
```ts
interface CaseAssessment {
  id: string;
  case_id: string;
  generated_at: string;
  summary: string;
  parties: Array<{name?: string; role?: string; description?: string}>;
  timeline: Array<{date?: string; event: string; source: string}>;
  evidence: Array<{item: string; status?: string; relevance?: string}>;
  established_facts: string[];
  assumptions: string[];
  unknowns: string[];
  legal_position: string;
  potentially_relevant_laws: Array<{
    citation: LegalCitation;
    explanation: string;
    applicability: "likely" | "possible" | "uncertain" | "not_applicable";
  }>;
  options: Array<{title: string; description: string; risks: string[]; next_steps: string[]}>;
  follow_up_questions: string[];
  overall_uncertainty: "low" | "medium" | "high";
  confidence: number;
  escalation_required: boolean;
  escalation_reason?: string | null;
  escalation_details?: {
    required: boolean;
    priority: "urgent" | "time_sensitive";
    instructions: string[];
    contacts: Array<{name: string; number: string; url: string}>;
    source_note: string;
  } | null;
  disclaimer: string;
  model: {provider: string; name: string; version?: string; is_mock: boolean};
}
```

### GeneratedDraft
```ts
interface GeneratedDraft {
  id: string;
  case_id?: string | null;
  document_type: "legal_notice" | "complaint" | "reply" | "application" | "incident_summary" | "evidence_checklist";
  title: string;
  content: string;
  placeholders: string[];
  citations: LegalCitation[];
  review_required: true;
  created_at: string;
  model: {provider: string; name: string; is_mock: boolean};
}
```

### Lawyer
```ts
interface Lawyer {
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
```

## 4. Endpoints

### POST /cases
Create an intake case.

**Request**
```json
{
  "title": "Property possession dispute",
  "category": "property_real_estate",
  "description": "Describe what happened in your own words.",
  "jurisdiction": {"country": "IN", "state": "Assam", "district": "Kamrup"},
  "preferred_language": "en",
  "synthetic_demo": false
}
```
Required: `category`, `description`. Other fields optional; omitted title may be generated from the description. Clients cannot set case sensitivity. The backend sets real cases to `sensitive=true`. Only a configured synthetic-demo account may set `synthetic_demo=true`; demo status is also subject to server-side allowlisting.

**201 Response**
```json
{
  "case": {
    "id": "uuid",
    "title": "Property possession dispute",
    "category": "property_real_estate",
    "status": "intake",
    "jurisdiction": {"country": "IN", "state": "Assam", "district": "Kamrup"},
    "preferred_language": "en",
    "sensitive": true,
    "synthetic_demo": false,
    "created_at": "2026-11-06T10:00:00Z",
    "updated_at": "2026-11-06T10:00:00Z"
  },
  "initial_message": {
    "id": "uuid", "case_id": "uuid", "role": "user",
    "content": "Describe what happened in your own words.",
    "created_at": "2026-11-06T10:00:00Z"
  }
}
```

### GET /cases
List the authenticated user's cases.

Query: `limit`, `offset`, optional `category`, optional `status`.

**200 Response:** paginated `items: Case[]`.

### GET /cases/{id}
Return one owned case.

**200 Response:** `{"case": Case}`.

### GET /cases/{id}/messages

Return the authenticated owner's conversation for the case in chronological order.

**200 Response**
```json
{
  "items": [
    {
      "id": "uuid",
      "case_id": "uuid",
      "role": "user",
      "content": "The agreement was signed in January.",
      "created_at": "2026-11-06T10:00:00Z",
      "ai_metadata": null
    }
  ]
}
```
The response is owner-scoped. The frontend should use this endpoint to restore conversation state after reload.

### POST /cases/{id}/messages
Append a user message and run case understanding. The assistant reply can request missing facts. The backend may return `202` when analysis is queued; current synchronous contract returns `201`.

**Request**
```json
{
  "content": "The seller has not handed over possession after receiving the payment.",
  "language": "en",
  "input_mode": "text"
}
```
`input_mode`: `text` or `voice_transcription`.

**201 Response**
```json
{
  "user_message": {"id":"uuid","case_id":"uuid","role":"user","content":"...","created_at":"..."},
  "assistant_message": {"id":"uuid","case_id":"uuid","role":"assistant","content":"...","created_at":"..."},
  "case_status": "needs_information",
  "follow_up_questions": ["When was the agreement signed?"],
  "extracted_facts": [],
  "ai": {"provider":"gemini","model":"configured-model","is_mock":false},
  "escalation": {
    "required": true,
    "priority": "urgent",
    "instructions": ["Call 112 if anyone is in immediate danger."],
    "contacts": [{"name":"India Emergency Response Support System","number":"112","url":"https://112.gov.in/"}]
  }
}
```

### POST /cases/{id}/documents

Upload a private document to an owned case using multipart form data with one `file` field. The backend validates the extension, MIME/signature, and `MAX_UPLOAD_BYTES` limit, then writes bytes to the private Supabase `case-files` bucket and saves metadata. Supported extensions: PDF, PNG, JPG/JPEG, TXT, DOC and DOCX. No local disk persistence is used.

**201 Response**
```json
{
  "document": {
    "id": "uuid",
    "case_id": "uuid",
    "file_name": "agreement.pdf",
    "mime_type": "application/pdf",
    "size_bytes": 12345,
    "created_at": "2026-11-06T10:00:00Z"
  }
}
```

### POST /cases/{id}/assessment

Generate and persist a new case assessment. The backend loads the case conversation, searches the official indexed legal knowledge base, and supplies only verified/historical indexed passages to the LLM. Citations are assembled by the backend from retrieved source records; the model cannot invent citation IDs or URLs. When no verified source is available, the API explicitly returns no legal conclusion and no potentially applicable laws.

**Request**
```json
{
  "external_ai_consent": false
}
```

**200 Response:** `{"assessment": CaseAssessment}`. The response includes model provider/model metadata and retrieved citations. Sensitive case processing is blocked unless server policy and explicit consent both permit external use. `GET /cases/{id}/assessment` returns the latest saved assessment.

### GET /cases/{id}/assessment
Return the latest assessment. If none exists, respond `404 ASSESSMENT_NOT_FOUND`.

**200 Response:** `{"assessment": CaseAssessment}`.

### GET /cases/{id}/documents
List private documents linked to an owned case.

**200 Response**
```json
{
  "items": [{
    "id":"uuid", "case_id":"uuid", "file_name":"sale_deed.pdf",
    "mime_type":"application/pdf", "size_bytes":12345,
    "created_at":"...", "download_url":"https://signed-private-url",
    "download_url_expires_at":"..."
  }],
  "page":{"limit":20,"offset":0,"total":1,"has_more":false}
}
```
URLs are short-lived signed URLs; never expose storage object paths as public URLs.

### POST /legal/search
Search the verified legal knowledge base as of a requested date. If omitted, the server uses the current India-local date. Effective-from/effective-to metadata is applied in SQL; historical versions are returned only for dates within their recorded effective period. This endpoint does not itself assert legal applicability.

**Request**
```json
{
  "query": "remedy for non-delivery of property possession",
  "category": "property_real_estate",
  "jurisdiction": {"country":"IN","state":"Assam"},
  "language": "en",
  "as_of_date": "2026-11-06",
  "limit": 10
}
```

**200 Response**
```json
{
  "results": [{
    "citation": {
      "id":"uuid", "legal_document_id":"uuid", "act_name":"Example Act",
      "section_label":"Section X", "source_url":"https://official.example",
      "source_status":"verified", "excerpt":"Exact indexed excerpt"
    },
    "relevance_score": 0.82,
    "retrieval_method": "hybrid"
  }],
  "warning": "Retrieved provisions require fact-specific applicability review."
}
```
No result must be returned rather than fabricated citations.

### GET /legal/provision/{id}
Get an indexed provision and its provenance.

**200 Response**
```json
{
  "provision": {
    "citation": {"id":"uuid","legal_document_id":"uuid","act_name":"...","section_label":"...","source_url":"...","source_status":"verified","excerpt":"..."},
    "full_text":"...",
    "document_version":"...",
    "effective_from":"...",
    "effective_to":null,
    "jurisdiction":"IN"
  }
}
```

### POST /documents/generate
Generate a preliminary draft. Drafts are not filed, signed, approved or a substitute for professional review.

**Request**
```json
{
  "document_type": "legal_notice",
  "case_id": "uuid",
  "instructions": "Request delivery of vacant possession within a reasonable period.",
  "language": "en",
  "synthetic_demo": false
}
```
For a standalone draft, `case_id` may be omitted and `facts` supplied instead.

**201 Response:** `{"draft": GeneratedDraft}`.

### GET /community/posts
List public community posts. Query: `limit`, `offset`, optional `category`, optional `sort` (`newest` or `popular`); popular ordering uses server-computed approved-comment and post-vote counts.

**200 Response:** paginated `items: CommunityPost[]`. Private case data is never automatically published.

### POST /community/posts
Create a community post. Anonymity is a display option, not a guarantee of anonymity.

**Request**
```json
{
  "title": "How can I document a rental deposit dispute?",
  "content": "I am looking for general guidance...",
  "category": "property_real_estate",
  "anonymous": true
}
```
**201 Response:** `{"post": CommunityPost}`.

CommunityPost:
```ts
interface CommunityPost {
  id: string; title: string; content: string; category: CaseCategory;
  display_name: string; anonymous: boolean; created_at: string;
  comment_count: number; vote_count: number;
}
```

### GET /community/posts/{id}/comments

List approved comments on an approved community post. Query: `limit` (default 50, max 100), `offset`.

**200 Response:** paginated `items: CommunityComment[]`. Pending/rejected/removed comments are excluded.

### POST /community/posts/{id}/comments

Create a comment on an approved community post. New comments enter moderation as `pending`.

**Request**
```json
{"content":"A useful response to the post."}
```

**201 Response**
```json
{
  "comment": {
    "id":"uuid",
    "post_id":"uuid",
    "content":"A useful response to the post.",
    "display_name":"Community member",
    "created_at":"2026-11-06T10:00:00Z",
    "moderation_status":"pending"
  }
}
```

### POST /community/posts/{id}/votes

Cast or replace the authenticated user's vote on an approved post. A second vote from the same user replaces the first; it does not create a second vote.

**Request**
```json
{"value":1}
```
Allowed values: `1` (upvote), `-1` (downvote).

**200 Response:** `{"vote":{"post_id":"uuid","value":1}}`.

### DELETE /community/posts/{id}/votes

Remove the authenticated user's vote from an approved post.

**200 Response:** `{"removed":true}` if a vote was removed, otherwise `{"removed":false}`.

### GET /lawyers
List lawyer profiles. Query: `limit`, `offset`, optional `category`, `state`, `city`, `language`. Only approved/verified profiles are returned by default.

**200 Response:** paginated `items: Lawyer[]`.

### GET /lawyers/{id}
Get a lawyer's public profile.

**200 Response:** `{"lawyer": Lawyer}`.

### GET /health
Unauthenticated readiness/liveness check.

**200 Response**
```json
{
  "status":"ok",
  "version":"0.1.0",
  "environment":"development",
  "dependencies":{
    "database":"not_configured",
    "llm":"mock",
    "embeddings":"local"
  }
}
```
Health response must not reveal secrets, internal URLs, stack traces or sensitive configuration.

### POST /speech/transcribe (additive voice endpoint)
Multipart form fields: `file` (required audio file), `case_id` (optional UUID), `synthetic_demo` (boolean, defaults false for standalone audio), and `external_ai_consent` (boolean, defaults false). External transcription requires an allowlisted demo account, backend opt-in, explicit synthetic flag/case marker, and request consent. Real case audio is blocked.

Accepted extensions: WAV, MP3, M4A, MPEG/MPGA, WebM, OGG and FLAC. The maximum size is controlled by `MAX_AUDIO_BYTES`. Sensitive cases are blocked by the privacy gate unless both the server policy and explicit user consent permit external speech processing. Audio is processed in memory and is not stored by the application.

**200 Response**
```json
{
  "transcript": "Recognized speech text",
  "provider": "groq_whisper",
  "model": "whisper-large-v3-turbo",
  "audio_stored": false
}
```
When transcription is blocked or unavailable, offer the normal text-message endpoint as fallback.

### Safety escalation metadata

`POST /cases/{id}/messages` may return an optional `escalation` object. It is generated by deterministic rules for recognized urgent phrases and payment-fraud reports, independently of LLM detection. For immediate physical danger, it points to India's official ERSS emergency number 112. For suspected online financial fraud, it points to the National Cyber Crime Reporting Portal helpline 1930 and portal. These channels do not guarantee response or recovery; do not delay contacting emergency services.

### POST /lawyers

Submit a lawyer profile for review. The backend sets `verification_status=pending`; clients cannot self-verify.

**Request**
```json
{
  "display_name":"Advocate Name",
  "bio":"Practice summary",
  "bar_council_enrolment":"Enrollment identifier",
  "jurisdictions":["Assam"],
  "practice_areas":["property_real_estate"],
  "languages":["en","as"],
  "city":"Guwahati",
  "state":"Assam"
}
```

**201 Response:** `{"lawyer": Lawyer}` with `verification_status="pending"`.

### POST /reports

Report one approved public post, approved comment, or verified lawyer profile. Exactly one target field must be supplied.

**Request**
```json
{
  "post_id":"uuid",
  "reason":"Personal information disclosed",
  "details":"Optional context for the moderation team."
}
```

**201 Response:** `{"report":{"id":"uuid","status":"open","created_at":"..."}}`.

### Administrator moderation routes

All routes below require the authenticated user ID to be present in the backend-only `ADMIN_USER_IDS` environment variable. Never expose or accept an admin role from the frontend.

| Method and path | Purpose |
|---|---|
| `GET /admin/reports` | List reports; supports `limit`, `offset`, `status` |
| `PATCH /admin/reports/{id}` | Set report status to `reviewing`, `resolved` or `dismissed` |
| `PATCH /admin/community/posts/{id}/moderation` | Set post status to `approved`, `rejected` or `removed` |
| `PATCH /admin/community/comments/{id}/moderation` | Set comment moderation status |
| `PATCH /admin/lawyers/{id}/verification` | Set lawyer status to `verified` or `rejected`, with optional reviewer notes |

These endpoints are version-prefixed under `/api/v1`. Admin actions are server-authorized; a client-supplied role, user ID or boolean flag does not grant admin access.

## 5. HTTP status and error codes

| Status | Meaning |
|---|---|
| 200 | Successful read/action |
| 201 | Resource created |
| 400 | Invalid request or state transition |
| 401 | Missing/invalid authentication |
| 403 | Authenticated but not permitted; privacy policy blocked operation |
| 404 | Resource not found or not owned (avoid ID enumeration) |
| 409 | Conflict |
| 413 | Upload too large |
| 415 | Unsupported file/audio type |
| 422 | Schema validation failure |
| 429 | Rate limit exceeded |
| 502 | Upstream provider failure |
| 503 | Required dependency unavailable |
| 504 | Upstream timeout |

Stable error codes include `VALIDATION_ERROR`, `AUTHENTICATION_REQUIRED`, `FORBIDDEN`, `RESOURCE_NOT_FOUND`, `PRIVACY_GATE_BLOCKED`, `RATE_LIMITED`, `PROVIDER_UNAVAILABLE`, `PROVIDER_TIMEOUT`, `LEGAL_SOURCE_UNAVAILABLE`, `ASSESSMENT_NOT_FOUND`, and `INTERNAL_ERROR`.

## 6. Security and privacy expectations

- All case, message, assessment, document and draft operations are owner-scoped.
- Frontend must not send a trusted user ID; derive identity from Supabase Auth.
- Supabase service-role secret is backend-only. Frontend receives only the anon/publishable key.
- Private files use private buckets and expiring signed URLs.
- Do not log prompts, case facts, message bodies, access tokens, document contents or personally identifying details.
- Free-tier LLM credentials are for synthetic demonstration data only.
- External providers are disabled by default. They require `ALLOW_EXTERNAL_LLM_FOR_SYNTHETIC=true`, an account UUID in `SYNTHETIC_DEMO_USER_IDS`, a case created with `synthetic_demo=true`, and explicit per-request consent.
- Real cases are always marked sensitive by the backend; the client cannot downgrade sensitivity.
- No silent provider fallback for sensitive content.
- The backend can block external model calls even when `sensitive=false` if its classifier or policy requires it.
- AI outputs are informational, may be incomplete, and are not legal representation.

## 7. Frontend integration checklist

1. Configure `NEXT_PUBLIC_API_BASE_URL` to the backend origin (without `/api/v1` if the client appends it; choose one convention and use it consistently).
2. Configure Supabase Auth in the frontend and attach the current access token to every authenticated API request.
3. Use the exact enum strings and request shapes above.
4. Treat `follow_up_questions` as optional and preserve the full conversation by `case_id`.
5. Render AI-generated legal content with citations, source status and uncertainty indicators.
6. Render every generated draft with a prominent review-required notice.
7. Never infer that an upload or a generated draft was legally filed.
8. Handle `401`, `403`, `404`, `413`, `415`, `429`, `502`, `503` and `504` explicitly.
