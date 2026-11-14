# Hoàn thiện danh mục thuốc BHYT theo Thông tư 20/2022 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng danh mục Phụ lục I Thông tư 20/2022 có cấu trúc, truy nguyên từng dòng về PDF, được đối chiếu tự động và thủ công theo các trường pháp lý trước khi dùng trong giám định BHYT.

**Architecture:** PDF Thông tư 20/2022 là nguồn chuẩn duy nhất cho danh mục thuốc. Một pipeline offline sẽ trích xuất bảng từ PDF, chuẩn hóa mỗi dòng thành bản ghi có số thứ tự, hoạt chất, đường dùng, hạng bệnh viện, tỷ lệ/ghi chú và trang PDF; một lớp kiểm định sẽ so sánh bản ghi với vùng OCR/layout và sinh báo cáo sai lệch. Engine frontend chỉ đọc snapshot dữ liệu đã xác minh, không chứa danh mục thuốc thủ công theo từng hoạt chất.

**Tech Stack:** Python, `pdftotext`/`pdftoppm`/Tesseract khi cần, JSON hoặc SQLite nguồn có version/hash, TypeScript, Vitest/tsx tests, pytest cho pipeline kiểm định.

**Spec:** `public/pdf/bhyt/source-provenance-bhyt.json` và PDF `public/pdf/bhyt/Thong_Tu_20_2022_TT_BYT_Danh_Muc_Thanh_Toan_Thuoc_BHYT.pdf`.

**Scope:** Hoàn thiện Phụ lục I (thuốc hóa dược và sinh phẩm). Phụ lục II (thuốc phóng xạ/chất đánh dấu) và Phụ lục III (dịch vụ kỹ thuật) không được nhập nhầm vào catalog thuốc; nếu cần hỗ trợ chúng sẽ là dự án dữ liệu riêng. Danh mục không được giả định số thứ tự liên tục: xác định tập STT thực tế từ PDF rồi đối chiếu mọi khoảng trống với văn bản.

## Global Constraints

- Không thêm nhánh theo tên thuốc, biệt dược hoặc cụm từ y khoa riêng lẻ để bù thiếu dữ liệu.
- Mọi kết luận thanh toán phải có `source_id`, `source_version`, `document_code`, `appendix`, `stt`, `pdf_page` và evidence gốc.
- Phân biệt số trang PDF vật lý với số trang in trên văn bản; không suy đoán khi hai giá trị khác nhau.
- Không coi OCR là đúng tuyệt đối: dòng có confidence thấp, bảng bị gãy cột hoặc điều kiện không đọc được phải chuyển sang trạng thái cần rà soát.
- Dữ liệu chưa đạt cổng xác minh không được dùng để kết luận `PASS` hoặc `REJECT`; chỉ được trả về trạng thái chưa xác minh.
- Không commit API key, file tạm OCR, dữ liệu bệnh nhân hoặc nội dung không thuộc Thông tư 20 vào nguồn danh mục.

## Review Focus

- Một hoạt chất có nhiều đường dùng (ví dụ uống/tiêm/dùng ngoài): phải tạo bản ghi riêng hoặc cấu trúc route rõ ràng, không gộp làm mất điều kiện. Test ở Task 2.
- Cột hạng bệnh viện có dấu `+`, `-`, ô trống hoặc ghi chú ngoại lệ: phải giữ raw cell và giá trị chuẩn hóa, không coi ô lỗi là được thanh toán. Test ở Task 2 và 3.
- Ghi chú giới hạn chỉ định hoặc tỷ lệ 50%: phải gắn với đúng `stt`, không áp dụng cho toàn hoạt chất nếu văn bản chỉ giới hạn một dạng. Test ở Task 3.
- Trang PDF vật lý và số trang in lệch nhau: citation phải mở đúng trang PDF chứa dòng dữ liệu. Test ở Task 4.
- Hoạt chất phối hợp, muối, dạng ester và tên có OCR lỗi: phải giữ tên nguồn, thêm khóa chuẩn hóa bất biến và báo bản ghi cần rà soát khi không chắc chắn. Test ở Task 2 và 5.

### Task 1: Khóa nguồn và tạo báo cáo baseline

**Files:**
- Create: `scripts/bhyt_tt20_source_audit.py`
- Create: `backend/data/knowledge_base/bhyt/tt20_extraction_runs/` (reports only)
- Modify: `public/pdf/bhyt/source-provenance-bhyt.json` only if the measured hash/page metadata is wrong
- Test: `backend/tests/test_bhyt_tt20_source_audit.py`

**Interfaces:**
- Produces `SourceArtifact` with `document_code`, `path`, `sha256`, `pdf_pages`, `appendix_start_page`, `appendix_end_page`.
- Produces a machine-readable baseline report containing extraction tool versions and all page ranges; no rule data is changed by this task.

- [ ] **Step 1: Write the failing tests**
  - Verify the local PDF hash equals the provenance manifest.
  - Verify the PDF has 84 physical pages and the manifest identifies it as `20/2022/TT-BYT`.
  - Verify the report refuses to continue when the hash or file is missing.
- [ ] **Step 2: Run tests to verify they fail for an intentionally unverified artifact**
  - Run: `PYTHONPATH=backend .venv/bin/pytest -q backend/tests/test_bhyt_tt20_source_audit.py -v`
  - Expected: RED until the source audit module exists.
- [ ] **Step 3: Implement `audit_tt20_source(path, manifest_path) -> SourceArtifact`**
  - Compute SHA-256 and physical page count. Detect appendix boundaries from extracted page headings and record both physical and printed page labels when available.
  - Emit `source-audit.json` with tool versions and timestamp.
- [ ] **Step 4: Run tests and verify the report**
  - Expected: PASS and a baseline report identifying the exact PDF artifact.
- [ ] **Step 5: Commit**
  - `git add scripts/bhyt_tt20_source_audit.py backend/tests/test_bhyt_tt20_source_audit.py backend/data/knowledge_base/bhyt/tt20_extraction_runs`
  - `git commit -m "chore: audit TT20 source artifact"`

### Task 2: Trích xuất Phụ lục I theo từng dòng và giữ raw evidence

**Files:**
- Create: `scripts/extract_tt20_bhyt_catalog.py`
- Create: `backend/data/knowledge_base/bhyt/tt20_catalog_raw.json`
- Test: `backend/tests/test_tt20_catalog_extraction.py`

**Interfaces:**
- `extract_appendix_i(source: SourceArtifact) -> list[RawTt20Row]`.
- `RawTt20Row` gồm `stt`, `raw_cells`, `raw_text`, `physical_pdf_page`, `printed_page`, `extraction_method`, `confidence`, `evidence_hash`.

- [ ] **Step 1: Write failing tests**
  - Assert extraction starts at the detected Phụ lục I page and excludes Phụ lục II/III.
  - Assert rows retain raw cells and page numbers.
  - Assert repeated headers, footer artifacts and page markers are not emitted as drug rows.
  - Assert rows with merged/missing cells are marked `needs_review`, never silently completed.
- [ ] **Step 2: Run the extraction tests and verify RED**
- [ ] **Step 3: Implement the extractor**
  - Use layout text first; use OCR only for pages/regions where the text layer cannot recover cells.
  - Detect row boundaries from numeric STT and continuation lines. Preserve raw values before normalization.
  - Store extraction confidence and the exact page crop/text hash for each row.
- [ ] **Step 4: Run tests and inspect a stratified sample**
  - Sample first/middle/last rows, rows crossing pages, combination products, and rows with notes.
  - Expected: no row is accepted without a source page and raw evidence.
- [ ] **Step 5: Commit**
  - `git commit -m "feat: extract TT20 appendix I rows with provenance"`

### Task 3: Chuẩn hóa schema pháp lý, không suy đoán dữ liệu

**Files:**
- Create: `backend/app/services/bhyt/tt20_catalog_schema.py`
- Create: `backend/app/services/bhyt/tt20_catalog_normalizer.py`
- Create: `backend/data/knowledge_base/bhyt/tt20_catalog_normalized.json`
- Test: `backend/tests/test_tt20_catalog_normalization.py`

**Interfaces:**
- `NormalizedTt20Row`: `source_id`, `source_version`, `document_code`, `appendix`, `stt`, `active_ingredient_raw`, `active_ingredient_key`, `route_raw`, `route_categories`, `allowed_ranks`, `payment_ratio`, `conditions_raw`, `pdf_page`, `printed_page`, `verification_status`, `evidence`.
- `normalize_tt20_rows(rows: list[RawTt20Row]) -> list[NormalizedTt20Row]`.

- [ ] **Step 1: Write failing tests**
  - Verify every normalized row has a unique `(source_version, appendix, stt)` key.
  - Verify `+`/`-`/blank cells map deterministically to allowed ranks; unknown symbols become `needs_review`.
  - Verify route variants remain separate and no route is invented from drug name.
  - Verify payment percentages are parsed only from the row note/cell; absent percentage remains `null`, not 100%.
  - Verify combinations preserve the full raw INN and do not collapse to a single ingredient.
- [ ] **Step 2: Run tests and verify RED**
- [ ] **Step 3: Implement normalizer and schema validation**
  - Use declarative parsing tables for symbols and route labels. Keep raw values alongside normalized values.
  - Generate deterministic keys from source identity and STT; retain unresolved rows in the output with `verification_status = needs_review`.
- [ ] **Step 4: Run normalization tests and generate a discrepancy report**
  - Report row count, duplicate STT, missing route/rank, ambiguous payment conditions and unresolved OCR.
- [ ] **Step 5: Commit**
  - `git commit -m "feat: normalize TT20 catalog with legal provenance"`

### Task 4: Kiểm định hai lớp và đối chiếu với PDF

**Files:**
- Create: `scripts/verify_tt20_bhyt_catalog.py`
- Create: `backend/data/knowledge_base/bhyt/tt20_catalog_verification.json`
- Test: `backend/tests/test_tt20_catalog_verification.py`

**Interfaces:**
- `verify_catalog(normalized_rows, source) -> VerificationReport`.
- Verification statuses: `verified`, `needs_review`, `rejected`; no implicit fallback to `verified`.

- [ ] **Step 1: Write failing tests**
  - Verify row count, uniqueness and complete STT set against the extracted Appendix I range; report gaps rather than assuming STT must be contiguous.
  - Verify each row's normalized values can be traced back to raw cells and page evidence.
  - Verify a deliberately altered rank, route or payment ratio is detected.
  - Verify page links use physical PDF page and preserve printed page separately.
- [ ] **Step 2: Run tests and verify RED**
- [ ] **Step 3: Implement verification**
  - Compare layout extraction, OCR crop and normalized record. Use exact/normalized text comparisons only; never use a drug-specific exception.
  - Produce row-level diffs and a human-review queue with page/crop references.
- [ ] **Step 4: Manual review gate**
  - Review every `needs_review` row and a random sample of verified rows against rendered PDF images.
  - The catalog cannot be promoted until unresolved rows are zero or explicitly excluded from automated adjudication.
- [ ] **Step 5: Commit the verification report and code**
  - `git commit -m "feat: verify TT20 catalog rows against PDF evidence"`

### Task 5: Thay nguồn quy tắc frontend bằng snapshot đã xác minh

**Files:**
- Modify: `src/data/bhytDrugRules.ts` to become a generated compatibility adapter, not a hand-maintained catalog
- Create: `scripts/generate_bhyt_rules_ts.py`
- Modify: `src/types/bhyt.ts` to expose provenance and verification status
- Test: `tests/test_tt20_generated_catalog.ts`

**Interfaces:**
- Generated `BHYT_DRUG_RULES` is derived only from `tt20_catalog_normalized.json` rows with `verification_status = verified`.
- `findBhytRule(name, route)` returns a route-aware result containing source metadata; unresolved matches return `verification_status = needs_review`.

- [ ] **Step 1: Write failing tests**
  - Assert generated rules count equals the verified normalized-row count, not 114 by hardcoded expectation.
  - Assert every accepted rule has source hash, STT and physical PDF page.
  - Assert route-specific variants do not overwrite one another.
  - Assert unknown/unverified rows cannot be reported as fully covered.
- [ ] **Step 2: Run tests and verify RED**
- [ ] **Step 3: Implement generator and adapter**
  - Generate deterministic TypeScript data from the verified snapshot. Keep the generated file clearly marked and never edit it manually.
  - Update audit engine to treat `needs_review` as unresolved evidence rather than `NOT_IN_BHYT_CATALOG`.
- [ ] **Step 4: Run frontend and backend catalog tests**
  - `npx tsx tests/test_tt20_generated_catalog.ts`
  - Existing BHYT engine tests must pass after expected assertions are generalized to source-derived counts.
- [ ] **Step 5: Commit**
  - `git commit -m "feat: serve verified TT20 catalog snapshot"`

### Task 6: Sửa citation, UI và báo cáo giám định theo nguồn mới

**Files:**
- Modify: `src/services/bhytAuditEngine.ts`
- Modify: `src/components/RightPane/Tabs/BhytAuditTab.tsx`
- Modify: `src/components/RightPane/Tabs/BhytAuditReportModal.tsx`
- Modify: `src/utils/pdfDocumentResolver.ts`
- Test: `tests/test_bhyt_citation_provenance.ts`, `tests/test_bhyt_audit_report_source.ts`

**Interfaces:**
- Every violation uses the row's source document, STT, physical page and evidence URL.
- Report UI distinguishes `verified`, `needs_review` and `not_in_catalog`; it never labels unresolved OCR as a definitive rejection.

- [ ] **Step 1: Write failing tests**
  - Verify clicking a violation opens the exact TT20 page recorded for that row.
  - Verify a row with a printed-page/physical-page mismatch uses the physical page in the URL and displays both values.
  - Verify the exported report contains source code, STT, page and verification status.
- [ ] **Step 2: Run tests and verify RED**
- [ ] **Step 3: Implement source-driven citation and UI states**
- [ ] **Step 4: Run tests, lint and build**
- [ ] **Step 5: Commit**
  - `git commit -m "feat: show TT20 row-level citations in BHYT audit"`

### Task 7: Regression, coverage and release gate

**Files:**
- Modify: `tests/test_bhyt_audit_engine.ts` and related BHYT tests to remove fixed 114-rule assumptions
- Create: `scripts/report_tt20_catalog_coverage.py`
- Create: `docs/reports/tt20-bhyt-catalog-verification.md`

- [ ] **Step 1: Run deterministic checks**
  - Source hash/page audit.
  - Row-level extraction/normalization/verification tests.
  - Randomized route/rank/condition cases generated from the verified catalog.
  - Existing BHYT engine, sanitizer, XML and UI tests.
- [ ] **Step 2: Run quality gates**
  - `npm run lint`
  - `npm run build`
  - `npx tsx tests/test_bhyt_audit_engine.ts`
  - `npx tsx tests/test_bhyt_declarative_randomized.ts`
  - `PYTHONPATH=backend .venv/bin/pytest -q backend/tests/test_tt20_*`
- [ ] **Step 3: Review coverage report**
  - Must show total source rows, verified rows, review rows, excluded rows, route/rank/payment coverage and all discrepancies.
  - “Chính xác tuyệt đối” is reported only if verified rows cover the intended appendix scope and the review queue is empty; otherwise report the exact limitations.
- [ ] **Step 4: Do not deploy until the release gate passes**
  - Production remains unchanged while any row-level discrepancy or unresolved legal source remains.
- [ ] **Step 5: Commit the final verification report**
  - `git commit -m "docs: record TT20 BHYT catalog verification"`

## Expected Deliverables

1. A versioned, source-hashed TT20 Appendix I dataset with one record per legal row.
2. A row-level verification report and review queue.
3. A generated frontend compatibility adapter with no manually maintained drug list.
4. Audit results and citations tied to exact document/page/evidence metadata.
5. A reproducible coverage report that states whether the catalog is complete, partially verified, or not ready for production.
