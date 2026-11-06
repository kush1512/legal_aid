# Local and Supabase Setup

## 1. Requirements

- Python 3.11 or newer.
- Git.
- A Supabase project for persistent auth, PostgreSQL, pgvector and private Storage.
- Optional API keys for Gemini, Groq, OpenAI or Anthropic. The mock provider needs no key.

## 2. Install the backend

```bash
git clone https://github.com/kush1512/legal_aid.git
cd legal_aid
python -m venv .venv
# Windows: .venv\\Scripts\\activate
source .venv/bin/activate
pip install -r requirements.txt
# Optional: enable local multilingual E5 semantic retrieval and ingestion
pip install -r requirements-embeddings.txt
cp .env.example .env
```

The default configuration deliberately selects `LLM_PROVIDER=mock`, `MOCK_STORAGE=true` and local development auth bypass. The memory store is disposable and must only be used with synthetic demo data.

## 3. Create and configure Supabase

1. Create a project at https://supabase.com/dashboard.
2. Open **Project Settings → API** (or the current API Keys page) and copy the Project URL and publishable/anon key.
3. Add the URL to `SUPABASE_URL` and the publishable/anon key to `SUPABASE_ANON_KEY`.
4. Keep the service-role/secret key in backend-only `SUPABASE_SERVICE_ROLE_KEY`. Never prefix it with `NEXT_PUBLIC_` or put it in frontend variables.
5. In the SQL Editor, apply all migrations from `supabase/migrations/` in ascending order (0001 through 0009). Migration 0006 makes case classification and AI-generated records server-owned; migration 0007 creates the sanitized community feed with real engagement counts. The backend service-role key is required for server-owned writes.
6. Confirm the `case-files` Storage bucket exists and is private. The backend validates case ownership and object-path prefix before using its service-role key for upload or signed URL creation; browser clients must not write directly to this bucket.
7. In **Authentication → Providers**, enable the sign-in methods the frontend uses. Configure the project's allowed redirect URLs for the frontend domains.
8. Set `MOCK_STORAGE=false` and `DEV_AUTH_BYPASS=false`.

External API calls are disabled by default. For synthetic evaluation only, set `ALLOW_EXTERNAL_LLM_FOR_SYNTHETIC=true` and add a dedicated test account UUID to `SYNTHETIC_DEMO_USER_IDS`. That account must create `synthetic_demo=true` cases and send per-request consent. Ordinary cases remain sensitive and blocked from external providers. Never add normal user accounts to this allowlist. Configure administrators separately using `ADMIN_USER_IDS`, a comma-separated list of trusted administrator Supabase Auth UUIDs.

The API verifies Supabase access tokens using the project's JWKS endpoint. `SUPABASE_JWT_SECRET` is optional and is only for projects still issuing HS256 tokens; do not copy the service-role key into this variable.

## 4. Configure an LLM (optional)

For synthetic examples only, create a Gemini API key in Google AI Studio or a Groq API key in GroqCloud. See [FREE_TIER_SETUP.md](FREE_TIER_SETUP.md). Set the provider, model ID and key in the backend environment.

```dotenv
LLM_PROVIDER=gemini
LLM_MODEL=<currently-supported-gemini-model-id>
GEMINI_API_KEY=<server-side-key>
FALLBACK_LLM_PROVIDER=groq
FALLBACK_LLM_MODEL=<currently-supported-groq-model-id>
GROQ_API_KEY=<server-side-key>
```

Do not enable sensitive-case external processing for a prototype. The default privacy policy blocks it.

## 5. Run the API

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Open `/api/v1/docs`. Health is unauthenticated; all case/legal/community/lawyer/draft routes require a valid Supabase bearer token.

For mock development only:
- Keep `APP_ENV=development`.
- Set `DEV_AUTH_BYPASS=true`.
- Pass a valid UUID in `X-Dev-User-ID`.
- Keep `MOCK_STORAGE=true`.
- Do not deploy development bypass to Render or production.

## 6. Local embeddings

The first use of `EMBEDDING_PROVIDER=local` downloads the model configured in `EMBEDDING_MODEL` to the host's model cache. The E5 adapter automatically prefixes query text with `query: ` and passage text with `passage: `. The configured vector size must match `EMBEDDING_DIMENSIONS=384` and `vector(384)` in SQL.

A model change requires:
1. Stop writes/queries against the old vector set.
2. Migrate the pgvector dimension if it changed.
3. Re-embed every stored legal chunk with the new model and matching passage prefix.
4. Build/rebuild vector indexes.
5. Update `EMBEDDING_MODEL` and `EMBEDDING_DIMENSIONS` together.
6. Validate retrieval quality against a labeled test set before switching traffic.

## 7. Run tests

```bash
pytest -q
```

## 8. Production environment checklist

- Use Supabase Auth (development bypass disabled).
- Use persistent Supabase Storage; do not write uploads or SQLite files to the Render filesystem.
- Restrict `CORS_ORIGINS` to real frontend origins.
- Keep all provider/database secrets in Render environment variables.
- Keep free-tier API processing limited to synthetic cases.
- Set `ALLOW_EXTERNAL_LLM_FOR_SENSITIVE=false`.
- Review data-use, retention, security and age eligibility with every provider.
- Replace the in-process rate limiter/cache with shared infrastructure before multiple API instances.
- Use approved legal-source ingestion and human verification.
