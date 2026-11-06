# Indian Legal Knowledge Base — Data Sources and Verification

## Source policy

Only primary or official legal/government sources may be used as authoritative legal knowledge-base inputs. Search results from community posts, social media, private blogs, law-firm explainers and model-generated summaries must not be stored as legal authority.

The ingestion script currently accepts HTTPS sources on government/court domains ending in `.gov.in`, `.nic.in` or `.gov`, plus explicitly listed official domains. This allowlist is a technical guardrail, not proof that a page is current, authoritative or legally effective.

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
4. Compare the extracted text against the official source, including section numbering and schedules.
5. Record amendment/version information and any repeal, substitution or commencement notification.
6. Set `--verified` only after human review; otherwise the document remains `unverified` and is excluded from retrieval.
7. For amended provisions, ingest each material version with effective dates. Do not overwrite history.
8. Re-run retrieval and citation-accuracy tests after every update.

## Ingestion CLI

```bash
python -m scripts.ingest_legal \
  --url "https://www.indiacode.nic.in/..." \
  --title "Exact displayed title" \
  --source-name "India Code" \
  --document-type act \
  --act-name "Exact Act name" \
  --jurisdiction IN \
  --language en \
  --effective-from YYYY-MM-DD
```

The command needs `SUPABASE_URL`, backend-only `SUPABASE_SERVICE_ROLE_KEY`, and the local embedding model. It downloads one file, extracts PDF text using PyMuPDF or HTML text using BeautifulSoup, chunks around section/chapter structure, embeds passages and stores the document/chunks.

Add `--verified --verified-by "reviewer identifier"` only after all checks above. No automatic legal-currentness guarantee is provided. Scanned/image-only PDFs fail if they yield insufficient text; OCR is intentionally not run implicitly.

## Metadata and temporal validity

Store:
- Act/document title and document type.
- Act name, chapter, section, subsection and paragraph labels.
- Jurisdiction and category.
- Official source name and URL.
- Publication date, effective-from/effective-to and version/amendment notes.
- Verification status, reviewer and verification date.
- Original content checksum and source language.

A provision marked `historical` must be visibly labelled historical. It must not be described as currently in force without verifying the effective dates and subsequent amendments. A matching section does not establish its application to a particular person's facts.
