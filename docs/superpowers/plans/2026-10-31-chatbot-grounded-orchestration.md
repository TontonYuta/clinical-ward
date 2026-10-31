# Chatbot Grounded Orchestration Implementation Plan

> For agentic workers: use subagent-driven development or executing-plans to implement this plan task-by-task.

Goal: Củng cố chatbot theo luồng backend-grounded, có provenance và safe abstention nhất quán.

Architecture: Giữ local deterministic action intents; chuyển tra cứu thuốc, DDI và câu hỏi lâm sàng sang backend với metadata nguồn; Gemini chỉ là fallback. Session context giữ thuốc đang hoạt động cho câu hỏi tiếp nối.

Tech Stack: FastAPI, Pydantic, SQLAlchemy async, React/TypeScript, pytest, npm.

Spec: docs/superpowers/specs/2026-10-31-chatbot-grounded-design.md

Global Constraints:
- Không tuyên bố bao phủ toàn bộ tương tác thuốc.
- DDI không tìm thấy không đồng nghĩa an toàn.
- Mọi đầu ra qua input/output guardrail.
- Không thay đổi nguồn dữ liệu PDF/DAV trong kế hoạch này.

Review Focus:
- Exact drug lookup phải kèm citation và trạng thái nguồn; kiểm thử trong Task 2.
- Unknown/ambiguous drug phải safe-abstain; kiểm thử trong Task 2.
- DDI indexed, unindexed và backend failure phải tách biệt; kiểm thử trong Task 3 và Task 4.
- Follow-up deictic query phải giữ session context; kiểm thử trong Task 2.
- Local operational action card không bị Gemini/backend tự do ghi đè; kiểm thử trong Task 4.

Task 1: Structured provenance schema
Files: backend/app/schemas/copilot.py, src/services/api.ts, src/types/chat.ts
- Add optional answer_type, source_status, confidence, abstention_reason; write failing serialization tests first.

Task 2: Authoritative medication lookup states
Files: backend/app/services/copilot_drug_lookup.py, backend/app/services/copilot_drug_formatter.py, backend copilot tests.
- Exact matches return source_status=exact_match; inventory suggestions return inventory_suggestion; unknown drugs return safe_abstention/not_found; test deictic session lookup.

Task 3: Backend DDI response contract
Files: existing DDI router/service and DDI tests.
- Add source table/status and explicit no-match coverage disclaimer without changing pair semantics; test indexed, unindexed and failure paths.

Task 4: Frontend orchestration and UI metadata
Files: src/utils/nlp/agentAsync.ts, src/components/LeftPane/ChatWindow.tsx, frontend tests.
- Map/render provenance and preserve operational action precedence, no-match and network failure wording.

Task 5: Verification and deployment readiness
- Run backend tests, npm test, lint, source validation, build, and live Vercel smoke checks; review unsupported claims and commit/push.
