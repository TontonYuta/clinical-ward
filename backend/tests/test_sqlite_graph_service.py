"""
Unit Tests for SQLite LightRAG Graph Traversal Service (Technique 8).
Paper: LightRAG (Guo et al., 2024 / arXiv:2410.05772)
"""
import pytest
from app.services.rag.sqlite_graph_service import ClinicalGraphTraversalService

def test_k_hop_bfs_traversal():
    """Kiểm tra thuật toán K-hop BFS duyệt từ hoạt chất sang nhóm dược lý."""
    res = ClinicalGraphTraversalService.traverse_k_hop_neighborhood(["simvastatin"], max_hops=1)
    assert res["visited_count"] >= 1
    assert "STATIN" in res["discovered_classes"]
    assert "simvastatin" in res["hop_distribution"][0]

def test_cyp_metabolic_exception_pravastatin():
    """Kiểm tra ngoại lệ lâm sàng: Pravastatin không bị chuyển hóa qua CYP3A4."""
    # 1. Pravastatin -> Ngoại lệ an toàn, sulfat hóa
    exception_info = ClinicalGraphTraversalService.check_metabolic_exception("Pravastatin 20mg", "MACROLID")
    assert exception_info is not None
    assert exception_info["is_contraindicated"] is False
    assert "sulfat" in exception_info["mechanism"].lower()

    # 2. Simvastatin -> Không có ngoại lệ (chống chỉ định nghiêm ngặt)
    normal_info = ClinicalGraphTraversalService.check_metabolic_exception("Simvastatin 10mg", "MACROLID")
    assert normal_info is None
