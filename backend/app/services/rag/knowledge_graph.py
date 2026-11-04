"""
Clinical Knowledge Graph Layer (LightRAG & MedGraphRAG Pattern)
Biểu diễn quan hệ Dược chất <-> Tương tác DDI (QĐ 5948) <-> Chống chỉ định & Nhóm Dược lý Đa Tầng
Căn cứ: LightRAG (arXiv:2410.05779, HKUDS) & Dược thư Quốc gia Việt Nam (DĐVN V)
"""
from typing import Optional, List, Dict, Any
from app.services.rag.ddi_graph_data import CLINICAL_DDI_GRAPH, CLINICAL_CONTRAINDICATION_GRAPH
from app.services.clinical_ddi_engine.drug_registry import DRUG_REGISTRY
from app.services.rag.lightrag_data import (
    PHARMACOLOGICAL_CLASS_TAXONOMY,
    CLASS_INTERACTION_GRAPH,
    ORGAN_CONDITION_HIERARCHY,
    THERAPEUTIC_ALTERNATIVE_MAP
)

def expand_clinical_graph(query: str, patient_info: Optional[dict] = None) -> dict:
    """
    LightRAG Dual-Level Clinical Knowledge Graph Traversal:
    1. Low-Level Subgraph: Định vị chính xác thực thể nguyên tử (Tên thuốc, INN, SĐK).
    2. High-Level Subgraph: Định vị nhóm dược lý ATC, cơ chế tương tác nhóm, cảnh báo bệnh nền & phác đồ thay thế.
    """
    lower_query = query.lower()
    matched_inns: list[str] = []
    active_ddi_alerts: list[dict] = []
    contra_warnings: list[str] = []
    kg_entities: list[str] = []

    # --------------------------------------------------------------------------
    # 1. LOW-LEVEL SUBGRAPH: Nhận diện hoạt chất từ INN và Brand Aliases
    # --------------------------------------------------------------------------
    all_known_inns = set(list(CLINICAL_DDI_GRAPH.keys()) + list(CLINICAL_CONTRAINDICATION_GRAPH.keys()) + list(DRUG_REGISTRY.keys()))
    for inn in all_known_inns:
        aliases = [inn]
        if inn in DRUG_REGISTRY:
            aliases.extend(DRUG_REGISTRY[inn].get("aliases", []))
        if any(a in lower_query for a in aliases):
            matched_inns.append(inn)
            kg_entities.append(f"INN:{inn.upper()}")

    # Đối soát tương tác từng cặp thực thể cụ thể (QĐ 5948)
    for inn, ddi_list in CLINICAL_DDI_GRAPH.items():
        if inn not in matched_inns:
            continue
        for ddi in ddi_list:
            partner_aliases = set(ddi["partner_names"])
            for registry_key, registry_entry in DRUG_REGISTRY.items():
                registry_aliases = [registry_key, *registry_entry.get("aliases", [])]
                if any(alias in partner_aliases for alias in registry_aliases):
                    partner_aliases.update(registry_aliases)
            if any(alias in lower_query for alias in partner_aliases):
                partner = ddi["partner"]
                kg_entities.append(f"DDI:{inn.upper()}<->{partner.upper()}")
                active_ddi_alerts.append({
                    "drug_a": inn.capitalize(),
                    "drug_b": partner.capitalize(),
                    "severity": ddi["severity"],
                    "mechanism": ddi["mechanism"],
                    "consequence": ddi["consequence"]
                })

    # Quét chống chỉ định & cảnh báo cơ quan trực tiếp từ thực thể
    for inn in matched_inns:
        contra = CLINICAL_CONTRAINDICATION_GRAPH.get(inn)
        if contra:
            for r in contra["organ_risks"]:
                if r in lower_query:
                    contra_warnings.append(f"CẢNH BÁO {inn.upper()}: Nguy cơ cao khi có {r}.")
                    kg_entities.append(f"RISK:{inn.upper()}+{r}")

    # Kết nối bệnh nền nếu có patient_info
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

    # --------------------------------------------------------------------------
    # 2. HIGH-LEVEL SUBGRAPH: Nhận diện Nhóm Dược lý ATC & Phân loại Lâm sàng
    # --------------------------------------------------------------------------
    high_level_classes: list[str] = []
    low_level_entities: list[str] = [DRUG_REGISTRY.get(inn, {}).get("display", inn.capitalize()) for inn in matched_inns]

    for c_key, c_info in PHARMACOLOGICAL_CLASS_TAXONOMY.items():
        has_class_kw = any(kw in lower_query for kw in c_info["keywords"])
        has_member = any(m in matched_inns for m in c_info["members"])
        if has_class_kw or has_member:
            high_level_classes.append(c_key)
            kg_entities.append(f"CLASS:{c_key}")

    high_level_classes = list(dict.fromkeys(high_level_classes))

    # Tương tác nhóm dược lý vĩ mô (Class-to-Class Interactions)
    class_interactions: list[dict] = []
    for c_ddi in CLASS_INTERACTION_GRAPH:
        ca, cb = c_ddi["class_a"], c_ddi["class_b"]
        if ca in high_level_classes and cb in high_level_classes:
            kg_entities.append(f"CLASS_DDI:{ca}<->{cb}")
            class_interactions.append({
                "class_a": PHARMACOLOGICAL_CLASS_TAXONOMY.get(ca, {}).get("name_vi", ca),
                "class_b": PHARMACOLOGICAL_CLASS_TAXONOMY.get(cb, {}).get("name_vi", cb),
                "severity": c_ddi["severity"],
                "mechanism": c_ddi["mechanism"],
                "consequence": c_ddi["consequence"],
                "management": c_ddi["management"]
            })

    # Rà soát Rủi ro Bệnh nền & Hệ cơ quan (Organ & Condition Hierarchy)
    organ_condition_risks: list[dict] = []
    for cond_key, cond_info in ORGAN_CONDITION_HIERARCHY.items():
        if any(kw in lower_query for kw in cond_info["keywords"]):
            kg_entities.append(f"CONDITION:{cond_key}")
            organ_condition_risks.append({
                "condition": cond_info["title"],
                "rules": cond_info["critical_rules"]
            })

    # Khuyến cáo Lựa chọn Thay thế An toàn (Therapeutic Substitutions)
    therapeutic_alternatives: list[dict] = []
    def _matches_trigger(spec: Any, text: str) -> bool:
        if isinstance(spec, str):
            return spec in text
        if isinstance(spec, (list, tuple, set)):
            return all(item in text for item in spec)
        return False

    for alt_key, alt_info in THERAPEUTIC_ALTERNATIVE_MAP.items():
        if any(_matches_trigger(trig, lower_query) for trig in alt_info["trigger"]):
            kg_entities.append(f"SUBST:{alt_info['target_class']}->{alt_key}")
            therapeutic_alternatives.append({
                "target_class": alt_info["target_class"],
                "alternative_class": alt_info["alternative_class"],
                "recommendation": alt_info["recommendation"]
            })

    # --------------------------------------------------------------------------
    # 3. GRAPH CONTEXT FUSION: Đóng gói khối ngữ cảnh Đồ thị Tri thức Đa Tầng
    # --------------------------------------------------------------------------
    context_sections: list[str] = []
    if low_level_entities or high_level_classes:
        ents_str = ", ".join(low_level_entities) if low_level_entities else "Chưa định danh thuốc đơn lẻ"
        classes_str = ", ".join([PHARMACOLOGICAL_CLASS_TAXONOMY.get(c, {}).get("name_vi", c) for c in high_level_classes]) if high_level_classes else "Tra cứu chung"
        context_sections.append(
            f"• **Thực thể Dược phẩm (Low-Level Entities):** {ents_str}\n"
            f"• **Phân loại Dược lý & Nhóm ATC (High-Level Classes):** {classes_str}"
        )

    if class_interactions:
        lines = []
        for ci in class_interactions:
            lines.append(
                f"- **CẢNH BÁO TƯƠNG TÁC NHÓM ({ci['severity']}):** {ci['class_a']} + {ci['class_b']}\n"
                f"  * Cơ chế: {ci['mechanism']}\n"
                f"  * Hậu quả lâm sàng: {ci['consequence']}\n"
                f"  * Hướng xử trí: {ci['management']}"
            )
        context_sections.append("### ⚡ Tương Tác Nhóm Dược Lý (LightRAG High-Level Traversal):\n" + "\n".join(lines))

    if organ_condition_risks:
        lines = []
        for oc in organ_condition_risks:
            rules_str = "\n".join([f"  * {r}" for r in oc["rules"]])
            lines.append(f"- **RỦI RO BỆNH NỀN / CƠ QUAN ({oc['condition']}):**\n{rules_str}")
        context_sections.append("### 🛑 Cảnh Báo An Toàn Bệnh Nền & Cơ Quan:\n" + "\n".join(lines))

    if therapeutic_alternatives:
        lines = []
        for ta in therapeutic_alternatives:
            lines.append(
                f"- **LỰA CHỌN THAY THẾ AN TOÀN:** Chuyển đổi sang **{ta['alternative_class']}**\n"
                f"  {ta['recommendation']}"
            )
        context_sections.append("### 💡 Khuyến Cáo Thay Thế Dược Lâm Sàng (Therapeutic Alternatives):\n" + "\n".join(lines))

    graph_context_text = "\n\n".join(context_sections)

    return {
        "matched_inns": list(dict.fromkeys(matched_inns)),
        "active_ddi_alerts": active_ddi_alerts,
        "contra_warnings": contra_warnings,
        "kg_entities": list(dict.fromkeys(kg_entities)),
        "low_level_entities": low_level_entities,
        "high_level_classes": high_level_classes,
        "class_interactions": class_interactions,
        "organ_condition_risks": organ_condition_risks,
        "therapeutic_alternatives": therapeutic_alternatives,
        "graph_context_text": graph_context_text
    }
