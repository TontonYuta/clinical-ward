# Thư viện Tài liệu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Xây trang Tài liệu độc lập để lưu trữ, tìm kiếm, mở PDF và nạp văn bản mới vào kho tri thức chatbot.

**Architecture:** Backend đọc manifest để cung cấp danh mục động và bổ sung endpoint upload; FE dùng một route trạng thái độc lập trong `App`, không dùng `LegalDocsModal`. PDF mở qua đường dẫn tĩnh sau khi metadata được trả về.

**Tech Stack:** React 19, TypeScript, lucide-react, FastAPI, pypdf, SQLite FTS.

**Spec:** `docs/superpowers/specs/2026-11-13-documents-library-design.md`

## Global Constraints
- Không khôi phục khu vực Tiện ích & Pháp lý trong sidebar.
- Không tạo danh sách văn bản cố định mới trong FE; danh mục phải lấy từ manifest/API.
- Không thay đổi modal pháp lý cũ.
- Upload phải dùng pipeline `ingest_pdf_bytes` hiện có để đảm bảo provenance và indexing.

## Review Focus
- Manifest rỗng/hỏng: API trả danh mục rỗng thay vì lỗi 500.
- File không phải PDF/rỗng: từ chối và giữ nguyên danh mục.
- Tài liệu trùng mã: cập nhật metadata, không tạo bản ghi lặp.
- URL PDF có ký tự đặc biệt: chỉ trả URL file đã sanitize.
- Offline/API lỗi: trang vẫn hiển thị trạng thái lỗi và không crash.

### Task 1: API danh mục tài liệu

**Files:** Modify `backend/app/routers/admin_knowledge.py`; Test `backend/tests/test_pdf_ingestion_pipeline.py`

- [ ] Viết test GET `/api/v1/admin/knowledge/documents` kiểm tra metadata từ manifest và danh mục rỗng an toàn.
- [ ] Chạy test thấy fail vì route chưa tồn tại.
- [ ] Thêm hàm đọc manifest, chuẩn hóa response `{documents: [...]}` gồm `id,title,legal_basis,edition_year,filename,public_url,sha256,bytes`.
- [ ] Chạy test route và test upload hiện có.

### Task 2: API client và model FE

**Files:** Create `src/types/documents.ts`; Modify `src/services/api.ts`; Test `tests/test_documents_api_contract.ts`

- [ ] Viết test kiểm tra hàm lấy danh mục tạo đúng URL và upload gửi multipart metadata.
- [ ] Chạy test fail.
- [ ] Tạo type `KnowledgeDocument` và các hàm `getKnowledgeDocumentsApi`/`uploadKnowledgeDocumentApi`.
- [ ] Chạy test pass và `tsc --noEmit`.

### Task 3: Trang thư viện độc lập

**Files:** Create `src/components/Documents/DocumentsLibrary.tsx`; Test `tests/test_documents_library_contract.ts`

- [ ] Viết test kiểm tra tiêu đề Tài liệu, input tìm kiếm, bộ lọc và vùng danh sách.
- [ ] Chạy test fail.
- [ ] Implement loading/error/empty states, tìm kiếm theo title/legal basis/filename, filter theo loại metadata, card tài liệu và nút mở PDF.
- [ ] Thêm form upload PDF với title/legal basis/year; refresh danh mục khi thành công.
- [ ] Chạy test và `tsc --noEmit`.

### Task 4: Điều hướng tab mới

**Files:** Modify `src/App.tsx`, `src/components/Sidebar.tsx`, `src/components/Navigation/MobileBottomNav.tsx` nếu cần; Test `tests/test_documents_navigation.ts`

- [ ] Viết test rằng callback Tài liệu mở trang library độc lập, không gọi `LegalDocsModal`.
- [ ] Chạy test fail.
- [ ] Thêm state `isDocumentsOpen`, render library full workspace/overlay độc lập, giữ modal cũ không dùng từ sidebar.
- [ ] Chạy toàn bộ test FE liên quan và build.

### Task 5: Kiểm tra tích hợp

- [ ] Chạy `pytest backend/tests/test_pdf_ingestion_pipeline.py -q`.
- [ ] Chạy `npm run lint`, test sidebar và test library.
- [ ] Chạy `npm run build`.
- [ ] Chạy `git diff --check` và ghi nhận lỗi whitespace tồn tại ngoài phạm vi nếu có.
