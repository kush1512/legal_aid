# Legal Aid benchmark protocol

## Purpose
Evaluate conversion of ordinary-language accounts into reviewable case records, source-grounded legal explanations, cautious document drafting and urgent escalation.

## Corpus
`legal_aid_cases.jsonl` contains ten fictional scenarios (T01–T10). Never use real user data.

## Required raw-output record
For every run, save benchmark ID, UTC timestamp, app commit, provider/model and mock/live mode; exact input and unmodified API response JSON; extracted facts with quote and provenance; timeline and evidence mentions; retrieved source IDs, verification status, source URL and effective dates; generated document type and complete draft; expected/actual checks, pass/fail and failure notes.

## Scoring
| Dimension | Measure | Pass condition |
|---|---|---|
| Fact extraction | Exact quote coverage | Every extracted user fact has an exact user quote |
| Provenance | Unsupported fact rate | 0 unsupported facts marked user-provided |
| Timeline | Date preservation | Explicit dates retained; conflicts remain unresolved until clarified |
| Evidence | Mention vs upload distinction | Mentioned evidence is never represented as uploaded or authenticated |
| Legal grounding | Citation precision | Every legal claim maps to a retrieved verified/historical source |
| Abstention | Unsupported-law rate | 0 invented sections/cases when no verified source exists |
| Drafting | Fact fidelity | No invented names, dates, amounts, case numbers or citations |
| Escalation | Recall | T05 returns 1930; T07 returns 112 |
| Language | Fidelity | Meaning preserved without adding legal claims |

## Release gate
The corpus is not evidence of passing. Run tests and replay every case through the API, retain raw JSON, inspect failures and report per-case results. Human review must confirm source authority, amendments, jurisdiction and effective dates.
