# Phân loại ca backend chưa đạt — 06/11/2026

Không đổi assertion cũ để ép lời giải lâm sàng hoặc gán nguồn chưa có. Bảng này phân biệt thiếu chức năng/nguồn, khác hợp đồng kết quả, hồi quy đã sửa và lỗi cần theo dõi dưới tải. Kết quả full cuối được ghi ở báo cáo logic; các số của lượt trung gian không được cộng thành số ca qua của lượt cuối.

| Ca / nhóm | Quan sát và phân loại | Trạng thái |
| --- | --- | --- |
| `test_coldchain_telemetry_vs_emergency_intent` | Assertion đòi “Bình thường (An toàn)” và nhánh kịch bản cũ. Bản sửa chỉ báo phạm vi giám sát đã lưu; không suy ra vaccine an toàn từ một trạng thái tủ | Khác hợp đồng câu trả lời; không phục hồi khẳng định an toàn để qua test |
| `test_out_of_database_knowledge_boundary` | Test đòi gợi ý/chips trong khi một số chips kịch bản cũ đang tắt | Khác hợp đồng UI/chức năng; giữ ghi nhận thiếu gợi ý, không tự coi PASS |
| `test_chatbot_provenance_metadata_contract` | Đòi `exact_match` trong đường trả `fallback_deterministic` | Khác hợp đồng metadata; không gắn nhãn nguồn chính xác giả |
| `test_chatbot_evaluation_fails_regression_instead_of_reporting_metrics_only` | Bộ tổng hợp có nhiều ràng buộc về intent, grounded, nguồn và trường thông tin. Một assertion thất bại không chứng minh mọi ca bên trong sai hoặc mọi ca đúng | Còn thiếu độ phủ/chưa đồng bộ hợp đồng; evaluator giữ thất bại |
| `test_clinical_drug_enrichment_and_empty_handling` | DAV trả một số trường lâm sàngNULL dù có link chuyên luận. Quan sát Efferalgan cho thấy link từng bị gắn tên/dạng nhưng trộn liều từ hoạt chất khác phạm vi chế phẩm | Lỗi/thiếu dữ liệu thật. Assistant chặn hướng dẫn chế phẩm chưa xác minh; corpus và enrichmentAPI chưa được xác nhận đầy đủ |
| `test_simple_fever_question_routes_to_triage_and_asks_for_context` | Cùng prompt mà securitytest cho phép/yêu cầuCLINICAL_CASE_CLARIFICATION, test này chỉ nhậnconsultation/abstention | Hợp đồng mâu thuẫn; bản sửa trả yêu cầu bổ sung ca bệnh |
| Ba ca `test_combination_drug_service` | Đòi nguồn/liều tổng hợp từ chuyên luận thành phần và citation trang. Với chế phẩm chưa có nguồn đúng, hiện chỉ cung cấp dữ liệu đăng ký và từ chối chỉ dẫn thay vì áp liều thành phần/dạng khác | Độ phủ nguồn/chức năng còn thiếu; thay đổi có chủ ý để tránh sai chế phẩm. Không chứng nhận corpus phối hợp |
| GERD/Oresol/HTNCKD/generalHTN | Đòi phác đồ/cụm tiêu đề hoặc intent cũ. Ca trước sửa có từng nhầm sang thuốc không liên quan; nay thiếu hướng dẫn đúng chủ đề thì hỏi thêm/từ chối | Chặn sai chủ đề đã sửa; chức năng phác đồ đầy đủ vẫn còn thiếu nguồn |
| HTNpregnancy | Đã có nội dung cùng chủ đề nhưng assertion tiêu đề viết hoa cố định không khớp | Khác định dạng; nguồn/phần phụ vẫn cần thẩm định chuyên môn riêng |
| `test_fever_with_nausea_symptom_inquiry_protocol` và ba mined symptom cases | Đòi cannedtriage/consultation; hiện trảCLINICAL_CASE_CLARIFICATION và không chẩn đoán từ ADRthuốc không được nêu | Giảm trả lời không có nguồn; chưa có hướng dẫn ca bệnh đầy đủ |
| `test_copilot_clinical_scenarios` | Dị ứng đúngBN8820 vàPenicillin nhưng test đòi actioncard thẩm định đầy đủ dù chưa có mã đơn/thuốc. API chỉ trả thông tin hồ sơ và nêu chưa hoàn tất audit | Giới hạn workflow/thông tin; không tạo card an toàn/đổi kháng sinh từ dữ kiện thiếu |
| Hai ca mở form/dặn dò bị gatebệnh chung bắt nhầm | Cụm “thuốc cho bệnh nhân” khớp patternquá rộng | Đã sửa loại trừ lệnh workflow tường minh;32 relevance + hai test gốc chạy trênDBseedriêng qua34 ca, assertion cũ giữ nguyên |
| `test_registry_stock_revision_changes_after_inventory_dispatch` | Test chọn lô có hạn05/11/2026; sang06/11 bị409 đúng quy tắc hết hạn | Sửa fixture của ca kiểm tra revision thành lô còn hạn tương đối theo ngày hiện tại. Bốn registrycases qua; test chặn hết hạn riêng không bị nới |
| `test_concurrent_audit_appends_do_not_fork` | Lượt full dưới tải gặpSQLite `database is locked`; chạy riêng sáu phiên qua | Không được xóa thất bại full. Còn vấn đề nhận tải/timeout; khóa bảo vệ thứ tự chuỗi không bảo đảm mọi request sẽ được nhận. Cần benchmark/process/transactionretry trước triển khai thực |

Không có số liệu nào ở đây chứng nhận kê đơn, quy định pháp luật hay chất lượng vaccine. Các giá trị/dữ liệu lâm sàng chưa được đối chiếu nguồn vẫn phải được coi là chưa xác minh, kể cả khi UI hoặc một nhóm test qua.

## Phần trả lời bị hạn chế thêm khi kiểm tra chế phẩm chặt hơn

Lượt509 ca cuối ghi479 passed/30 failed. So với lượt476/23 trước đó, guardchếphẩm làm nhiều truy vấn Zithromax/Teglutik/Concor và đầy đủ thông tin biệt dược chuyển sang yêu cầu làm rõ. Đây là giảm độ phủ chức năng có chủ ý khi nguồn/dạng/đường dùng chưa được xác minh, không được mô tả là mọi ca này vẫn hoạt động bình thường hay chỉ đổi tiêu đề. Cần bổ sung/đối chiếu nguồn đúng chế phẩm để khôi phục hướng dẫn, thay vì nới gate để lấy lại số pass.

Một lỗi riêng ở followup: trả lời bảo thủ trước khi đặt context làm mất tên thuốc đã được nhận diện. Ca FSM/session đã tách làm lỗi tích hợp để sửa và kiểm tra sau lượt full; không đồng nhất mất context với việc thiếu nguồn lâm sàng.

Danh sách thất bại chính xác của lượt full này (kết quả sau từng bản sửa nhỏ được ghi riêng ở báo cáo tổng):

```text
backend/tests/test_backend_security_guardrails.py::test_coldchain_telemetry_vs_emergency_intent
backend/tests/test_backend_security_guardrails.py::test_out_of_database_knowledge_boundary
backend/tests/test_backend_security_guardrails.py::test_chatbot_provenance_metadata_contract
backend/tests/test_chatbot_evaluation.py::test_chatbot_evaluation_fails_regression_instead_of_reporting_metrics_only
backend/tests/test_chatbot_evaluation.py::test_clinical_indication_question_is_not_sent_to_unrelated_patient_scenario
backend/tests/test_chatbot_offtarget_guardrails.py::test_zithromax_meal_timing_returns_dosage_monograph
backend/tests/test_clinical_enrichment.py::test_clinical_drug_enrichment_and_empty_handling
backend/tests/test_clinical_rag.py::test_simple_fever_question_routes_to_triage_and_asks_for_context
backend/tests/test_combination_drug_service.py::test_multi_monograph_dual_resolution_efferalgan_codeine
backend/tests/test_combination_drug_service.py::test_multi_monograph_strict_unverified_handling
backend/tests/test_combination_drug_service.py::test_chat_api_combination_drug_e2 e
backend/tests/test_duty_cycle_3_cases.py::test_gerd_reflux_management
backend/tests/test_duty_cycle_4_production_fixes.py::test_oresol_hydration_guidance_not_anaphylaxis
backend/tests/test_duty_cycle_5_production_fixes.py::test_hypertension_in_ckd_guidance_not_morphine_or_ceftriaxone
backend/tests/test_duty_cycle_5_production_fixes.py::test_hypertension_in_pregnancy_guidance_not_tetanus_serum
backend/tests/test_duty_cycle_5_production_fixes.py::test_general_hypertension_choice_guidance
backend/tests/test_duty_cycle_6_production_fixes.py::test_fever_with_nausea_symptom_inquiry_protocol
backend/tests/test_prescription_advice.py::test_copilot_clinical_scenarios
backend/tests/test_prescription_auditor.py::test_copilot_drug_administration_timing_zithromax
backend/tests/test_production_mined_cases.py::test_mined_production_query[Kh\xe1 ng sinh Zithromax u\u1 ed1 ng tr\u01 b0\u1 edbc hay sau \u0103 n?-MEDICATION_SAFETY_PROFILE-expected_snippets1]
backend/tests/test_production_mined_cases.py::test_mined_production_query[Th\xf4 ng tin \u0111\u1 ea7 y \u0111\u1 ee7 c\u1 ee7 a Teglutik-MEDICATION_SAFETY_PROFILE-expected_snippets5]
backend/tests/test_production_mined_cases.py::test_mined_production_query[Li\u1 ec1 u d\xf9 ng c\u1 ee7 a Teglutik-MEDICATION_SAFETY_PROFILE-expected_snippets6]
backend/tests/test_production_mined_cases.py::test_mined_production_query[\u0111 au b\u1 ee5 ng, \u0111 i ngo\xe0 i, m\u1 ea5 t n\u01 b0\u1 edbc l\xe0 bi\u1 ec3 u hi\u1 ec7 n c\u1 ee7 a g\xec-CLINICAL_AI_CONSULTATION-expected_snippets14]
backend/tests/test_production_mined_cases.py::test_mined_production_query[tri\u1 ec7 u ch\u1 ee9 ng \u0111 au b\u1 ee5 ng, bu\u1 ed3 n n\xf4 n, s\u1 ed1 t cao l\xe0 bi\u1 ec3 u hi\u1 ec7 n c\u1 ee7 a g\xec-CLINICAL_AI_CONSULTATION-expected_snippets19]
backend/tests/test_production_mined_cases.py::test_mined_production_query[Bi\u1 ec3 u hi\u1 ec7 n bu\u1 ed3 n n\xf4 n, s\u1 ed1 t cao th\xec n\xean s\u1 eed d\u1 ee5 ng thu\u1 ed1 c n\xe0 o-CLINICAL_AI_CONSULTATION-expected_snippets33]
backend/tests/test_production_mined_cases.py::test_mined_multiturn_deictic_context
backend/tests/test_production_mined_cases.py::test_mined_doctor_hung_session_cases
backend/tests/test_production_mined_cases.py::test_fsm_device_isolation_multi_session
backend/tests/test_universal_drug_intelligence.py::test_universal_coverage_10_drug_classes
backend/tests/test_universal_drug_intelligence.py::test_natural_condition_phrasing_not_tripped_by_symptoms
```
