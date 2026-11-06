# Architecture

## Design

A modular monolith with one FastAPI deployment. Modules communicate through Python interfaces and service functions; they are not independently deployed microservices.

```text
Next.js frontend
   |
   | HTTPS + Supabase Auth access token
   v
FastAPI /api/v1
   |-- auth / request validation / rate limiting
   |-- cases and conversation service
   |-- assessment and preliminary drafting
   |-- legal search / source verification
   |-- community and lawyer directory
   |-- speech transcription
   |
   +--> LLMProvider interface
   |      |-- MockProvider
   |      |-- GeminiProvider
   |      |-- GroqProvider
   |      |-- OpenAIProvider (optional)
   |      '-- AnthropicProvider (optional)
   |
   +--> EmbeddingProvider
   |      '-- local Sentence Transformers multilingual-e5-small
   |
   +--> Supabase PostgreSQL + pgvector + Auth + private Storage
```

## Responsibility boundaries

| Module | Responsibility |
|---|---|
| `app/main.py` | HTTP wiring, middleware, route handlers, error envelope |
| `app/schemas.py` | Pydantic API contracts |
| `app/security.py` | Supabase JWT validation and dev-only auth bypass |
| `app/config.py` | Environment configuration |
| `app/storage.py` | User-scoped persistence and private signed URLs |
| `app/llm.py` | Provider interface, adapters, retry, fallback, privacy gate |
| `app/ai_models.py` | Structured AI extraction/assessment/draft models |
| `app/embeddings.py` | Configurable embedding adapter and E5 prefixes |
| `app/legal_rag.py` | Hybrid retrieval, cache and source verification |
| `app/speech.py` | Speech provider interface and Groq Whisper adapter |
| Admin/moderation routes | Admin UUID allowlist, report queue, community post review and lawyer verification |
| `scripts/ingest_legal.py` | Official-source download, extraction, chunking and embedding |
| `supabase/migrations/` | Database schema, indexes, functions and RLS |

## Case lifecycle

1. The caller authenticates using a Supabase access token.
2. The backend validates the token and derives the user UUID from `sub`.
3. The user submits a case; the backend creates the case and first user message.
4. The user adds messages. The case-understanding model returns structured fields and missing questions.
5. A conservative intake-stage assessment snapshot is saved. It separates user-stated facts from unknowns and intentionally does not state applicable laws before verified retrieval.
6. Later legal analysis must retrieve current/dated legal source chunks, validate provision provenance and only then generate an applicability explanation.
7. Draft generation uses supplied facts and placeholders. It does not file or approve documents.

## Privacy boundary

- Every case row is owner-scoped by `user_id`; related records carry both `user_id` and `case_id`.
- JWT identity, not client-supplied user IDs, controls authorization.
- Supabase RLS is the second authorization layer.
- Service-role credentials are used only by backend administrative workflows and never returned to the browser.
- Free-tier provider credentials are intended for synthetic demonstration cases only.
- Sensitive cases are blocked before external provider initialization unless both server configuration and explicit per-request consent allow it.
- Fallback has a second privacy check. A sensitive request cannot be silently transferred to a second provider.
- Audio bytes are held in memory for transcription and not stored.
- Logging contains provider/model/usage metadata, not prompt or document content.

## RAG and legal verification

- Source records preserve publisher, canonical URL, publication/effective dates, amendment/version data and verification state.
- The ingestion CLI accepts HTTPS sources from government/court domain suffixes. This is only a technical filter, not a legal-authority test.
- Human verification is required before `verification_status=verified`.
- Chunks preserve chapter/section headings and paragraph boundaries.
- Query embedding and full-text keyword search are fused using reciprocal rank fusion.
- Search returns exact indexed excerpts, source URLs and current/historical verification labels.
- No community post or model-generated citation is an authoritative source.
- Legal applicability remains a separate reasoning step; a matching section is not automatically applicable.

## Operational controls and known limits

- The current rate limiter/cache are in-process and reset on restart. Multi-instance deployments need Redis or gateway-level controls.
- Render Free can spin down and has ephemeral local storage; Supabase is the persistence layer.
- Sentence Transformer model loading on a small free web instance may be memory-intensive; test cold starts under the actual Render memory limit.
- The dev storage adapter is not durable and must not be used for production.
- Private case-document upload/listing uses Supabase Storage; original file bytes are not stored on the Render filesystem.
- Legal ingestion is a manual CLI, not an unattended crawler.
