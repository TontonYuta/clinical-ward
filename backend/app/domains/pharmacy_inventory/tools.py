from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import or_, select
from app.schemas.copilot import CopilotActionCard, CopilotResponse
from app.domains.pharmacy_inventory.service import PharmacyInventoryService
from app.models.inventory import InventoryBatch

class PharmacyInventoryTools:
    def __init__(self, service: PharmacyInventoryService | None = None):
        self.service = service or PharmacyInventoryService()

    async def execute_fefo(self, db: AsyncSession, threshold_days: int = 60) -> CopilotResponse:
        candidates = await self.service.get_fefo_candidates(db)
        batches = [row for row in candidates if row.current_stock is not None and row.expiry_date is not None and row.days_left is not None and row.days_left <= threshold_days]
        items = [{"name": r.item_name, "batch": r.batch_number, "expiry": r.expiry_date, "stock": r.current_stock, "unit": r.unit, "location": r.warehouse_location} for r in batches]
        evidence = [self._batch_evidence(r) for r in batches]
        lines = [f"• **{r.item_name}** (lô {r.batch_number}) - Hạn dùng: {r.expiry_date} - Tồn: {r.current_stock} {r.unit} tại {r.warehouse_location}" for r in batches]
        text = "\n".join(lines) if lines else "Không tìm thấy lô có đủ dữ liệu để lập danh sách FEFO."
        return CopilotResponse(intent="CHECK_EXPIRY_FEFO", answer_type="operational_result", reply_text=f"### Danh sách lô theo hạn dùng\n\n{text}", card=CopilotActionCard(card_type="fefo_report", title="Lô thuốc theo hạn dùng", summary=f"Số lô có dữ liệu: {len(items)}", data={"batches": items, "total": len(items)}, target_tab="inventory"), source_status="database_record", evidence=evidence, citations=[self._batch_citation(r) for r in batches])

    async def execute_restock(self, db: AsyncSession) -> CopilotResponse:
        result = await db.execute(select(InventoryBatch).where(or_(InventoryBatch.is_low_stock.is_(True), InventoryBatch.current_stock <= InventoryBatch.min_threshold)).order_by(InventoryBatch.item_name, InventoryBatch.batch_number))
        rows = result.scalars().all()
        items = []
        lines = []
        evidence = []
        citations = []
        for row in rows:
            suggested = max(row.max_threshold - row.current_stock, row.min_threshold * 2)
            items.append({"name": row.item_name, "batch": row.batch_number, "current_stock": row.current_stock, "min_threshold": row.min_threshold, "suggested_reorder": suggested, "unit": row.unit})
            lines.append(f"• **{row.item_name}** (lô {row.batch_number}): tồn {row.current_stock} {row.unit} / ngưỡng tối thiểu {row.min_threshold}; đề xuất {suggested} {row.unit}")
            evidence.append(self._batch_evidence(row))
            citations.append(self._batch_citation(row))
        text = "\n".join(lines) if lines else "Không có lô nào được ghi nhận dưới ngưỡng tồn tối thiểu."
        return CopilotResponse(intent="RESTOCK_PROPOSAL", answer_type="operational_result", reply_text=f"### Dự trù bổ sung tồn kho\n\n{text}", card=CopilotActionCard(card_type="low_stock_report", title="Dự trù bổ sung tồn kho", summary=f"Số lô dưới ngưỡng: {len(items)}", data={"items": items, "total": len(items)}, target_tab="inventory"), source_status="database_record", evidence=evidence, citations=citations)

    async def execute_stock_lookup(self, db: AsyncSession, query: str) -> CopilotResponse:
        result = await self.service.get_stock(db, query=query)
        if not result.records:
            return CopilotResponse(
                intent="CLINICAL_INVENTORY_LOOKUP",
                answer_type="unavailable",
                source_status="inventory_record_not_found",
                reply_text="Không tìm thấy bản ghi tồn kho khớp trong cơ sở dữ liệu hiện tại.",
                card=None,
            )
        items = []
        lines = []
        for row in result.records:
            items.append({"item_id": row.batch_id, "batch": row.batch_number, "stock": row.current_stock, "unit": row.unit, "expiry": row.expiry_date, "location": row.warehouse_location, "quarantined": row.is_quarantined})
            lines.append(f"• **{row.item_name}** — lô {row.batch_number}; tồn {row.current_stock} {row.unit}; hạn {row.expiry_date}; vị trí {row.warehouse_location}; cách ly: {'Có' if row.is_quarantined else 'Không'}.")
        evidence = [self._batch_evidence(row) for row in result.records]
        citations = [self._batch_citation(row) for row in result.records]
        card = CopilotActionCard(card_type="fefo_inventory", title="Kết quả tra cứu tồn kho", summary=f"Tìm thấy {len(items)} bản ghi lô", data={"batches": items}, target_tab="inventory")
        return CopilotResponse(
            intent="CLINICAL_INVENTORY_LOOKUP",
            answer_type="operational_result",
            source_status="database_record",
            reply_text="\n".join(lines),
            card=card,
            evidence=evidence,
            citations=citations,
        )

    @staticmethod
    def _batch_evidence(row):
        observed_at = row.updated_at.isoformat() if row.updated_at else None
        batch_id = getattr(row, "batch_id", None) or getattr(row, "id", None)
        evidence_id = f"inventory-batch:{batch_id}:{observed_at or 'current'}"
        content = (
            f"{row.item_name}; lô {row.batch_number}; tồn {row.current_stock} {row.unit}; "
            f"hạn {row.expiry_date}; vị trí {row.warehouse_location}; cách ly {row.is_quarantined}."
        )
        return {
            "evidence_id": evidence_id, "evidence_type": "operational_record",
            "source_id": "inventory_batches", "source_name": "Bản ghi lô tồn kho",
            "record_id": batch_id, "observed_at": observed_at,
            "source_version": observed_at, "content": content,
        }

    @classmethod
    def _batch_citation(cls, row):
        item = cls._batch_evidence(row)
        return {
            "source": item["source_name"], "source_id": item["source_id"],
            "record_id": item["record_id"], "section": item["observed_at"],
            "excerpt": item["content"], "evidence_id": item["evidence_id"],
        }
