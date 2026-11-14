# Source Page Grounding and Release Readiness

## Intent

Keep chatbot source citations aligned with the PDF page that contains the requested section, and preserve the corrected continuation text in both the source JSON and seeded database. This is needed before shipping the pending full-stack changes.

## Goals

- Derive section page locations from the actual PDF text/layout for every monograph.
- Seed those locations into the existing section_pages field and use them for citations.
- Ensure evidence passed to claim verification is the same evidence included in the LLM prompt.
- Establish repeatable backend and frontend release checks before production deployment.

## Non-goals

- Add drug-specific or claim-specific medical rules.
- Change clinical advice or generate new medical content.
- Deploy while required release checks fail.

## Approaches

1. Keep citing the monograph's first page. This is small but cannot point users to a later requested section.
2. Derive each supported section's page from the source PDF and persist the page map with the monograph. This is the selected approach because the PDF is already the source of truth and the existing model/helper already support section_pages.
3. Infer the page from LLM output. Rejected because page attribution must be deterministic and source-grounded.

## Design

Extend the PDF extraction flow to record structural section headings and their page locations within each monograph. Preserve the map in JSON and SQLite. The existing page resolver will choose the requested field's mapped page and retain the monograph start page only as fallback. Update the RAG provenance regression test to verify the current claim/evidence contract rather than the removed legacy whole-answer critic hook. Before production, run the backend regression suite, frontend tests/build/typecheck, and production health verification.

## Constraints

- No manually curated medication facts or per-drug exceptions.
- Page numbers and text must come from the PDF and preserve existing text.
- Do not deploy unless the agreed verification gates pass.

## Review focus

- Two monographs share a PDF page; section attribution must not cross the monograph boundary.
- The requested section begins on a continuation page after the monograph title.
- A page contains the same heading for a preceding monograph in another column.
- The database has an older source digest and must refresh corrected data at startup.
- A generated response cites a page different from the page containing its requested section.
