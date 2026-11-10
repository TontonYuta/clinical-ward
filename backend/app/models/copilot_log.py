"""Model lưu vết lịch sử hội thoại Copilot để phân tích cải thiện chatbot (<=40 LOC)."""
from datetime import datetime
from sqlalchemy import String, Text, DateTime, Float, Boolean, Integer, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class CopilotChatLog(Base):
    __tablename__ = "copilot_chat_logs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    session_id: Mapped[str] = mapped_column(String(128), index=True)
    user_name: Mapped[str] = mapped_column(String(128), default="Nhân viên y tế")
    user_role: Mapped[str] = mapped_column(String(64), default="nurse")
    query: Mapped[str] = mapped_column(Text, nullable=False)
    reply_text: Mapped[str] = mapped_column(Text, nullable=False)
    intent: Mapped[str | None] = mapped_column(String(64), nullable=True)
    answer_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    utility_score: Mapped[float | None] = mapped_column(Float, nullable=True, default=0.5)
    is_useful: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    quality_category: Mapped[str | None] = mapped_column(String(64), nullable=True, default="high_value_clinical")
    grounded_source: Mapped[str | None] = mapped_column(String(256), nullable=True)
    prompt_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=True)
    completion_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=True)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=True)
    model_name: Mapped[str | None] = mapped_column(String(64), nullable=True, default="gemini-3.5-flash-lite")
    provider: Mapped[str | None] = mapped_column(String(64), nullable=True, default="gemini")
    has_image: Mapped[bool] = mapped_column(Boolean, default=False, nullable=True)
    image_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=True)
    latency_ms: Mapped[float] = mapped_column(Float, default=85.0, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), index=True)
