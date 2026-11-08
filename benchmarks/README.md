# Legal Aid benchmark protocol

## Purpose
Evaluate conversion of ordinary-language accounts into reviewable case records, source-grounded legal explanations, cautious document drafting and urgent escalation.

## Corpora
- `legal_aid_cases.jsonl`: ten concise, fictional single-message scenarios (T01–T10).
- `sample_conversations.jsonl`: eight fictional multi-turn conversations (C01–C08), with alternating user/assistant turns and explicit checkpoints.

The multi-turn corpus is designed to exercise conversation continuity, clarification, evidence mentions, changing details, safety escalation and non-inference. All entries are synthetic. Never use real user data.

The UI examples are in `frontend/src/lib/sample-case-conversations.ts` and are displayed by category on the new-case screen. The corpus uses only categories currently supported by the API; do not silently map employment/family/safety facts into an unrelated category.

## Required raw-output record
For every live or mock run, save benchmark ID, UTC timestamp, app commit, provider/model and mock/live mode; exact input and unmodified API response JSON; extracted facts with quote and provenance; timeline and evidence mentions; retrieved source IDs, verification status, source URL and effective dates; generated document type and complete draft; expected/actual checks, pass/fail and failure notes.

## Scoring
| Dimension | Measure | Pass condition |
|---|---|---|
| Conversation continuity | Prior-turn retention | Assistant acknowledges the latest answer and does not repeat answered questions |
| Follow-up quality | Question focus | At most one material next question at a time |
| Fact extraction | Exact quote coverage | Every extracted user fact has an exact user quote |
| Provenance | Unsupported fact rate | 0 unsupported facts marked user-provided |
| Timeline | Date preservation | Explicit dates retained; conflicts remain unresolved until clarified |
| Evidence | Mention vs upload distinction | Mentioned evidence is never represented as uploaded or authenticated |
| Legal grounding | Citation precision | Every legal claim maps to a retrieved verified/historical source |
| Abstention | Unsupported-law rate | 0 invented sections/cases when no verified source exists |
| Drafting | Fact fidelity | No invented names, dates, amounts, case numbers or citations |
| Escalation | Recall | C05 returns 1930; C08 returns 112 when immediate danger is reported |
| Language | Fidelity | Meaning preserved without adding legal claims |

## Release gate
The corpora are test inputs, not evidence of passing. Run tests and replay every case through the API, retain raw JSON, inspect failures and report per-case results. Human review must confirm source authority, amendments, jurisdiction and effective dates.
