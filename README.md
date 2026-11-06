# Legal Aid — Backend

FastAPI backend for the Legal Aid platform. The application is a modular monolith: one deployable API with separate configuration, authentication, storage, AI providers, embeddings, retrieval and API layers.

## Project status

This repository currently contains:
- A frontend-facing REST contract and Pydantic request/response schemas.
- Supabase migrations for case, community, lawyer, draft and legal knowledge-base tables, pgvector and RLS.
- Supabase JWT authentication and a development-only auth bypass.
- Gemini, Groq, OpenAI, Anthropic and explicit mock LLM adapters behind one provider contract.
- Privacy-gated LLM calls, transient-only fallback, timeouts, bounded retries and usage metadata logging.
- Local `intfloat/multilingual-e5-small` query/passage embeddings when optional ML dependencies are installed; otherwise verified-source keyword retrieval remains available.
- Hybrid semantic + keyword legal retrieval and an official-source PDF/HTML ingestion CLI.
- Case intake, assessment snapshot, preliminary draft, community, lawyer, legal search and speech transcription routes.\n- Deterministic urgent escalation signposting for India (112 immediate safety, 1930 online financial fraud).
- A development-only in-memory storage mode for synthetic tests.

This is a prototype foundation, **not a production legal service**. Free-tier integrations must only process synthetic demonstration data until the provider's current data terms, retention, jurisdiction, user eligibility and authorization have been reviewed. Legal source ingestion still requires a human to verify authority, amendment status and effective dates before setting a source to `verified`.

## Quick start

```bash
python -m venv .venv
# Windows: .venv\\Scripts\\activate
source .venv/bin/activate
pip install -r requirements.txt
# Optional: install local E5/PyTorch for multilingual semantic retrieval and ingestion
pip install -r requirements-embeddings.txt
cp .env.example .env
uvicorn app.main:app --reload
```

With the example configuration, the API uses a mock LLM and development-only in-memory storage. Send `X-Dev-User-ID: 00000000-0000-4000-8000-000000000001` for local synthetic requests.

- Health: `GET http://localhost:8000/api/v1/health`
- OpenAPI UI: `http://localhost:8000/api/v1/docs`
- Contract: [API_CONTRACT.md](API_CONTRACT.md)
- Setup: [SETUP.md](SETUP.md)
- Free-first setup/privacy notes: [FREE_TIER_SETUP.md](FREE_TIER_SETUP.md)

## Supabase

Apply SQL migrations in numeric order from `supabase/migrations/`:
1. `0001_initial_schema.sql`
2. `0002_legal_search_functions.sql`
3. `0003_security_and_private_storage.sql`
4. `0004_citation_ownership.sql`
5. `0005_synthetic_demo_privacy.sql`
6. `0006_server_owned_records.sql`
7. `0007_community_feed_projection.sql`

Set `SUPABASE_URL`, `SUPABASE_ANON_KEY` and (server-only) `SUPABASE_SERVICE_ROLE_KEY`. Set `MOCK_STORAGE=false` and `DEV_AUTH_BYPASS=false`. Frontend code must never receive the service-role key.

## AI provider selection

Default development mode is `LLM_PROVIDER=mock`. For synthetic test cases, configure the current model identifier and key for Gemini or Groq. See [MODEL_SWITCHING.md](MODEL_SWITCHING.md).

Do not assume a free API plan is privacy-safe. In particular, Google's current Gemini API terms say unpaid-service prompts and responses may be used to improve Google products and may be reviewed by humans. Do not send actual legal case information through the free Gemini tier.

## Legal knowledge base

Use the reviewed-source ingestion command described in [DATA_SOURCES.md](DATA_SOURCES.md). The ingestion script only accepts HTTPS URLs on configured official government/court domain suffixes, but domain matching alone is not legal verification. The operator must review the source and pass `--verified` only after confirming the exact text and legal status.

## Deployment

- Render blueprint: `render.yaml`
- Docker: `Dockerfile`
- No persistent local files are required. Supabase stores relational data and private uploads.
- Render Free web services sleep when idle and have an ephemeral filesystem. Use free deployment only for demos; it is not an availability or confidentiality guarantee.
- Vercel Hobby frontend deployments are subject to the plan's current personal/non-commercial terms.

## Important limitations

- In-memory development storage is process-local and is lost on restart.
- The in-process rate limiter/cache are single-instance controls, not distributed controls.
- The current intake-stage assessment intentionally makes no legal conclusion and includes no unverified citations.
- The API has no lawyer onboarding/verification admin interface, community moderation UI, or upload UI. The DB/RLS foundation and read/create endpoints are present; operational workflows must be built before public launch.
- Speech transcription requires Groq credentials and is externally processed only after the privacy gate permits it.
- Tests and deployment checks must be run in an environment with dependencies installed; no deployment has been performed by this repository commit.
