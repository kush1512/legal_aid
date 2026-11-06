# Free-Tier Setup and Privacy Limitations

**Checked:** 6 November 2026. Provider prices, quotas, eligible models, terms and retention rules change; re-check the official links before each deployment.

This no-subscription configuration is for a synthetic-data prototype. It does **not** make free APIs suitable for real legal case information.

## 1. Recommended prototype configuration

| Component | Prototype choice | Important limitation |
|---|---|---|
| API | Render Free Web Service | Sleeps when idle; ephemeral filesystem |
| Auth/database | Supabase Free | Quotas; projects may pause after inactivity |
| Private files | Supabase Storage | 1 GB current Free allowance |
| Vector database | Supabase PostgreSQL + pgvector | Shares database quota |
| LLM default | Mock provider | No external API or key needed |
| LLM evaluation | Gemini or Groq | Synthetic examples only |
| Embeddings | Local multilingual-e5-small | Model downloads and memory use |
| Speech | Groq Whisper | External processing; no audio persistence by this app |
| Frontend | Vercel Hobby | Personal/non-commercial eligibility restriction |

## 2. Supabase Free setup

1. Create a project at https://supabase.com/dashboard.
2. Copy the project URL and publishable/anon key from Project Settings → API/API Keys.
3. Create a backend-only service-role/secret key. Never expose it to frontend code.
4. Apply migrations 0001, 0002 and 0003 from supabase/migrations in ascending order.
5. Confirm the case-files Storage bucket is private.
6. Enable the Auth providers required by the frontend and configure allowed redirect URLs.
7. Set MOCK_STORAGE=false and DEV_AUTH_BYPASS=false when using real Supabase.

Current published Free allowances include 500 MB database size, 1 GB file storage, 5 GB egress and 50,000 monthly active users. Supabase may pause Free projects after about seven days of low activity. Check the current [pricing](https://supabase.com/pricing) and [project pausing guide](https://supabase.com/docs/guides/platform/free-project-pausing); quotas and conditions can change.

~~~dotenv
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<publishable-or-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<backend-only-secret>
MOCK_STORAGE=false
DEV_AUTH_BYPASS=false
~~~

The browser may use the publishable/anon key with RLS. Never place the service-role key in a browser bundle, a NEXT_PUBLIC variable or a public repository.

## 3. Gemini API through Google AI Studio

1. Sign in at https://aistudio.google.com/.
2. Open the API keys page and choose Create API key.
3. Select or create a Google Cloud project as prompted.
4. Store the key only in the backend secret GEMINI_API_KEY.
5. Select a currently supported model that supports JSON response schemas.
6. Check live quotas in AI Studio before testing.

Official links: [Getting started and API keys](https://aistudio.google.com/docs/get-started), [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits), [pricing](https://ai.google.dev/gemini-api/docs/pricing), [Additional Terms](https://ai.google.dev/gemini-api/terms).

**Critical data-use restriction:** Google's Gemini API Additional Terms effective 23 March 2026 classify unpaid API quota as an Unpaid Service. Google says submitted content and generated responses may be used to provide, improve and develop Google products and machine-learning technologies. Human reviewers may read, annotate and process inputs/outputs. The terms explicitly say not to submit sensitive, confidential or personal information to Unpaid Services. Paid Services are treated differently under the terms, but require separate review and payment setup.

**Age eligibility:** The current Additional Terms say API users must be at least 18 and API Clients must not be directed to, or likely to be accessed by, people under 18. A legal-aid product may be used by minors. Do not deploy a Gemini-powered public client likely to be accessed by minors until legal/product counsel has reviewed this restriction and confirmed an eligible architecture. Free Gemini keys are for synthetic demonstrations only.

~~~dotenv
LLM_PROVIDER=gemini
LLM_MODEL=<current-supported-gemini-model>
GEMINI_API_KEY=<backend-secret>
~~~

External LLM/speech calls remain disabled unless all synthetic-demo conditions are met: `ALLOW_EXTERNAL_LLM_FOR_SYNTHETIC=true`, a dedicated account UUID is listed in `SYNTHETIC_DEMO_USER_IDS`, the input is marked synthetic, and the request includes consent. Configure `ADMIN_USER_IDS` separately for moderation administrators. Do not add ordinary user accounts to this list. Real cases stay sensitive and are never sent to free-tier providers.

## 4. Groq API and Whisper

1. Sign up at https://console.groq.com/.
2. Create a project API key from https://console.groq.com/keys.
3. Store it as the backend-only GROQ_API_KEY.
4. Select a current chat model from the [Groq model catalogue](https://console.groq.com/docs/models).
5. Check the exact organization/model limits in [Groq rate limits](https://console.groq.com/docs/rate-limits).

~~~dotenv
LLM_PROVIDER=groq
LLM_MODEL=<current-supported-groq-model>
GROQ_API_KEY=<backend-secret>
GROQ_WHISPER_MODEL=whisper-large-v3-turbo
~~~

Groq limits can include requests/minute, requests/day, tokens/minute, tokens/day and audio-seconds/hour/day. Exact values depend on account tier and model; the dashboard is authoritative. A 429 means a configured limit was reached. The backend performs bounded exponential retries and then returns a controlled error.

Read the current [Groq service policies](https://console.groq.com/docs/legal), terms and privacy documentation before sending anything other than synthetic data. This repository does not assert that Groq's free tier is suitable for confidential legal material. Treat it as an external processor until data-use, retention/deletion, training, region, security and contractual terms have been reviewed and authorization obtained.

Whisper is called through a separate SpeechProvider. Audio is validated, sent in memory and not saved to local disk or Supabase Storage by this application. Transcription text can still include personal information and receives the same privacy classification as typed text.

## 5. Local multilingual embeddings and pgvector

Default:
- Model: intfloat/multilingual-e5-small
- Dimensions: 384
- Query prefix: query: 
- Passage prefix: passage:

No embedding API key is required. The first run downloads model weights. Ensure sufficient disk/RAM. Render Free instances use ephemeral storage, so a cold start may download the model again. Loading PyTorch plus the model may exceed a small free instance's memory; test query-time embedding on the actual deployed instance before relying on it. Run ingestion on a suitably resourced local machine if needed.

Supabase's [pgvector guide](https://supabase.com/docs/guides/database/extensions/pgvector) documents the Postgres vector extension. The initial migration creates vector(384). Changing model or dimensions requires re-embedding every legal chunk and rebuilding the corresponding vector index.

## 6. Render Free Web Service

1. Create an account at https://render.com/.
2. Connect this repository.
3. Use render.yaml or create a Python Web Service manually.
4. Add environment variables through the Render dashboard.
5. Set APP_ENV=production, MOCK_STORAGE=false, DEV_AUTH_BYPASS=false, narrow CORS_ORIGINS and keep ALLOW_EXTERNAL_LLM_FOR_SENSITIVE=false.
6. Set health path to /api/v1/health.

Current [Render Free documentation](https://render.com/docs/free) lists important limits: free web services spin down after 15 minutes without inbound traffic; waking can take about a minute; the filesystem is ephemeral and changes are lost on restart/redeploy/spin-down; persistent disks and multi-instance scaling are unavailable on the free compute plan. Render describes Free instances as testing/hobby environments, not production applications.

Do not store uploads, local databases, legal PDFs, model checkpoints or user-generated files on Render's filesystem. Supabase is the persistence layer. Model loading and cold starts may make a free instance unsuitable for reliable query-time embedding.

## 7. Vercel frontend

Connect the frontend repository to Vercel and set:

~~~dotenv
NEXT_PUBLIC_API_BASE_URL=https://<render-service>.onrender.com
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable-or-anon-key>
~~~

Do not add a service-role key or LLM key to frontend variables. Vercel's [Hobby plan](https://vercel.com/docs/plans/hobby) is intended for personal, non-commercial use. Confirm current terms and eligibility before using it for a public legal-aid service, even where the app is free to end users.

## 8. Rate limits, outages and cost controls

- Keep LLM_MAX_RETRIES bounded (default 2 retries after the first attempt).
- LLM_TIMEOUT_SECONDS caps each provider call.
- LLM_MAX_OUTPUT_TOKENS caps output.
- The app retries transient timeout/429/5xx failures with exponential backoff; it does not retry authentication, invalid-model, privacy or schema-validation errors.
- Fallback is only for transient errors and re-runs the privacy gate. Do not select a fallback provider with more permissive data terms.
- Use LLM_PROVIDER=mock to develop without external quota.
- The legal retrieval cache is process-local, hashed-keyed and TTL-limited. It does not cache case prompts/messages.
- Rate limiting is process-local and per IP. It is not a distributed control; use a shared gateway/Redis limiter before multiple API instances.
- Check current AI Studio project quota and Groq organization limits. Do not hardcode quota assumptions in application code.
- A 429 should show a retry-later state in the UI. Never automatically switch provider for confidential content.

## 9. Privacy limitations and operating rules

1. Free-tier provider APIs receive synthetic demonstration cases only.
2. Do not send real case messages, names, addresses, phone numbers, identity documents, allegations, evidence, audio or legal documents to free-tier LLM/speech services.
3. Review data-use, human review, retention/deletion, training, residency, security, subprocessors and incident-notification terms before changing this restriction.
4. Obtain clear user authorization and appropriate organizational/legal approval before external processing. Consent does not override provider terms.
5. Keep ALLOW_EXTERNAL_LLM_FOR_SENSITIVE=false by default.
6. Do not describe the prototype as privileged, anonymous, legally compliant or suitable for emergencies without independent verification.
7. Do not guarantee legal outcomes. Cite verified current sources and require professional review.
8. Restrict this prototype to adults unless provider age requirements and child-safety obligations have been resolved.

## 10. Replacing free services later

- LLM: implement another LLMProvider adapter and select it through LLM_PROVIDER. API routes/frontend payloads remain unchanged.
- Speech: implement SpeechProvider and select it through configuration.
- Embeddings: implement EmbeddingProvider; re-embed all legal chunks if the model changes.
- Database/storage: preserve repository methods and API contract while replacing Storage.
- Hosting: run the same ASGI app on a persistent managed container platform.
- Evaluate privacy, age eligibility, data residency, retention and structured output before switching.

## Official references

- [Gemini API keys](https://aistudio.google.com/docs/get-started)
- [Gemini terms/data use](https://ai.google.dev/gemini-api/terms)
- [Gemini quotas](https://ai.google.dev/gemini-api/docs/rate-limits)
- [Groq quickstart](https://console.groq.com/docs/quickstart)
- [Groq rate limits](https://console.groq.com/docs/rate-limits)
- [Groq policies](https://console.groq.com/docs/legal)
- [Supabase pricing](https://supabase.com/pricing)
- [Supabase inactivity pausing](https://supabase.com/docs/guides/platform/free-project-pausing)
- [Supabase pgvector](https://supabase.com/docs/guides/database/extensions/pgvector)
- [Render Free](https://render.com/docs/free)
- [Vercel Hobby](https://vercel.com/docs/plans/hobby)
