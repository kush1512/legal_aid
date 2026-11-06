# Indian Legal Knowledge Base — Data Sources and Verification

## Source policy
Only primary or official legal/government sources may be used as authoritative legal knowledge-base inputs. Search results from community posts, social media, private blogs, law-firm explainers and model-generated summaries must not be stored as legal authority.

The ingestion script accepts HTTPS sources on government/court domains ending in `.gov.in`, `.nic.in` or `.gov`, plus explicitly listed official domains. Every redirect is checked independently. This allowlist is a technical guardrail, not proof that a page is current, authoritative or legally effective.

## Suggested official starting points
| Source | Use |
|---|---|
| [India Code](https://www.indiacode.nic.in/) | Central Acts and statutory text |
| [Legislative Department](https://legislative.gov.in/) | Legislation and constitutional/statutory materials |
| [eGazette of India](https://egazette.gov.in/) | Gazette notifications and amendment publication evidence |
| [Supreme Court of India](https://www.sci.gov.in/) | Supreme Court judgments and official case materials |
| [eCourts](https://ecourts.gov.in/) | Court and case-service information; distinguish procedural information from statutes |
| State government law departments and official state gazettes | State Acts, rules, notifications and amendments |
| Official ministry/regulator portals | Subject-specific rules, schemes and official notifications |

Check that a particular document is actually published by the official institution and has the correct jurisdiction before ingestion.

## Verification workflow
1. Retrieve the original official PDF/HTML over HTTPS.
2. Confirm issuing authority and canonical source URL.
3. Confirm Act/rule/notification title, enactment/publication date, commencement/effective date and amendments.
4. Compare extracted text against the official source, including section numbering and schedules.
5. Record amendment/version information and any repeal, substitution or commencement notification.
6. New ingestion always creates an `unverified` document. Verification is a separate, attributable human review operation; the ingestion CLI cannot mark a document verified.
7. For amended provisions, ingest each material version with effective dates. Do not overwrite history.
8. Re-run retrieval and citation-accuracy tests after every update.

## Ingestion CLI
Validate a source without embeddings or database writes:

```bash
python -m scripts.ingest_legal \
  --url "https://www.indiacode.nic.in/..." \
  --title "Exact displayed title" \
  --source-name "India Code" \
  --document-type act \
  --act-name "Exact Act name" \
  --jurisdiction IN \
  --language en \
  --effective-from YYYY-MM-DD \
  --dry-run
```

After inspecting the dry-run output, remove `--dry-run` to ingest. The command needs `SUPABASE_URL`, backend-only `SUPABASE_SERVICE_ROLE_KEY`, and the local embedding model for a real ingestion. Dry-run downloads, validates, extracts and chunks but does not require Supabase or load the embedding model.

The ingestion process follows redirects manually and rejects any hop outside the official HTTPS allowlist; enforces a 50 MB response limit while streaming; accepts PDF/HTML and rejects unsupported content; checks PDF signatures and insufficient extracted text (OCR is not implicit); creates bounded chunks and validates embedding dimensions and finite values; detects identical source URL + SHA-256 before embedding; and persists the document plus all chunks through one PostgreSQL function call. Any chunk failure rolls back the document insert. New documents are always `unverified`.

Concurrent identical ingestion attempts are protected by a unique source/checksum index. Re-ingesting changed content from the same source creates a new record; review effective dates and version metadata carefully. Different URLs containing the same bytes are not automatically deduplicated.

## Metadata and temporal validity
Store Act/document title and type; Act name, chapter, section, subsection and paragraph labels; jurisdiction and category; official source name and URL; publication date, effective-from/effective-to and version/amendment notes; verification status, reviewer and verification date; original content checksum and source language.

A provision marked `historical` must be visibly labelled historical. It must not be described as currently in force without verifying effective dates and subsequent amendments. A matching section does not establish its application to a particular person's facts.

## Official escalation resources (not legal authorities)
- India Emergency Response Support System: [112.gov.in](https://112.gov.in/). The official portal describes 112 as the pan-India emergency number for police, fire and medical assistance and documents SOS/112 India app options.
- National Cyber Crime Reporting Portal: [cybercrime.gov.in](https://cybercrime.gov.in/). The portal directs victims of online financial fraud to call 1930 and report through the portal.

These details support urgent signposting only. They do not constitute case-specific advice or guarantee police/bank action.

## Retrieval date semantics
Legal search accepts an optional `as_of_date` (ISO date). When omitted, the API uses the current date. Retrieval filters on `effective_from` and `effective_to`; historical records must have a recorded end date and are only returned for an as-of date within their validity period. A document with missing effective dates may still be retrieved if verified, but the response must show missing date metadata and uncertainty rather than imply current force.
