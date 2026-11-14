# Kế hoạch triển khai chatbot production

> Thực hiện từng task trong checkout production theo yêu cầu. Không commit, push, publish hoặc deploy. Checklist ghi deliverable từng task.

**Goal:** Chatbot production có evidence-grounded workflow, không hardcode tri thức/từ vựng lâm sàng, báo online/local/offline đúng, tối ưu token và ingest PDF có quản trị.
**Architecture:** Hợp nhất dần React/FastAPI routes vào response contract/orchestrator chung. Tách tri thức tài liệu khỏi dữ liệu vận hành live, bắt claim có provenance, cung cấp availability API độc lập.
**Tech Stack:** React/Vite/TypeScript, FastAPI/Pydantic, SQLAlchemy/SQLite, provider Gemini hiện tại, BM25/SQLite FTS và NumPy vector index.
**Spec:** docs/superpowers/specs/2026-11-11-production-chatbot-design.md

## Ràng buộc chung
- Không có facts lâm sàng, trigger nghiệp vụ hoặc câu trả lời y khoa viết sẵn trong application code.
- Không lộ API key; key hiện diện không đồng nghĩa provider hoạt động.
- Claim grounded phải dẫn evidence đã truy xuất và gửi model.
- Thiếu/mâu thuẫn evidence thì hỏi lại/abstain.
- Dữ liệu vận hành live lấy từ DB/API có phân quyền.
- Offline không tạo evidence giả, không nói cache cũ là mới.
- Giữ thay đổi chưa commit; không commit/push/deploy.
- Tôn trọng reduced-motion; không hạ chất lượng để làm xanh test.

## Rủi ro cần kiểm chứng
- Key sai/throttle/mất mạng: không hiện Online AI.
- Backend mất nhưng browser còn dữ liệu cũ: không tuyên bố vừa truy xuất.
- PDF scan/hỏng/trùng/thay version: giữ provenance/index active.
- NLU timeout/sai schema: không fallback keyword nghiệp vụ.
- Nguồn mâu thuẫn/số liệu thiếu evidence: nêu xung đột hoặc abstain.

## Bản đồ khu vực file
- API/orchestration: backend/app/routers/copilot.py, backend/app/services/chatbot/copilot_orchestrator.py.
- Routing/RAG/tri thức nhúng: backend/app/services/chatbot/*, rag/*, clinical_reasoning/*, clinical_ddi_engine/*.
- Model/token/cache: backend/app/services/llm_provider.py, telemetry_store.py, cache/*.
- Availability/admin: admin_monitoring.py, admin_key_vault.py, service/router/schema mới.
- PDF/index: clinical_indexer.py, rag/embeddings/*, models/migrations, router/service ingestion mới.
- UI: src/App.tsx, src/utils/nlp/agentAsync.ts, src/services/api.ts, src/types/chat.ts, status hook/component mới.
- Admin: upload/preview/review/publish lifecycle.
- Tests: backend/tests/* và tests/*.

## Tasks

### Task 1 — Inventory workflow, hardcode nghiệp vụ và chi phí
**Files:** Tạo docs/superpowers/inventories/2026-11-11-chatbot-workflow-inventory.md; chỉ đọc code.
- [ ] Truy mọi entrypoint tới response: chat/stream, multimodal, cache, action, local fallback, legacy handler.
- [x] Liệt kê active LLM/embedding callsite, nhánh gọi, lượt gọi, prompt, token cap, usage accounting, cache; phân biệt provider usage và estimate.
- [ ] Phân loại keyword, fact, template, alias, dosage/DDI, graph, regex theo file/hành vi; phân biệt code/config với tri thức.
- [ ] Ghi response path bypass RAG/evidence, gồm backend early return và frontend fallback.
- [ ] Chỉ static inventory/đọc code; chưa benchmark hiệu năng.
- [ ] Đối chiếu từng mục với function/file nguồn; ghi phạm vi và giới hạn.
**Hoàn tất:** inventory truy vết mọi entrypoint, response path, provider call, tri thức nhúng và lỗ hổng token.

### Task 2 — Baseline telemetry và response contract
**Files:** backend/app/schemas/copilot.py, models/copilot_log.py, services/llm_provider.py, routers/copilot.py, src/types/chat.ts, tests.
- [x] Test token provider-reported vs estimated và cache/no-call.
- [x] Bổ sung metadata claims/evidence/grounding tương thích ngược.
- [x] Thay global last-call bằng execution context theo request để tránh lẫn usage đồng thời.
- [x] Ghi model/provider, call count, cache, availability, evidence IDs và actual/estimated usage.
- [x] Chạy focused schema/provider/API tests và typecheck.
**Hoàn tất:** telemetry theo request đúng, không đọc nhầm request khác.

### Task 3 — Availability API
**Files:** service/router/schema mới, backend/app/main.py, key vault, src/services/api.ts, hook/types, tests.
- [x] Test backend/DB/index hỏng, key thiếu/sai, throttle/network và healthy.
- [x] Provider health check bounded cache/last checked; không trả secret.
- [x] Báo riêng backend, DB/index, provider; derive online_ai/local_only/offline/checking.
- [x] Client polling/backoff; không suy provider health từ key presence.
- [x] Chạy endpoint tests, typecheck/build.
**Hoàn tất:** mode phản ánh đúng lỗi, không lộ khóa.

### Task 4 — Icon glow và status UI
**Files:** src/App.tsx, component trạng thái mới, styles, UI tests.
- [x] Glow chậm/nhẹ, độc lập connectivity, tôn trọng prefers-reduced-motion.
- [x] Hiện Online AI/Local-only/Offline/Checking bằng text/icon, không chỉ màu.
- [x] Chạy frontend typecheck/build.
- [ ] Test launcher accessibility, mobile/desktop, keyboard và reduced-motion tự động.
**Hoàn tất:** người dùng nhận ra chatbot và mode đúng; glow không ngụ ý kết nối tốt.

### Task 5 — Offline an toàn, bỏ clinical fallback frontend
**Files:** src/utils/nlp/agentAsync.ts, queryProcessor.ts, intents/*, geminiService.ts, App.tsx, tests.
- [x] Test backend lỗi không trả canned clinical advice hoặc DDI hardcode.
- [x] Backend lỗi trả unavailable/abstention/retry thay câu y khoa dựng sẵn.
- [x] Partial stream không được đánh dấu complete/verified sau lỗi.
- [x] Chạy offline dispatch tests, typecheck/build.
- [ ] Rà trạng thái/cache offline và freshness trên toàn UI.
**Hoàn tất:** mất backend/cloud không sinh câu trả lời lâm sàng không nguồn.

### Task 6 — Một NLU, một evidence-gated orchestration
**Files:** copilot_orchestrator.py, NLU/schema/router, pure_rag_handler.py, sandwich_pipeline.py, multi_intent_handler.py, fsm_router.py, tests.
- [ ] Test lookup, multi-intent, multiturn, live operations, malformed NLU, provider outage.
- [ ] Một structured NLU được truyền xuyên workflow; bỏ NLU/rewrite trùng.
- [ ] Tri thức tài liệu đi document retrieval; operations đi DB/API có quyền.
- [ ] Clarification/guardrail/action confirmation không mang nhãn grounded clinical.
- [ ] Chuyển handlers vào response contract chung; chỉ bỏ keyword route sau thay thế có test.
- [ ] Chạy route/integration tests.
**Hoàn tất:** factual paths khai báo source/metadata; không còn route heuristic nghiệp vụ ẩn.

### Task 7 — Citation từng claim và abstention gate
**Files:** rag/types.py, rag_pipeline.py, citation_grounder.py, self_rag_verifier.py, output_validator.py, schema, tests.
- [x] Đặt mặc định unverified; RAG thiếu citation/evidence và multimodal thiếu nguồn sẽ abstain.
- [x] Multi-intent gộp citations/evidence và không tự khẳng định grounded khi subanswer chưa xác minh.
- [ ] Claim map evidence ID, document version/hash, page/section, chunk cho mọi factual route.
- [ ] Xác minh evidence ở đúng generation context và citation giải được tới nguồn/trang cho mọi handler.
- [ ] Thay keyword overlap-as-proof bằng semantic support cộng provenance/số/đơn vị.
- [ ] Xử lý nguồn xung đột minh bạch.
- [ ] Test API/UI citation và abstention toàn bộ workflow.
**Hoàn tất:** không có grounded nếu claim/evidence/citation không hợp lệ.

### Task 8 — Di chuyển tri thức/từ vựng lâm sàng khỏi code
**Files:** inventory-listed code, backend/data/knowledge_base/*, registry/catalog ingestion, tests.
- [ ] Mỗi inventory item có test chứng minh đọc từ sourced data thay literal.
- [ ] Chuyển tri thức thành records có nguồn/version/effective date/review.
- [ ] Thay phrase-list bằng schema NLU và entity/intent catalogs; model lỗi thì clarify/abstain.
- [ ] Tính toán dùng thuật toán chung, tham số từ source records; giữ kiểm tra số học/đơn vị.
- [ ] Chỉ bỏ canned answers sau parity tests.
- [ ] Quét source, phân loại residual literals (UI/examples/tests/security vs hardcode nghiệp vụ).
- [ ] Chạy affected tests/source validation.
**Hoàn tất:** mỗi clinical fact/vocabulary có data owner/source/version; residual literal được phân loại.

### Task 9 — Tối ưu token
**Files:** adaptive_retriever.py, rag_pipeline.py, query_rewriter.py, session_context.py, llm_provider.py, prompts/cache, tests.
- [x] Loại bỏ usage estimates khỏi ledger chi phí, budget gate và số liệu token tiết kiệm; chỉ ghi token provider-report.
- [ ] Test evidence dedup, history budget, call count, cache invalidation và output policy.
- [ ] Dùng structured NLU/retrieval signals thay complexity keyword list.
- [ ] Budget context theo tokenizer/provider estimate hoặc count API; chars không phải token chính xác.
- [ ] Reuse NLU/query embedding; bỏ rewrite/synthesis/verification call thừa.
- [ ] Gọn system prompts, output budget theo schema/evidence.
- [ ] So quality và token cùng bộ evaluation; không nhận estimated usage là actual savings.
**Hoàn tất:** giảm chi phí đo được mà không hạ quality dưới ngưỡng.

### Task 10 — Admin PDF ingestion và publication lifecycle
**Files:** model/schema/router/service/migration mới, clinical_indexer.py, vector store/index script, main.py, admin API/upload/review UI, tests.
- [ ] Test text PDF, malformed, no text, duplicate hash, partial extract, new version, embedding failure.
- [ ] Upload admin authenticated, size/type validation, durable storage, hash, metadata, audit.
- [ ] Extract page-aware text, báo trang rỗng/chất lượng thấp, chunk theo cấu trúc và giữ provenance.
- [ ] Index staging/version; verify chunk/vector/model/dimension trước publish.
- [ ] Preview/review/publish/retire/reindex/rollback; index cũ giữ nguyên nếu staging lỗi.
- [ ] UI trạng thái/lỗi; unpublished documents không retrieve.
- [ ] Chạy tests, migrations, admin build, backup/restore rehearsal.
**Hoàn tất:** admin upload/publish; câu trả lời cite đúng version/trang; lỗi update không hỏng index cũ.

### Task 11 — Bảo mật production và release gates
**Files:** deploy config/docs, auth/security, upload limits, health/telemetry, CI/build/test config.
- [ ] Test admin RBAC, upload abuse, PDF prompt injection, secret redaction, data boundary, rollback.
- [ ] Verify production secrets/config, durable storage, migration, backup/recovery.
- [ ] Chạy backend suites, frontend tests, type/build, admin build, source validation, readiness checks.
- [ ] Đánh giá paraphrase, unsupported claims, conflict, offline, citation accuracy, token cost, latency, PDF ingestion.
- [ ] Block release khi có clinical claim không nguồn, availability sai, lộ secret, mất data hoặc unsafe offline.
- [ ] Chuẩn bị canary/rollback; chỉ deploy theo chỉ thị riêng.
**Hoàn tất:** có release evidence/rollback; không deployment tự động.
