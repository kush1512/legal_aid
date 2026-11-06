# Model and Provider Switching

The frontend contract does not change when the backend LLM changes. Provider SDK calls are isolated in `app/llm.py`.

## Providers

| Provider value | Adapter | Credential |
|---|---|---|
| `mock` | Deterministic development adapter | None |
| `gemini` | Official Google GenAI SDK | `GEMINI_API_KEY` |
| `groq` | Groq Python SDK | `GROQ_API_KEY` |
| `openai` | OpenAI Python SDK | `OPENAI_API_KEY` |
| `anthropic` | Anthropic Python SDK | `ANTHROPIC_API_KEY` |

Only Gemini/Groq are intended as the first free-first external options. OpenAI and Anthropic are optional replaceable adapters and may incur charges. Do not enable a paid provider accidentally.

## Environment variables

- `LLM_PROVIDER`: primary provider.
- `LLM_MODEL`: default model identifier for the selected provider.
- `GEMINI_API_KEY`, `GROQ_API_KEY`: server-only credentials.
- `FALLBACK_LLM_PROVIDER`, `FALLBACK_LLM_MODEL`: optional fallback.
- `CASE_EXTRACTION_MODEL`: overrides the primary model for structured intake extraction.
- `LEGAL_EXPLANATION_MODEL`: reserved task-specific setting for the legal explanation stage.
- `DOCUMENT_DRAFT_MODEL`: overrides the primary model for drafting.
- `LLM_TIMEOUT_SECONDS`: per-attempt timeout.
- `LLM_MAX_OUTPUT_TOKENS`: hard output token cap.
- `LLM_MAX_RETRIES`: bounded retries for transient errors.
- `LLM_FALLBACK_ENABLED`: enable/disable fallback.
- `ALLOW_EXTERNAL_LLM_FOR_SYNTHETIC`: server-side opt-in; default false.
- `SYNTHETIC_DEMO_USER_IDS`: comma-separated UUID allowlist of dedicated test accounts.
- `ALLOW_EXTERNAL_LLM_FOR_SENSITIVE`: separate stricter opt-in; default false. Real cases remain blocked by default.

The configured model string is passed directly to the provider SDK. Do not assume that a model identifier or its JSON-mode support remains available indefinitely. Check the provider's currently supported model catalogue and test a structured response before switching.

## Safe switching procedure

1. Keep the production provider unchanged.
2. Configure a staging environment with synthetic legal cases only.
3. Set `LLM_PROVIDER`, `LLM_MODEL` and the server-side key.
4. Test plain text generation, Pydantic structured output, timeout behavior, 429 behavior and provider outage behavior.
5. Run the evaluation suite for all four categories and unanswerable cases.
6. Compare extraction completeness, schema-validity, unsupported claims, citation precision, latency and token usage.
7. Only then switch the Render environment and restart the service.

## Fallback rules

Fallback only occurs for timeout, rate-limit and transient upstream errors (408/409/429/5xx/connection timeout). Invalid credentials, unsupported models, schema-validation errors and privacy-gate denials are not eligible.

Fallback re-runs the privacy gate for the destination provider. External providers are disabled unless the caller is an allowlisted synthetic-demo account and the request explicitly marks synthetic input and consents. Sensitive data is not silently routed to another service. A fallback model may have different safety, retention, region and training terms; review them independently.

## Structured output

- Gemini uses JSON response schema mode through the official GenAI SDK.
- Groq/OpenAI use JSON mode in their chat completion adapters; confirm model support in the provider's current model catalogue.
- Anthropic uses schema-constrained prompting and Pydantic validation in this adapter.
- A valid JSON response is parsed and validated by Pydantic. Invalid structures fail closed; the backend does not accept malformed model output.

## Embedding models are separate

Changing an LLM does not require re-embedding. Changing `EMBEDDING_MODEL` does. The E5 model dimension is 384 in the initial migration; any dimensional change requires a database migration and complete re-embedding.
