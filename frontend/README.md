# Legal Aid frontend

Lives in `/frontend` of the `legal_aid` repo; the FastAPI backend is at the repo root.

First Aid for Legal Advice: Next.js (App Router), React, TypeScript, Tailwind CSS, Lucide icons.
Talks to the separate FastAPI backend (`kush1512/legal_aid`) or runs fully offline in **mock mode**.

## Quick start (mock mode, no backend needed)
```bash
npm install
cp .env.example .env.local   # NEXT_PUBLIC_API_MODE=mock by default
npm run dev                  # http://localhost:3000
```
Mock mode uses synthetic data, clearly labelled "Demo", and never presents sample output as verified legal advice.

## Connect to the real backend
1. Start the backend (see its SETUP.md). For local use keep `APP_ENV=development`, `DEV_AUTH_BYPASS=true`, and add `http://localhost:3000` to `CORS_ORIGINS`.
2. In `.env.local`:
```
NEXT_PUBLIC_API_MODE=real
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_DEV_USER_ID=00000000-0000-4000-8000-000000000001   # dev only
```
3. For production auth set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and leave `NEXT_PUBLIC_DEV_USER_ID` empty.
4. Profile > Connection > "Check connection" calls `/health`.

## Scripts
`npm run dev` · `npm run build` · `npm start` · `npm run typecheck`

## Deploy to Vercel
1. Import the repo and set **Root Directory = `frontend`** (this app lives in a subfolder of the backend repo).
2. Add the env vars from `.env.example` (public values only).
3. Add the Vercel URL to the backend's `CORS_ORIGINS`.
4. Deploy. Use `NEXT_PUBLIC_API_MODE=mock` for a demo before the backend is live.

## Structure
```
src/app/            routes: / , case/new, cases, cases/[id], legal, legal/[id], studio, community, lawyers, lawyers/[id], profile, login
src/components/     AppShell, ui primitives, domain components, AssessmentView, MessageDialog
src/lib/api/        types (contract), client interface, real, errors
src/lib/mock/       mock API + synthetic data
src/lib/local/      device-only state (prefs, community, transcripts)
docs/               API_INTEGRATION.md, screenshots/
```

## Privacy model
* Account identity is private; public name defaults to "Anonymous" and is never derived from the account.
* Sensitive cases (default on) are not sent to an external AI unless the person ticks consent on that case or message.
* A public-post notice, PII warning and confirmation precede every community post.
* No secrets in the browser: only `NEXT_PUBLIC_*` values; no LLM calls from the client.

See `docs/API_INTEGRATION.md` for contract notes, deviations and backend gaps.
