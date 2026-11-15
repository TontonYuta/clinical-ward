from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.cold_chain.service import ColdChainService
from app.schemas.copilot import CopilotActionCard, CopilotResponse


class ColdChainTools:
    def __init__(self, service: ColdChainService | None = None):
        self.service = service or ColdChainService()

    async def status_response(self, db: AsyncSession) -> CopilotResponse:
        result = await self.service.get_status(db)
        snapshot = result.snapshot
        if snapshot is None:
            return CopilotResponse(
                intent="CLINICAL_COLD_CHAIN_TELEMETRY",
                answer_type="unavailable",
                reply_text="Chưa có bản ghi trạng thái chuỗi lạnh trong cơ sở dữ liệu.",
                card=None,
            )

        parts = [f"• **Nhiệt độ hiện tại:** {snapshot.current_temp}°C"]
        parts.append(f"• **Mất điện:** {'Có' if snapshot.is_outage else 'Không'}")
        parts.append(f"• **Cách ly:** {'Có' if snapshot.is_quarantined else 'Không'}")
        if snapshot.mkt_temp is not None:
            parts.append(f"• **MKT:** {snapshot.mkt_temp}°C")
        reply = "\n".join(parts)
        record_updated_at = snapshot.updated_at.isoformat() if snapshot.updated_at else None
        evidence_id = f"cold-chain-state:{record_updated_at}" if record_updated_at else "cold-chain-state:current"
        source_record = {
            "evidence_id": evidence_id,
            "evidence_type": "operational_record",
            "source_id": "cold_chain_current_state",
            "source_name": "Trạng thái chuỗi lạnh trong cơ sở dữ liệu",
            "record_id": "current_state",
            "record_updated_at": record_updated_at,
            "source_version": record_updated_at,
            "content": reply,
        }
        citation = {
            "source": source_record["source_name"],
            "source_id": source_record["source_id"],
            "record_id": source_record["record_id"],
            "section": record_updated_at,
            "excerpt": reply,
            "evidence_id": evidence_id,
        }
        telemetry_evidence = [
            {
                "evidence_id": f"cold-chain-telemetry:{record.telemetry_id}",
                "evidence_type": "operational_record",
                "source_id": "cold_chain_telemetry",
                "source_name": "Bản ghi telemetry chuỗi lạnh",
                "record_id": record.telemetry_id,
                "sensor_id": record.sensor_id,
                "record_timestamp": record.timestamp,
                "content": f"Cảm biến {record.sensor_id}; thời điểm {record.timestamp}; nhiệt độ {record.temperature}°C; cảnh báo {record.is_alert}.",
            }
            for record in result.telemetry
        ]
        source_records = [source_record, *telemetry_evidence]
        source_citations = [citation, *[
            {
                "source": item["source_name"],
                "source_id": item["source_id"],
                "record_id": item["record_id"],
                "section": item["record_timestamp"],
                "excerpt": item["content"],
                "evidence_id": item["evidence_id"],
            }
            for item in telemetry_evidence
        ]]
        card = CopilotActionCard(
            card_type="coldchain_status",
            title="Trạng thái chuỗi lạnh",
            summary=f"Nhiệt độ hiện tại: {snapshot.current_temp}°C",
            data={
                "current_temp": snapshot.current_temp,
                "is_outage": snapshot.is_outage,
                "is_quarantined": snapshot.is_quarantined,
                "mkt_temp": snapshot.mkt_temp,
                "updated_at": snapshot.updated_at.isoformat() if snapshot.updated_at else None,
                "status": result.status,
            },
            target_tab="coldchain",
        )
        return CopilotResponse(
            intent="CLINICAL_COLD_CHAIN_TELEMETRY",
            answer_type="operational_result",
            reply_text=reply,
            card=card,
            source_status="database_record",
            evidence=source_records,
            citations=source_citations,
        )
