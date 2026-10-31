"""
Clinical Knowledge Graph Layer (LightRAG & MedGraphRAG Pattern)
Biểu diễn quan hệ Dược chất <-> Tương tác DDI (QĐ 5948) <-> Chống chỉ định (<=100 LOC)
"""
from typing import Optional
from app.services.rag.ddi_graph_data import CLINICAL_DDI_GRAPH, CLINICAL_CONTRAINDICATION_GRAPH
from app.services.clinical_ddi_engine.drug_registry import DRUG_REGISTRY

def expand_clinical_graph(query: str, patient_info: Optional[dict] = None) -> dict:
    lower_query = query.lower()
    matched_inns: list[str] = []
    active_ddi_alerts: list[dict] = []
    contra_warnings: list[str] = []
    kg_entities: list[str] = []

    # Nhận diện hoạt chất từ INN và Brand Aliases (Hierarchical Entity Resolution)
    all_known_inns = set(list(CLINICAL_DDI_GRAPH.keys()) + list(CLINICAL_CONTRAINDICATION_GRAPH.keys()))
    for inn in all_known_inns:
        aliases = [inn]
        if inn in DRUG_REGISTRY:
            aliases.extend(DRUG_REGISTRY[inn].get("aliases", []))
        if any(a in lower_query for a in aliases):
            matched_inns.append(inn)
            kg_entities.append(f"INN:{inn.upper()}")

    # 1. Quét tương tác thuốc DDI từ câu truy vấn
    for inn in matched_inns:
        ddi_list = CLINICAL_DDI_GRAPH.get(inn, [])
        for ddi in ddi_list:
            if any(p in lower_query for p in ddi["partner_names"]):
                active_ddi_alerts.append({
                    "drug_a": inn.capitalize(),
                    "drug_b": ddi["partner"].capitalize(),
                    "severity": ddi["severity"],
                    "mechanism": ddi["mechanism"],
                    "consequence": ddi["consequence"]
                })
                kg_entities.append(f"DDI:{inn.upper()}<->{ddi['partner'].upper()}")

    # 2. Quét chống chỉ định & cảnh báo cơ quan
    for inn in matched_inns:
        contra = CLINICAL_CONTRAINDICATION_GRAPH.get(inn)
        if contra:
            for r in contra["organ_risks"]:
                if r in lower_query:
                    contra_warnings.append(f"CẢNH BÁO {inn.upper()}: Nguy cơ cao khi có {r}.")
                    kg_entities.append(f"RISK:{inn.upper()}+{r}")

    # 3. Kết nối bệnh nền nếu có patient_info
    if patient_info:
        egfr = patient_info.get("egfr")
        allergies = [a.lower() for a in patient_info.get("allergies", [])]
        for inn in matched_inns:
            contra = CLINICAL_CONTRAINDICATION_GRAPH.get(inn)
            is_allergic = any(a in inn or inn in a for a in allergies)
            if not is_allergic and contra:
                is_allergic = any(any(a in r for a in allergies) for r in contra.get("organ_risks", []))

            if is_allergic:
                contra_warnings.append(f"BÁO ĐỘNG ĐỎ: Bệnh nhân có tiền sử dị ứng với {inn.upper()}!")
                kg_entities.append(f"PATIENT_ALLERGY:{inn.upper()}")
            if egfr is not None and egfr < 30:
                if contra and contra.get("renal_rule"):
                    contra_warnings.append(f"HIỆU CHỈNH THẬN (eGFR={egfr}): {contra['renal_rule']}")
                    kg_entities.append(f"RENAL_RISK:{inn.upper()}")

    return {
        "matched_inns": list(dict.fromkeys(matched_inns)),
        "active_ddi_alerts": active_ddi_alerts,
        "contra_warnings": contra_warnings,
        "kg_entities": list(dict.fromkeys(kg_entities))
    }
