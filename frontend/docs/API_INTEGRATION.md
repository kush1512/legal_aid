# API integration

Source of truth: `API_CONTRACT.md` v1.0.0 in the backend repo (`kush1512/legal_aid`).
Types in `src/lib/api/types.ts` mirror it field for field; no fields are invented.

## Architecture
```
UI (app/, components/)  ->  api  (src/lib/api/index.ts)  ->  LegalAidApi interface (client.ts)
                                                              |-- realApi (real.ts)  fetch -> FastAPI
                                                              `-- mockApi (mock/api.ts) browser-only
```
* One switch: `NEXT_PUBLIC_API_MODE`. UI code never imports `real.ts` or `mock.ts`.
* Every call is centralised in `real.ts`. The browser never calls an LLM provider and holds no provider keys.
* Auth: `Authorization: Bearer <Supabase access token>` (from `/login`), else `X-Dev-User-ID` when `NEXT_PUBLIC_DEV_USER_ID` is set (dev only).
* Errors: `ApiError{status, code, message, details, requestId}`. Handles both `{error:{code}}` and FastAPI `{detail}` shapes. `describeError()` maps statuses to plain-language copy (401/403/404/413/415/422/429/502/503/504).

## Endpoints used
| Method | Path | Used by |
|---|---|---|
| GET | /health | Profile > Connection |
| POST | /cases | Case intake |
| GET | /cases | Home, My cases |
| GET | /cases/{id} | Case page |
| POST | /cases/{id}/messages | Case conversation |
| GET | /cases/{id}/assessment | Assessment tab (404 `ASSESSMENT_NOT_FOUND` shows an empty state) |
| GET | /cases/{id}/documents | Documents tab |
| POST | /legal/search | Search the law |
| GET | /legal/provision/{id} | Provision page |
| POST | /documents/generate | Document studio |
| GET/POST | /community/posts | Community |
| GET | /lawyers, /lawyers/{id} | Directory, profile |
| POST | /speech/transcribe | Voice input (additive endpoint from the contract) |

## Deviations from the original brief
The brief's example request/response shapes (`input_mode` on case creation, `{case_id,status,assistant_message,...}` chat response) differ from the contract. The contract wins, per the brief's own rule: case creation returns `{case, initial_message}`, and `POST /messages` returns `{user_message, assistant_message, case_status, follow_up_questions, extracted_facts, ai}`. `input_mode` is sent on messages.

## Backend gaps (UI behaviour)
| Gap | What the UI does |
|---|---|
| Conversation history endpoint exists, but frontend does not call it yet | Transcript is kept in `sessionStorage` for the tab. Wire `GET /cases/{id}/messages` to restore persisted history across sessions. |
| Case creation does not run AI | After intake the case page sends one visible message ("Please review my description...") to get follow-up questions. |
| Document upload endpoint exists, but frontend does not call it yet | Real-mode upload is disabled. Wire `POST /cases/{id}/documents` and refresh `GET /cases/{id}/documents`; mock mode currently keeps file names only. |
| Community comment/vote/report endpoints exist, but frontend does not call them yet | Comments, votes, reports, blocks and private messages are currently stored in `localStorage` and remain device-local. Wire comments and votes if cross-session public discussion is required; keep blocks and private messages local unless their own privacy and moderation requirements are implemented. |
| Lawyer sample personas are mock-only | Synthetic lawyer personas and their extra fields are available only in mock mode. Real mode lists backend-approved profiles; the API does not provide experience, fees, availability, portfolio or recommendations. |
| No similar-judgments data | Section states it is unavailable. |
| Community list supports only `newest`/`popular` in the backend | "Helpful" is a mock-only view based on demo lawyer replies. |
| Unhandled 500s may not carry CORS headers | Browser may report these as network errors; UI shows "Can't reach the server". |

## Backend CORS
Set `CORS_ORIGINS` on the backend to include your Vercel URL and `http://localhost:3000`.
