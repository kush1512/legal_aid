# Groq-backed hybrid intake (development demo)

The backend already contains a Groq adapter in `app/llm.py`. No additional provider package is required; `groq` is already in `requirements.txt`. The example model below is listed by Groq as supporting structured outputs.

## Local environment

Keep the backend storage in memory:

```env
APP_ENV=development
DEV_AUTH_BYPASS=true
MOCK_STORAGE=true

LLM_PROVIDER=groq
GROQ_API_KEY=your_groq_api_key
LLM_MODEL=openai/gpt-oss-20b

ALLOW_EXTERNAL_LLM_FOR_SYNTHETIC=true
SYNTHETIC_DEMO_USER_IDS=00000000-0000-4000-8000-000000000001
ALLOW_EXTERNAL_LLM_FOR_SENSITIVE=false
```

Keep `NEXT_PUBLIC_API_MODE=real` in the frontend. The frontend must call the FastAPI backend; the Groq key must never be placed in a `NEXT_PUBLIC_*` variable.

Restart FastAPI after changing the environment.

## How to test

1. Use made-up facts only. Do not enter real names, addresses, phone numbers, account details, documents or actual disputes.
2. On the new-case form, select **This is a fictional demonstration case**.
3. Explicitly enable external-AI consent.
4. Create the case and send a follow-up message.
5. The backend sends the conversation to Groq only when the current development user ID is in `SYNTHETIC_DEMO_USER_IDS` and `ALLOW_EXTERNAL_LLM_FOR_SYNTHETIC=true`.
6. Select **Generate detailed assessment** to invoke the existing assessment endpoint.

Real cases remain blocked from external AI by default. Do not enable `ALLOW_EXTERNAL_LLM_FOR_SENSITIVE` for this demo. A Groq API key is a secret and belongs only in the backend environment.

## Storage and limitations

`MOCK_STORAGE=true` keeps cases, messages, facts and assessments in process memory. They are lost when the backend restarts and are not shared between backend instances. This is for local workflow testing only, not real legal matters or production.

The assessment can only cite provisions returned by the existing verified legal-source retrieval pipeline. If no verified matching source is available, the backend must not invent statute names or sections. Generated output is preliminary information, not legal advice or representation.

## Provider documentation

- [Groq API quickstart](https://console.groq.com/docs/quickstart)
- [Groq chat completions API](https://console.groq.com/docs/api-reference)
- [Groq structured outputs](https://console.groq.com/docs/structured-outputs)
