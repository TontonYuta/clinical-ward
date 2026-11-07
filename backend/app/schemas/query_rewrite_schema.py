"""
Pydantic Schema cho CRAG Query Rewriter & Google AMIE Context Buffer.
Paper: Corrective Retrieval Augmented Generation (CRAG - Yan et al., 2024 / arXiv:2401.15884)
Paper: Google AMIE (Tu et al., 2024 - Nature / arXiv:2401.05654)
"""
from typing import Optional, List
from pydantic import BaseModel, Field

class ClinicalRewriteResult(BaseModel):
    """Kết quả phân giải ngữ cảnh và chuẩn hóa câu truy vấn lâm sàng (CRAG Pattern)."""
    original_query: str = Field(description="Câu hỏi gốc của người dùng")
    rewritten_query: str = Field(description="Câu truy vấn lâm sàng hoàn chỉnh, độc lập ngữ cảnh")
    is_continuation: bool = Field(default=False, description="Có phải câu hỏi tiếp nối ngữ cảnh trước không")
    detected_drug_entities: List[str] = Field(default_factory=list, description="Danh sách thuốc/hoạt chất được kế thừa hoặc nhận diện")
    detected_intent: Optional[str] = Field(default=None, description="Ý định lâm sàng dự kiến")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Độ tin cậy của việc chuẩn hóa (0.0 - 1.0)")
    latency_ms: float = Field(default=0.0, description="Thời gian thực thi chuẩn hóa (milliseconds)")
    fallback_used: bool = Field(default=False, description="Có phải dùng fallback an toàn khi LLM timeout không")
