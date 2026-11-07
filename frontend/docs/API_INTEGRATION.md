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
| No endpoint to list a case's messages | Transcript kept in `sessionStorage` for the tab; the UI says so |
| Case creation does not run AI | After intake the case page sends one visible message ("Please review my description...") to get follow-up questions |
| No document upload endpoint | Upload disabled in real mode with an explanation; mock mode keeps file names only |
| No comments, votes, reports, blocks, DMs | Stored in `localStorage`, labelled "this device only" |
| Lawyer experience, fees, availability, portfolio, recommendations | Shown as "Not provided yet" in real mode; demo data in mock mode only |
| No similar-judgments data | Section states it is unavailable |
| Community list supports only `newest`/`popular` | "Helpful" = posts with a lawyer reply, demo data only |
| Unhandled 500s carry no CORS headers | Browser reports them as network errors; UI shows "Can't reach the server" |

## Backend CORS
Set `CORS_ORIGINS` on the backend to include your Vercel URL and `http://localhost:3000`.
