"""
SQLite LightRAG Graph Traversal & Clinical Subgraph Service (Kỹ thuật 8).
Paper: LightRAG: Simple and Fast Retrieval-Augmented Generation (Guo et al., 2024 / arXiv:2410.05772)
Duyệt K-hop BFS trên Đồ thị Tri thức Dược lâm sàng, nhận diện tương tác nhóm ATC và xử lý ngoại lệ chuyển hóa.
"""
from typing import List, Dict, Set, Optional, Any
from app.services.rag.lightrag_data import (
    PHARMACOLOGICAL_CLASS_TAXONOMY,
    CLASS_INTERACTION_GRAPH,
    THERAPEUTIC_ALTERNATIVE_MAP
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
