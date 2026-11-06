"""Clinical subject, patient identity and formulation relevance boundaries."""
import asyncio
from types import SimpleNamespace

import pytest
from app.models.registry import DavNationalDrug, ClinicalDrugMonograph
from app.models.patient import PatientProfile
from app.services.rag.types import RagChunk, RetrievedChunk
from app.services.rag.citation_grounder import format_grounded_answer
from app.services.combination_drug_service import build_combination_drug_profile, resolve_combination_monographs
from app.services.copilot_drug_formatter import build_drug_profile_response
from app.services.chatbot.copilot_orchestrator import handle_copilot_chat
from app.services.session_context import SessionState
from app.schemas.copilot import CopilotQuery


class Rows:
    def __init__(self, values): self.values = values
    def scalars(self): return self
    def all(self): return self.values
    def scalar_one_or_none(self): return self.values[0] if self.values else None


def test_general_disease_question_cannot_select_single_iv_drug_monograph():
    chunk = RagChunk("iv", "Dược thư", "test", "test", "Natri nitroprusiat",
                     "Thuốc hạ huyết áp cho người suy thận: IV-DOSE-NOT-REQUESTED.", entity_type="monograph")
    result = format_grounded_answer("Thuốc hạ huyết áp cho người suy thận", [RetrievedChunk(chunk, 1)], [], {})
    assert result.rag_grounded is False
    assert "IV-DOSE" not in result.answer


def test_general_disease_question_keeps_matching_guideline_not_wrong_population():
    query = "Thuốc hạ huyết áp cho người suy thận"
    wrong = RagChunk("preg", "Clinical guideline", "test", "test", "Huyết áp trong thai kỳ",
                     "Thuốc hạ huyết áp và suy thận có nội dung khác hướng dẫn thai kỳ.", entity_type="guideline")
    correct = RagChunk("renal", "Clinical guideline", "test", "test", "Huyết áp ở người suy thận",
                       "Thuốc hạ huyết áp cho người suy thận được xem trong nguồn RENAL-GUIDE.", entity_type="guideline")
    result = format_grounded_answer(query, [RetrievedChunk(wrong, 1), RetrievedChunk(correct, .9)], [], {})
    assert "RENAL-GUIDE" in result.answer
    assert "hướng dẫn thai kỳ" not in result.answer


def test_general_treatment_question_outside_named_disease_list_rejects_iv_monograph():
    query = "Thuốc điều trị hen phế quản"
    chunk = RagChunk("iv", "Dược thư", "test", "test", "Aminophylline",
                     "Thuốc điều trị hen phế quản: IV-DOSE-NOT-REQUESTED.", entity_type="monograph")
    result = format_grounded_answer(query, [RetrievedChunk(chunk, 1)], [], {})
    assert result.rag_grounded is False
    assert "IV-DOSE" not in result.answer


def test_general_treatment_question_requires_matching_topic_and_population():
    query = "Thuốc điều trị hen phế quản cho trẻ em"
    wrong = RagChunk("wrong", "Clinical guideline", "test", "test", "Hen phế quản ở người lớn",
                     "Thuốc điều trị hen phế quản cho trẻ em: WRONG-POPULATION.", entity_type="guideline")
    correct = RagChunk("correct", "Clinical guideline", "test", "test", "Hen phế quản ở trẻ em",
                       "Thuốc điều trị hen phế quản cho trẻ em: MATCHING-GUIDE.", entity_type="guideline")
    result = format_grounded_answer(query, [RetrievedChunk(wrong, 1), RetrievedChunk(correct, .9)], [], {})
    assert "MATCHING-GUIDE" in result.answer
    assert "WRONG-POPULATION" not in result.answer


def test_general_treatment_gate_preserves_explicit_drug_and_contextual_followup():
    from app.services.chatbot.clinical_subject import is_general_disease_consultation
    assert not is_general_disease_consultation("Salbutamol điều trị hen phế quản như thế nào?")
    assert not is_general_disease_consultation("Thuốc này điều trị bệnh gì?")


@pytest.mark.parametrize("query,general_consultation", [
    ("Dặn dò đơn thuốc cho bệnh nhân", False),
    ("Tôi muốn kê đơn thuốc cho bệnh nhân mới, mở form kê đơn cho tôi", False),
    ("Thuốc điều trị hen phế quản cho bệnh nhân", True),
    ("Thuốc hạ huyết áp cho bệnh nhân suy thận", True),
])
def test_general_treatment_gate_preserves_prescription_workflows_without_excluding_patient_questions(query, general_consultation):
    from app.services.chatbot.clinical_subject import is_general_disease_consultation
    assert is_general_disease_consultation(query) is general_consultation


def test_combination_without_product_source_never_uses_component_iv_dose():
    drug = DavNationalDrug(id="ors", national_code="ORS-1", brand_name="Oresol", active_ingredient="Glucose; Natri clorid",
                           dosage_form="Thuốc bột", route="Uống", group="Thuốc", is_controlled=False)
    mono = ClinicalDrugMonograph(id="glucose", inn="Glucose", title="Glucose", adult_dosage="IV-DOSE: tĩnh mạch",
                                 indications="IV-INDICATION", drug_class="Dịch truyền", source="Glucose source")
    text, citations, source = build_combination_drug_profile(drug, None, [
        dict(ingredient_name="Glucose", status="verified_dtqg", monograph=mono),
        dict(ingredient_name="Natri clorid", status="unverified_in_dtqg", note="Chưa xác minh"),
    ])
    assert "IV-DOSE" not in text
    assert "IV-INDICATION" not in text
    assert "chưa" in text.casefold()


def test_combination_primary_source_requires_all_exact_ingredients():
    wrong = ClinicalDrugMonograph(id="DTQG-0048-Amoxicillinandpotass", inn="Amoxicillin and clavulanic acid", title="Wrong combination")
    class Db:
        async def execute(self, stmt):
            return Rows([wrong]) if "DTQG-0048-Amoxicillinandpotass" in stmt.compile().params.values() else Rows([])
    drug = DavNationalDrug(id="test", active_ingredient="Amoxicillin; Metformin", brand_name="Test", national_code="test")
    primary, _ = asyncio.run(resolve_combination_monographs(drug, Db()))
    assert primary is None


def test_empty_combination_source_is_not_a_complete_product_monograph():
    drug = DavNationalDrug(id="test", national_code="test", brand_name="Test combo", active_ingredient="A; B")
    blank = ClinicalDrugMonograph(id="blank", inn="A and B", title="Blank combo")
    text, _, _ = build_combination_drug_profile(drug, blank, [])
    assert "Chưa có nguồn lâm sàng đúng chế phẩm" in text


def test_component_identity_uses_exact_same_normalization_on_source_names():
    source = ClinicalDrugMonograph(id="codeine", inn="Codeine phosphate", title="CODEIN PHOSPHAT")
    class Db:
        async def execute(self, stmt): return Rows([source])
    for name, expected in [("Codein phosphat 30mg", "verified_dtqg"), ("Codeinex phosphat 30mg", "unverified_in_dtqg")]:
        drug = DavNationalDrug(id="test", active_ingredient=name, brand_name="Test", national_code="test")
        _, components = asyncio.run(resolve_combination_monographs(drug, Db()))
        assert components[0]["status"] == expected


def test_component_identity_accepts_monograph_without_optional_title():
    source = ClinicalDrugMonograph(id="glucose", inn="Glucose", title=None)
    class Db:
        async def execute(self, stmt): return Rows([source])
    drug = DavNationalDrug(id="test", active_ingredient="Glucose; Paracetamol", brand_name="Test", national_code="test")
    _, components = asyncio.run(resolve_combination_monographs(drug, Db()))
    assert components[0]["status"] == "verified_dtqg"
    assert components[1]["status"] == "unverified_in_dtqg"


@pytest.mark.parametrize("source_forms,compatible", [
    ("Viên nén 500mg", True),
    ("Dung dịch tiêm 500mg/ml", False),
    ("Viên nén 250mg; Dung dịch tiêm 500mg/ml", False),
    ("Viên nén 250mg\nDung dịch tiêm 500mg/ml", False),
    ("Viên nén giải phóng kéo dài 500mg", False),
    ("Viên nén 500mg/ml", False),
    ("Viên nén 250mg; Viên nén 500mg", True),
])
def test_blank_link_requires_unique_exact_formulation_compatible_fallback(source_forms, compatible):
    blank = ClinicalDrugMonograph(id="blank", inn="TestDrug 500mg", title="Brand")
    source = ClinicalDrugMonograph(id="source", inn="TestDrug", title="TESTDRUG", indications="VALID-INDICATION",
                                  adult_dosage="VALID-DOSE", dosage_forms=source_forms, source="verified source")
    class Db:
        async def execute(self, stmt):
            return Rows([blank]) if "blank" in stmt.compile().params.values() else Rows([source])
    drug = DavNationalDrug(id="test", national_code="test", brand_name="Brand", active_ingredient="TestDrug 500mg",
                           concentration="500mg", dosage_form="Viên nén", clinical_monograph_id="blank")
    response = asyncio.run(build_drug_profile_response([drug], Db(), SessionState("test", "test", "doctor"), query="Chỉ định và liều dùng Brand"))
    assert ("VALID-DOSE" in response.reply_text) is compatible
    if not compatible:
        assert response.source_status == "missing_clinical_evidence"
        assert response.rag_grounded is False


def test_blank_link_cannot_use_brand_title_when_source_ingredient_conflicts():
    blank = ClinicalDrugMonograph(id="blank", inn="TestDrug", title="Brand")
    wrong = ClinicalDrugMonograph(id="wrong", inn="OtherDrug", title="Brand", adult_dosage="WRONG-DRUG-DOSE",
                                 dosage_forms="Viên nén 500mg")
    class Db:
        async def execute(self, stmt):
            return Rows([blank]) if "blank" in stmt.compile().params.values() else Rows([wrong])
    drug = DavNationalDrug(id="test", national_code="test", brand_name="Brand", active_ingredient="TestDrug 500mg",
                           concentration="500mg", dosage_form="Viên nén", clinical_monograph_id="blank")
    response = asyncio.run(build_drug_profile_response([drug], Db(), SessionState("test", "test", "doctor"), query="Liều dùng Brand"))
    assert "WRONG-DRUG-DOSE" not in response.reply_text
    assert response.source_status == "missing_clinical_evidence"


@pytest.mark.parametrize("source_forms,dose,compatible", [
    ("Viên nén sủi bọt", "Liều uống: ORAL-DOSE. Đặt trực tràng: RECTAL-DOSE. Truyền tĩnh mạch: IV-DOSE.", False),
    ("Viên nén sủi bọt 500mg", "Liều uống: ORAL-DOSE. Đặt trực tràng: RECTAL-DOSE. Truyền tĩnh mạch: IV-DOSE.", False),
    ("Viên nén sủi bọt 500mg", "Truyền tĩnh mạch: IV-DOSE.", False),
    ("Viên nén sủi bọt 500mg", "Liều uống: ORAL-DOSE.", True),
])
def test_brand_link_with_clinical_content_requires_matching_presentation_and_dose_route(source_forms, dose, compatible):
    source = ClinicalDrugMonograph(id="linked", inn="Paracetamol 500mg", title="Efferalgan",
                                  dosage_forms=source_forms, adult_dosage=dose, contraindications="RECORDED-CONTRA",
                                  source="Dược thư Quốc gia Việt Nam, Trang 1118")
    class Db:
        async def execute(self, stmt): return Rows([source])
    drug = DavNationalDrug(id="test", national_code="test", brand_name="Efferalgan", active_ingredient="Paracetamol 500mg",
                           concentration="500mg", dosage_form="Viên nén sủi bọt", route="Đường uống", clinical_monograph_id="linked",
                           adult_dosage=dose)
    response = asyncio.run(build_drug_profile_response([drug], Db(), SessionState("test", "test", "doctor"),
                                                     query="Chỉ định và liều dùng Efferalgan"))
    assert ("ORAL-DOSE" in response.reply_text) is compatible
    assert "IV-DOSE" not in response.reply_text
    assert "RECTAL-DOSE" not in response.reply_text
    if not compatible:
        assert response.source_status == "unverified_product_specific_clinical_evidence"
        assert response.answer_type == "safe_abstention"
        assert response.rag_grounded is False
        assert response.confidence == 0
        assert response.citations == []


@pytest.mark.parametrize("query", ["Chỉ định và liều dùng Paracetamol", "thuốc này có liều dùng thế nào?"])
def test_generic_named_ingredient_monograph_and_its_followup_remain_available(query):
    source = ClinicalDrugMonograph(id="linked", inn="Paracetamol", title="Paracetamol",
                                  adult_dosage="Liều uống: ORAL-REFERENCE. Truyền tĩnh mạch: IV-REFERENCE.",
                                  indications="INGREDIENT-INDICATION", source="Dược thư Quốc gia Việt Nam, Trang 1118")
    class Db:
        async def execute(self, stmt): return Rows([source])
    drug = DavNationalDrug(id="test", national_code="test", brand_name="Paracetamol", active_ingredient="Paracetamol",
                           clinical_monograph_id="linked")
    response = asyncio.run(build_drug_profile_response([drug], Db(), SessionState("test", "test", "doctor"), query=query))
    assert "ORAL-REFERENCE" in response.reply_text
    assert response.answer_type != "safe_abstention"


@pytest.mark.parametrize("boundary", ["blank_link", "combination", "brand_presentation"])
def test_product_abstention_replaces_previous_drug_with_registration_identity_only(boundary):
    source = ClinicalDrugMonograph(id="linked", inn="TestDrug", title="TestDrug")
    ingredient = "TestDrug 500mg"
    if boundary != "blank_link":
        source.adult_dosage = "SOURCE-DOSE"
    if boundary == "combination":
        ingredient = "TestDrug; OtherDrug"
    class Db:
        async def execute(self, stmt): return Rows([source])
    drug = DavNationalDrug(id="new-product", national_code="NEW-SDK", brand_name="NewProduct", active_ingredient=ingredient,
                           concentration="500mg", dosage_form="Viên nén", route="Đường uống",
                           clinical_monograph_id=None if boundary == "combination" else "linked")
    session = SessionState("test", "test", "doctor")
    session.set_active_medication(name="PreviousDrug", ingredient="PreviousIngredient", batch="OLD-LOT",
                                  stock="OLD-STOCK", location="OLD-LOCATION", sdk="OLD-SDK")
    response = asyncio.run(build_drug_profile_response([drug], Db(), session, query="Chỉ định và liều dùng NewProduct"))
    assert response.answer_type == "safe_abstention"
    assert "SOURCE-DOSE" not in response.reply_text
    assert response.active_medication_name == "NewProduct"
    assert session.active_medication_name == "NewProduct"
    assert session.active_medication_ingredient == ingredient
    assert session.active_medication_sdk == "NEW-SDK"
    assert session.active_medication_batch is None
    assert session.active_medication_stock is None
    assert session.active_medication_location is None
    assert response.active_medication_stock is None
    assert response.active_medication_location is None
    assert response.active_patient_id is None
    assert response.rag_grounded is False
    assert response.confidence == 0


@pytest.mark.parametrize("query,patients,known", [
    ("Kiểm tra dị ứng đơn thuốc cho bệnh nhân Võ Minh Trí", [("BN-1", "Võ Minh Trí")], True),
    ("Kiểm tra dị ứng cho BN-1", [("BN-1", "Võ Minh Trí")], True),
    ("Kiểm tra dị ứng đơn thuốc cho bệnh nhân Trí", [("BN-1", "Võ Minh Trí")], False),
    ("Kiểm tra dị ứng đơn thuốc cho bệnh nhân Võ Minh Trí", [("BN-1", "Võ Minh Trí"), ("BN-2", "Võ Minh Trí")], False),
])
def test_patient_allergy_subject_is_exact_and_never_a_drug_search(query, patients, known):
    records = [PatientProfile(id=key, full_name=name, allergies="RECORDED-ALLERGY") for key, name in patients]
    class Db:
        async def execute(self, stmt):
            assert stmt.column_descriptions[0]["entity"] is PatientProfile, "Patient name must never become a registry-drug query"
            return Rows(records)
    session = SessionState("test", "test", "doctor")
    payload = CopilotQuery(query=query, user_name="test", user_role="doctor", session_id="test")
    response = asyncio.run(handle_copilot_chat(payload, SimpleNamespace(state=SimpleNamespace(authenticated_user=None)),
                                            Db(), session=session, history=""))
    assert ("RECORDED-ALLERGY" in response.reply_text) is known
    assert response.source_status == ("patient_record_only" if known else "missing_unique_patient_context")
    assert "Clarithromycin" not in response.reply_text
    assert response.rag_grounded is False
