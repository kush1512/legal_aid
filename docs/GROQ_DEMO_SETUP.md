# Groq setup and diagnostics (local development)

The backend includes a Groq chat-completions adapter in `app/llm.py`; the `groq` SDK is already in `requirements.txt`.

## Why the app may not be using Groq

- The default `LLM_PROVIDER=mock` selects the placeholder provider. A Groq key by itself does not switch providers.
- The frontend must use `NEXT_PUBLIC_API_MODE=real` and point `NEXT_PUBLIC_API_BASE_URL` at the FastAPI server.
- FastAPI reads its backend `.env` at process startup. Restart it after changing provider settings.
- External LLM processing is blocked for sensitive cases, private conversations, missing per-request consent, or when `ALLOW_EXTERNAL_LLM_FOR_NON_SENSITIVE=false`.
- Family and personal-safety categories and detected personal identifiers are automatically treated as sensitive. They cannot be sent to Groq.
- A transient provider failure can use the configured fallback provider. The response metadata and backend logs identify the provider that actually answered.

## Enable Groq for synthetic, non-sensitive development tests

Use invented facts only. Do not enter real names, phone numbers, addresses, Aadhaar/PAN details, account numbers, documents or actual disputes.

Set these values in the backend `.env`:

```env
APP_ENV=development
DEV_AUTH_BYPASS=true
MOCK_STORAGE=true

LLM_PROVIDER=groq
LLM_MODEL=openai/gpt-oss-20b
GROQ_API_KEY=your_groq_api_key

ALLOW_EXTERNAL_LLM_FOR_NON_SENSITIVE=true
ALLOW_EXTERNAL_LLM_FOR_SENSITIVE=false
LLM_FALLBACK_ENABLED=false
```

Keep the Groq key only in the backend environment. Never use a `NEXT_PUBLIC_*` variable for it. Restart FastAPI after changing the environment. Set the frontend to real API mode and confirm that its API base URL points to the same backend.

The current Groq model catalogue lists `openai/gpt-oss-20b`; Groq documents JSON Object Mode for JSON responses and Structured Outputs for supported models. This adapter currently uses JSON Object Mode and validates the result against the Pydantic schema in the backend.

## End-to-end smoke test

1. Open `GET /api/v1/health`. Confirm the reported provider is `groq`, the selected model is `openai/gpt-oss-20b`, and the key is configured. The endpoint never returns the key.
2. Use the development account configured by `DEV_AUTH_BYPASS`.
3. Create a fictional property/consumer case with the sensitive switch off. Do not use family or personal-safety categories for this provider test; those categories are deliberately protected.
4. Grant external-AI consent in the UI.
5. Send a follow-up message. Inspect the assistant message's `ai_metadata`: a live response should report `provider: groq` and `is_mock: false`.
6. Generate an assessment with explicit consent. Inspect its model metadata and confirm that legal citations only come from the verified-source retrieval pipeline.

A case being fictional does not override the sensitivity gate. The backend still enforces category, personal-identifier, private-conversation and per-request consent checks.

## Diagnosing failures

- `provider: mock`: check `LLM_PROVIDER`, frontend real mode, API base URL and whether the running process was restarted.
- `GROQ_API_KEY is not configured`: set the key in the backend `.env`; do not put it in frontend configuration.
- HTTP 403 / `PRIVACY_GATE_BLOCKED`: the case is sensitive/private, consent is missing, or the provider is globally disabled for non-sensitive cases.
- HTTP 502 / `PROVIDER_UNAVAILABLE`: inspect backend logs for the provider/model failure category and request ID. Check the key, model ID, account limits and network access.
- `ai_metadata.provider` differs from Groq: a fallback provider handled the request. Disable fallback during diagnosis to expose the primary failure.

The health endpoint reports configuration only; it does not spend tokens or send case data to Groq. A successful authenticated live request is the proof of connectivity.

## Privacy and storage

`MOCK_STORAGE=true` keeps cases/messages in process memory; they disappear when the backend restarts. Use only synthetic test data. Free-tier provider terms can permit retention or model improvement; review the current provider terms before processing any real legal matter. Sensitive cases remain blocked regardless of consent.

## Provider references

- [Groq models](https://console.groq.com/docs/models)
- [Groq chat completions API](https://console.groq.com/docs/api-reference)
- [Groq structured outputs and JSON modes](https://console.groq.com/docs/structured-outputs)
