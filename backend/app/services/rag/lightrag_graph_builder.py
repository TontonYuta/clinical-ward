"""
LightRAG Dual-Level Clinical Knowledge Graph Chunk Builder.
Paper: LightRAG: Simple and Fast Retrieval-Augmented Generation (HKUDS, arXiv:2410.05779).
Converts high-level taxonomy, class interactions, organ risks, and therapeutic substitutions
into normalized RagChunk instances for dual-level dense-sparse hybrid retrieval.
"""
from typing import List
from app.services.rag.types import RagChunk
from app.services.rag.lightrag_data import (
    PHARMACOLOGICAL_CLASS_TAXONOMY,
    CLASS_INTERACTION_GRAPH,
    ORGAN_CONDITION_HIERARCHY,
    THERAPEUTIC_ALTERNATIVE_MAP
)


def build_lightrag_graph_chunks() -> List[RagChunk]:
    """
    Trích xuất toàn bộ tri thức Đồ thị Đa Tầng LightRAG thành các RagChunk chuẩn.
    Bao gồm 4 nhóm tri thức vĩ mô:
    1. Nhóm Dược Lý & Phân loại ATC (13 nhóm thuốc cốt lõi)
    2. Ma trận Tương tác Nhóm Dược lý Vĩ mô (Class-to-Class DDI)
    3. Phân tầng Bệnh nền & Rủi ro Cơ quan (Organ & Condition Hierarchy)
    4. Khuyến cáo Lựa chọn Thay thế An toàn (Therapeutic Substitutions)
    """
    graph_chunks: List[RagChunk] = []

    # =========================================================================
    # 1. NHÓM DƯỢC LÝ & PHÂN LOẠI ATC (High-Level Pharmacological Taxonomy)
    # =========================================================================
    for class_key, info in PHARMACOLOGICAL_CLASS_TAXONOMY.items():
        name_vi = info.get("name_vi", class_key)
        atc_prefix = info.get("atc_prefix", "")
        keywords = list(info.get("keywords", []))
        members = list(info.get("members", []))
        mechanism = info.get("mechanism", "")
        
        extra_info = []
        if "primary_metabolism" in info:
            extra_info.append(f"• **Con đường chuyển hóa chính:** {info['primary_metabolism']}")
        if "cyp_inhibition" in info:
            extra_info.append(f"• **Tác động men gan CYP & P-gp:** {info['cyp_inhibition']}")
        if "adverse_effects" in info:
            extra_info.append(f"• **Tác dụng không mong muốn đặc trưng:** {info['adverse_effects']}")
        if "contraindications" in info:
            extra_info.append(f"• **Chống chỉ định quan trọng:** {info['contraindications']}")
        if "cautions" in info:
            extra_info.append(f"• **Thận trọng đặc biệt:** {info['cautions']}")
        if "features" in info:
            extra_info.append(f"• **Đặc điểm dược lý lâm sàng:** {info['features']}")

        extra_text = "\n".join(extra_info)
        members_str = ", ".join(members)

        content = (
            f"### Phân Loại Dược Lý: {name_vi} (Mã ATC: {atc_prefix})\n\n"
            f"• **Các hoạt chất tiêu biểu trong nhóm:** {members_str}\n"
            f"• **Cơ chế tác dụng dược lý:** {mechanism}\n"
            f"{extra_text}\n\n"
            f"**Căn cứ pháp lý & Chuẩn chuyên môn:** Dược thư Quốc gia Việt Nam (DĐVN V) & Phân loại Giải phẫu - Điều trị - Hóa học (WHO ATC Index)."
        )

        all_kws = sorted(list(set(keywords + members + [class_key.lower(), "nhóm thuốc", "dược lý"])))
        graph_chunks.append(RagChunk(
            chunk_id=f"lightrag_class_{class_key.lower()}",
            source_doc=f"Đồ Thị Tri Thức Dược Lý: {name_vi}",
            legal_basis="WHO ATC Index & Dược Thư Quốc Gia Việt Nam",
            page_or_section=f"Nhóm {class_key}",
            title=f"Phân loại Dược lý: {name_vi}",
            content=content,
            keywords=all_kws,
            entity_type="graph_class"
        ))

    # =========================================================================
    # 2. MA TRẬN TƯƠNG TÁC NHÓM DƯỢC LÝ VĨ MÔ (Class Interaction Graph)
    # =========================================================================
    for idx, c_ddi in enumerate(CLASS_INTERACTION_GRAPH):
        ca, cb = c_ddi["class_a"], c_ddi["class_b"]
        name_a = PHARMACOLOGICAL_CLASS_TAXONOMY.get(ca, {}).get("name_vi", ca)
        name_b = PHARMACOLOGICAL_CLASS_TAXONOMY.get(cb, {}).get("name_vi", cb)
        severity = c_ddi.get("severity", "Chống chỉ định phối hợp")
        mechanism = c_ddi.get("mechanism", "")
        consequence = c_ddi.get("consequence", "")
        management = c_ddi.get("management", "")

        content = (
            f"### Cảnh Báo Tương Tác Nhóm Dược Lý: {name_a} + {name_b}\n\n"
            f"• **Mức độ tương tác:** **{severity}**\n"
            f"• **Cơ chế tương tác dược lý:** {mechanism}\n"
            f"• **Hậu quả lâm sàng nghiêm trọng:** {consequence}\n"
            f"• **Hướng dẫn xử trí & Phác đồ thay thế:** {management}\n\n"
            f"**Căn cứ pháp lý:** Quyết định 5948/QĐ-BYT (Danh mục tương tác thuốc chống chỉ định trong thực hành lâm sàng)."
        )

        kws_a = PHARMACOLOGICAL_CLASS_TAXONOMY.get(ca, {}).get("keywords", [])
        kws_b = PHARMACOLOGICAL_CLASS_TAXONOMY.get(cb, {}).get("keywords", [])
        combined_kws = sorted(list(set(
            kws_a + kws_b + [ca.lower(), cb.lower(), "tương tác nhóm", "chống chỉ định phối hợp", "5948"]
        )))

        graph_chunks.append(RagChunk(
            chunk_id=f"lightrag_class_ddi_{ca.lower()}_{cb.lower()}",
            source_doc=f"Tương tác nhóm: {name_a} + {name_b}",
            legal_basis="Quyết định 5948/QĐ-BYT",
            page_or_section=f"{ca} + {cb}",
            title=f"Tương tác nhóm: {name_a} + {name_b}",
            content=content,
            keywords=combined_kws,
            entity_type="graph_class_ddi"
        ))

    # =========================================================================
    # 3. PHÂN TẦNG BỆNH NỀN & NGUY CƠ TỔN THƯƠNG TẠNG (Organ & Condition Hierarchy)
    # =========================================================================
    for cond_key, cond_info in ORGAN_CONDITION_HIERARCHY.items():
        title = cond_info.get("title", cond_key)
        keywords = list(cond_info.get("keywords", []))
        rules = list(cond_info.get("critical_rules", []))
        rules_text = "\n".join([f"• {r}" for r in rules])

        content = (
            f"### Cảnh Báo An Toàn & Hướng Dẫn Sử Dụng Thuốc: {title}\n\n"
            f"**Các nguyên tắc an toàn dùng thuốc cốt lõi:**\n"
            f"{rules_text}\n\n"
            f"**Căn cứ chuyên môn:** Hướng dẫn điều trị KDIGO 2024, ESC/AHA và Dược thư Quốc gia Việt Nam."
        )

        all_kws = sorted(list(set(keywords + [cond_key.lower(), "bệnh nền", "nguy cơ cơ quan", "an toàn điều trị"])))
        graph_chunks.append(RagChunk(
            chunk_id=f"lightrag_organ_risk_{cond_key.lower()}",
            source_doc=f"An toàn bệnh nền: {title}",
            legal_basis="KDIGO 2024 & Dược Thư Quốc Gia Việt Nam",
            page_or_section=f"Nguy cơ {cond_key}",
            title=f"An toàn bệnh nền: {title}",
            content=content,
            keywords=all_kws,
            entity_type="graph_condition_risk"
        ))

    # =========================================================================
    # 4. KHUYẾN CÁO LỰA CHỌN THAY THẾ AN TOÀN (Therapeutic Substitutions)
    # =========================================================================
    for alt_key, alt_info in THERAPEUTIC_ALTERNATIVE_MAP.items():
        target_class = alt_info.get("target_class", "")
        alt_class = alt_info.get("alternative_class", "")
        recommendation = alt_info.get("recommendation", "")
        triggers = alt_info.get("trigger", [])

        trigger_words = []
        for t in triggers:
            if isinstance(t, str):
                trigger_words.append(t)
            elif isinstance(t, (list, tuple)):
                trigger_words.extend(list(t))

        content = (
            f"### Khuyến Cáo Thay Thế Dược Lâm Sàng: {target_class} -> {alt_class}\n\n"
            f"• **Tình huống lâm sàng:** Bệnh nhân gặp tác dụng phụ, tương tác hoặc chống chỉ định với nhóm **{target_class}**.\n"
            f"• **Lựa chọn thay thế tối ưu:** Chuyển đổi sang nhóm **{alt_class}**.\n"
            f"• **Căn cứ và hướng dẫn thực hành:**\n"
            f"{recommendation}\n\n"
            f"**Căn cứ:** Hướng dẫn Dược lý Lâm sàng Bộ Y tế & Thực hành điều trị tim mạch/nội tiết chuyên khoa."
        )

        all_kws = sorted(list(set(
            trigger_words + [alt_key.lower(), target_class.lower(), "thay thế an toàn", "chuyển đổi thuốc"]
        )))

        graph_chunks.append(RagChunk(
            chunk_id=f"lightrag_therapeutic_subst_{alt_key.lower()}",
            source_doc=f"Thay thế lâm sàng: {target_class} -> {alt_class}",
            legal_basis="Hướng dẫn Dược lâm sàng Bộ Y tế",
            page_or_section=f"Thay thế {alt_key}",
            title=f"Khuyến cáo thay thế: {target_class} -> {alt_class}",
            content=content,
            keywords=all_kws,
            entity_type="graph_substitution"
        ))

    return graph_chunks
