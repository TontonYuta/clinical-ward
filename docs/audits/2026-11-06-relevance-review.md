# Clinical relevance review and final verification delta

This is a software information-routing review. It does not certify diagnoses, doses, source content, registry metadata or clinical safety.

## Final correction: preserve identity when clinical evidence is insufficient

The seeded full run in `artifacts/logic-audit/backend-commit-final.log` reported **479 passed / 30 failed in 509 cases**. It exposed a genuine context regression: conservative product abstention returned before updating the selected medication, so a Warfarin follow-up lost its subject. The last correction addresses that regression without relaxing the formulation, route or source guards.

All three product abstention branches—blank linked monograph, unsupported combination, and unverified brand presentation—now clear the previous medication context and retain only the selected registry row's name, declared ingredient and registration code when the row has an ID and registration code. They also return `active_medication_name`. Previous batch, stock, location and comparison context are cleared. No patient identity is added, no stock is asserted, and clinical abstention remains `rag_grounded=false`, confidence zero. Registration identity is not clinical-source validation.

Three new fake-database cases first failed because no active medication identity was returned. After correction, the seeded private-database selection passed **59 cases**, including the existing `test_fsm_device_isolation_multi_session`, all relevance cases and adjacent subject, grounding and product-stock tests. Its process exited zero. `git diff --check` passed. The whole suite was not rerun after this narrow delta; the 479/30 result must not be presented as a fresh whole-suite result for the final source.

```sh
DATABASE_URL='sqlite+aiosqlite:////home/ubuntu/GitHub/clinical-ward/artifacts/logic-audit/relevance-workflow-review.sqlite' GEMINI_API_KEY='' AUTH_REQUIRED=false /home/ubuntu/.venv/bin/python -m pytest -q backend/tests/test_clinical_relevance_regressions.py backend/tests/test_grounding_logic_regressions.py backend/tests/test_chatbot_subject_safety.py backend/tests/test_chatbot_product_stock.py backend/tests/test_production_mined_cases.py::test_fsm_device_isolation_multi_session --tb=short
```

The private database was created through SQLite backup from a read-only source connection. These cases used no real providers and wrote no running patient database. Existing assertions and clinical data were not rewritten.

## Interpretation of the 30 whole-suite failures

The complete names and root-owned classifications are in [the backend failure table](2026-11-05-backend-failure-classification.md). This companion review distinguishes functional coverage loss from a demonstrated unsafe answer. Conservative refusal can be the safer current behavior and still leave a real product capability gap. None of these failures is silently waived as a green suite.

| Whole-run failure | Interpretation and limits |
| --- | --- |
| `test_coldchain_telemetry_vs_emergency_intent` | Its first failure requires the blanket wording `Bình thường (An toàn)`; the implementation now reports the bounded status of a stored record. Later assertions in the same test were not reached by this whole-run result. |
| `test_out_of_database_knowledge_boundary` | Fails on the Venclexta profile expectation. The brand presentation guard reduces profile coverage; this failure does not show a fabricated-drug lookup escaping abstention. Earlier assertions in this test passed. |
| `test_chatbot_provenance_metadata_contract` | Expects `exact_match` where deterministic synthesis reports `fallback_deterministic`. This is a status-contract mismatch, not evidence that synthesis was an exact source match. |
| `test_chatbot_evaluation_fails_regression_instead_of_reporting_metrics_only` | Aggregate evaluation failure containing several response-contract/source-coverage differences. The logged failure list is truncated; it must not be described as one isolated wording issue or as a clinically validated accuracy result. |
| `test_clinical_indication_question_is_not_sent_to_unrelated_patient_scenario` | The evaluation query is `Metformin dùng cho bệnh gì?`, a generic named-ingredient question. Its clarification response is a functional source/presentation-resolution coverage gap; it should not be mislabeled solely as intentional brand coverage loss. No unrelated patient scenario is shown in this failure. |
| `test_zithromax_meal_timing_returns_dosage_monograph` | Brand timing coverage is reduced because the current product/source presentation cannot pass the guard. Do not restore the old response by applying timing or doses from an unverified formulation. |
| `test_clinical_drug_enrichment_and_empty_handling` | A real data/behavior contract gap: expected Paracetamol indications are null. This is not explained away by intent wording. |
| `test_simple_fever_question_routes_to_triage_and_asks_for_context` | The allowed-intent assertion excludes the actual `CLINICAL_CASE_CLARIFICATION`. The implementation asks for case context; this failure alone does not establish unsafe medical guidance. |
| `test_multi_monograph_dual_resolution_efferalgan_codeine` | The old contract demands a combined-product warning/dose profile assembled from separate component monographs. The new unsupported-combination response intentionally withholds it. Product-specific coverage is missing. |
| `test_multi_monograph_strict_unverified_handling` | Expects a Paracetamol monograph citation on a combination product. The current response cites registration identity rather than implying component evidence validates the combined product. Product guidance coverage remains absent. |
| `test_chat_api_combination_drug_e2e` | The reported failure is Efferalgan Codeine returning clarification instead of a product safety profile. This is the same combination-source coverage reduction; the prior Augmentin assertions were passed. |
| `test_gerd_reflux_management` | Returns bounded clinical clarification instead of the expected GERD guidance. This is a functional guidance coverage gap; a missing verified protocol must not be replaced with a guessed drug monograph. |
| `test_oresol_hydration_guidance_not_anaphylaxis` | Returns unsupported-product clarification. Oral Oresol no longer inherits IV Glucose component instructions. Correct product guidance remains a coverage gap. |
| `test_hypertension_in_ckd_guidance_not_morphine_or_ceftriaxone` | Returns clinical clarification rather than a guidance answer. This is a functional guideline coverage gap; the failure does not demonstrate a Morphine/Ceftriaxone answer. |
| `test_hypertension_in_pregnancy_guidance_not_tetanus_serum` | The first failure requires an exact uppercase heading; a pregnancy hypertension guidance response exists. Its complete clinical correctness and later assertions are not established by the first failed heading assertion. |
| `test_general_hypertension_choice_guidance` | Returns clinical clarification instead of general hypertension guidance. Coverage is reduced; selecting an arbitrary single-drug monograph is not an acceptable repair. |
| `test_fever_with_nausea_symptom_inquiry_protocol` | Returns case clarification rather than a fever protocol. The requested protocol capability remains missing; this does not justify inventing a diagnosis from an unrelated ADR list. |
| `test_copilot_clinical_scenarios` | Recorded patient allergy information is returned without the expected clinical card. A patient record alone does not establish a prescription safety assessment. Later scenarios in this test were not reached. |
| `test_copilot_drug_administration_timing_zithromax` | Same Zithromax formulation/timing coverage reduction as the off-target timing test. |
| Mined production `expected_snippets1` — Zithromax timing | Same brand timing coverage reduction; the response abstains rather than giving unverified timing instructions. |
| Mined production `expected_snippets5` — full Teglutik profile | Brand profile coverage is reduced by the presentation guard. This is a functional loss even though abstention is safer than a misleading product-specific profile. |
| Mined production `expected_snippets6` — Teglutik dose | Brand dose coverage is reduced by the presentation guard. The asserted dose must not be restored without correct source/presentation evidence. |
| Mined production `expected_snippets14` — abdominal symptoms | Case clarification replaces the requested generic consultation. This is a guidance coverage/response-contract difference, not evidence that a symptom-derived drug guess should be restored. |
| Mined production `expected_snippets19` — abdominal symptoms and fever | Same symptom-guidance coverage/response-contract difference. |
| Mined production `expected_snippets33` — nausea, fever and medicine choice | Clarification replaces an expected consultation with named drugs. Product/drug recommendations require relevant evidence; the functional guidance gap remains. |
| `test_mined_multiturn_deictic_context` | The historical failure includes the lost context after Teglutik abstention. Identity retention is now corrected and covered separately; the exact old test was not rerun in the final 59-case delta. Its requirement for a full medication profile may still conflict with the conservative product guard. Do not claim it now passes. |
| `test_mined_doctor_hung_session_cases` | Stops at the initial Warfarin branded profile expectation. This is product-profile coverage loss, distinct from the now-corrected loss of identity on a later turn. |
| `test_fsm_device_isolation_multi_session` | Genuine integration regression corrected in the final delta. Registered identity is retained after abstention; the exact existing test now passes on the seeded private database. |
| `test_universal_coverage_10_drug_classes` | Stops on Concor 5mg returning clarification. Universal ten-class coverage is not established; the guard introduces observable brand-profile coverage loss. Later drugs in this loop were not evaluated by this failure. |
| `test_natural_condition_phrasing_not_tripped_by_symptoms` | Stops on Concor in heart-failure context returning clarification. This is product-specific indication/source coverage loss; the failure does not prove the symptom parser mistook Concor for another drug. Later Metformin/Smecta assertions were not reached. |

## Boundaries retained

The Efferalgan manual probe demonstrated that a nonblank linked row could still be misleading: its title and dosage-form metadata identified an oral brand, while its adult dose field contained oral, rectal and IV instructions copied from a broad ingredient source. Blank-link detection alone could not prevent that response. Product-specific dose/indication requests now require an explicit compatible presentation and reject incompatible explicit routes, while generic ingredient monograph references remain a separate lookup path. That path is not universally covered: the Metformin evaluation failure above remains a named example requiring investigation.

The exact-presentation comparison deliberately abstains on ambiguous source prose and some valid but insufficiently structured presentation lists. General clinical subject recognition remains heuristic. These limitations and the coverage losses above must be visible in the final report; neither registration identity nor lexical/source overlap constitutes clinical validation.
