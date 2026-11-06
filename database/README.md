# Local legal source files

Place manually downloaded official source documents in this directory before running local-file ingestion.

Example:
```text
database/
└── land_acquisition_2013.pdf
```

Rules:
- Store only source files intended for the legal knowledge-base ingestion workflow.
- The ingestion command accepts PDF, HTML and HTM files up to 50 MB.
- Keep the original official HTTPS source URL in the ingestion command as `--source-url`; the URL is provenance metadata and is not fetched in local-file mode.
- Local files are validated for format, size, extracted text and chunk structure. New records remain `unverified`.
- Do not place secrets, credentials, user case files or personal data here.
- Do not commit downloaded source PDFs to Git. Keep them local; this README preserves the directory structure in the repository.
