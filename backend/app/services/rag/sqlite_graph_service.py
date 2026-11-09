"""
SQLite LightRAG Graph Traversal & Clinical Subgraph Service (Chuẩn LightRAG: Section 3.2).
Paper: LightRAG: Simple and Fast Retrieval-Augmented Generation (Guo et al., 2024 / arXiv:2410.05779).
Duyệt K-hop BFS trên Đồ thị Tri thức Dược lâm sàng:
1. Node Thuốc -> Nhóm Dược lý ATC (Hop 0 -> Hop 1).
2. Nhóm Dược lý -> Cạnh Tương tác Nhóm Đối ứng (Hop 1 -> Hop 2).
3. Nhóm Tương tác -> Thuốc Láng giềng & Ngoại lệ Chuyển hóa Gan CYP.
"""
from typing import List, Dict, Set, Optional, Any
from app.services.rag.lightrag_data import (
    PHARMACOLOGICAL_CLASS_TAXONOMY,
    CLASS_INTERACTION_GRAPH,
    THERAPEUTIC_ALTERNATIVE_MAP,
    ORGAN_CONDITION_HIERARCHY
)

# Danh mục ngoại lệ chuyển hóa enzym gan lâm sàng (CYP Metabolic Exceptions)
CYP_METABOLIC_EXCEPTIONS = {
    "pravastatin": {
        "inhibitor_class": "MACROLID",
        "is_contraindicated": False,
        "mechanism": "Pravastatin chuyển hóa chủ yếu qua quá trình sulfat hóa ở gan, KHÔNG phụ thuộc enzym CYP3A4.",
        "clinical_advice": "Có thể cân nhắc phối hợp Pravastatin với Clarithromycin/Erythromycin nếu bắt buộc điều trị statin, nhưng cần theo dõi đau cơ."
    },
    "rosuvastatin": {
        "inhibitor_class": "MACROLID",
        "is_contraindicated": False,
        "mechanism": "Rosuvastatin chuyển hóa tối thiểu (khoảng 10%) qua CYP2C9, chuyển hóa qua CYP3A4 không đáng kể.",
        "clinical_advice": "Nguy cơ ức chế qua CYP3A4 thấp hơn Simvastatin/Atorvastatin, nhưng cần dùng liều khởi đầu thấp (5-10mg)."
    }
}

class ClinicalGraphTraversalService:
    """Dịch vụ duyệt đồ thị tri thức K-hop BFS theo chuẩn LightRAG."""

    @staticmethod
    def traverse_k_hop_neighborhood(start_entities: List[str], max_hops: int = 2) -> Dict[str, Any]:
        """Thuật toán BFS duyệt lân cận K-hop từ các thực thể thuốc xuất phát."""
        visited_nodes: Set[str] = set()
        queue: List[tuple[str, int]] = [(e.lower(), 0) for e in start_entities]
        hop_entities: Dict[int, List[str]] = {0: [], 1: [], 2: []}
        discovered_classes: Set[str] = set()

        while queue:
            node, hop = queue.pop(0)
            if node in visited_nodes or hop > max_hops:
                continue
            visited_nodes.add(node)
            hop_entities[hop].append(node)

            # Hop 1: Mở rộng sang nhóm dược lý ATC
            if hop < max_hops:
                for c_key, c_info in PHARMACOLOGICAL_CLASS_TAXONOMY.items():
                    if node in c_info.get("members", []) or any(node in kw for kw in c_info.get("keywords", [])):
                        discovered_classes.add(c_key)
                        if c_key.lower() not in visited_nodes:
                            queue.append((c_key.lower(), hop + 1))

        return {
            "start_entities": start_entities,
            "visited_count": len(visited_nodes),
            "discovered_classes": list(discovered_classes),
            "hop_distribution": hop_entities
        }

    @staticmethod
    def check_metabolic_exception(drug_name: str, inhibitor_class: str = "MACROLID") -> Optional[Dict[str, Any]]:
        """Phát hiện ngoại lệ chuyển hóa lâm sàng cho từng cá thể dược chất (ví dụ Pravastatin kỵ CYP3A4)."""
        clean_name = drug_name.lower().strip()
        for exception_drug, info in CYP_METABOLIC_EXCEPTIONS.items():
            if exception_drug in clean_name:
                if info["inhibitor_class"].upper() == inhibitor_class.upper():
                    return info
        return None

    @classmethod
    def traverse_clinical_subgraph(
        cls,
        start_drugs: List[str],
        condition_terms: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Duyệt toàn diện Subgraph lâm sàng phục vụ LightRAG Retrieval:
        1. Nhận diện các nhóm ATC của start_drugs.
        2. Duyệt 1-hop theo các cạnh tương tác nhóm trong CLASS_INTERACTION_GRAPH.
        3. Rà soát ngoại lệ enzym gan CYP.
        4. Trích xuất khuyến cáo thay thế tương ứng.
        """
        condition_terms = condition_terms or []
        bfs_res = cls.traverse_k_hop_neighborhood(start_drugs, max_hops=2)
        discovered_classes = set(bfs_res["discovered_classes"])

        active_class_ddis: List[Dict[str, Any]] = []
        neighbor_interacting_drugs: Dict[str, List[str]] = {}
        metabolic_notes: List[Dict[str, Any]] = []

        # Rà soát cạnh tương tác giữa các nhóm đã phát hiện
        for c_ddi in CLASS_INTERACTION_GRAPH:
            ca, cb = c_ddi["class_a"], c_ddi["class_b"]
            if ca in discovered_classes and cb in discovered_classes:
                active_class_ddis.append({
                    "class_a": ca,
                    "class_b": cb,
                    "severity": c_ddi["severity"],
                    "mechanism": c_ddi["mechanism"],
                    "consequence": c_ddi["consequence"],
                    "management": c_ddi["management"]
                })
            elif ca in discovered_classes or cb in discovered_classes:
                # 1-Hop Neighbor Traversal: Lưu các nhóm có thể tương tác đối ứng
                partner_class = cb if ca in discovered_classes else ca
                members = PHARMACOLOGICAL_CLASS_TAXONOMY.get(partner_class, {}).get("members", [])
                if members:
                    neighbor_interacting_drugs[partner_class] = members[:5]

        # Kiểm tra ngoại lệ chuyển hóa enzym gan
        for drug in start_drugs:
            for inh_cls in ["MACROLID"]:
                exc = cls.check_metabolic_exception(drug, inhibitor_class=inh_cls)
                if exc:
                    metabolic_notes.append({
                        "drug": drug,
                        "exception": exc
                    })

        # Xây dựng văn bản tóm tắt đồ thị (Subgraph Narrative Context)
        subgraph_lines = []
        if active_class_ddis:
            subgraph_lines.append("### ⚡ TƯƠNG TÁC NHÓM DƯỢC LÝ ĐỒ THỊ (LightRAG Class DDI):")
            for item in active_class_ddis:
                subgraph_lines.append(
                    f"- **{item['class_a']} + {item['class_b']}** ({item['severity']}):\n"
                    f"  * Cơ chế: {item['mechanism']}\n"
                    f"  * Hậu quả: {item['consequence']}\n"
                    f"  * Hướng xử trí: {item['management']}"
                )

        if metabolic_notes:
            subgraph_lines.append("### 🔬 NGOẠI LỆ CHUYỂN HÓA ENZYM GAN (Metabolic Exceptions):")
            for note in metabolic_notes:
                exc = note["exception"]
                subgraph_lines.append(
                    f"- **{note['drug'].capitalize()}**: {exc['mechanism']}\n"
                    f"  * Khuyến cáo lâm sàng: {exc['clinical_advice']}"
                )

        return {
            "start_drugs": start_drugs,
            "discovered_classes": list(discovered_classes),
            "active_class_ddis": active_class_ddis,
            "neighbor_interacting_drugs": neighbor_interacting_drugs,
            "metabolic_notes": metabolic_notes,
            "subgraph_narrative": "\n\n".join(subgraph_lines)
        }
