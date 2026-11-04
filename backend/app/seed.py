import asyncio
from datetime import datetime
from sqlalchemy import select
from app.database import AsyncSessionLocal, engine, Base
from app.models.user import User
from app.models.debt import DebtRecord
from app.models.equipment import EquipmentTicket
from app.models.inventory import InventoryBatch
from app.models.coldchain import ColdChainCurrentState, ColdChainTelemetry
from app.models.asset import AssetRecord
from app.models.audit import AuditRecord
from app.models.patient import PatientProfile, PrescriptionAdviceRecord
from app.seed_registry import seed_dav_registry_if_needed

USERS_DATA = [
    {
        "id": "u-1", "role": "nurse", "name": "ĐD. Lê Thị Thu", "role_name": "Điều Dưỡng Ca Trực",
        "department": "Khoa Cấp Cứu A9", "practice_certificate": "004812/HN-CCHN",
        "pin_code": "1111", "rfid_card_id": "RFID-NURSE-8821",
        "responsibilities": "Ghi nợ thuốc cấp cứu ca đêm (TT 22), báo hỏng máy/phụ kiện (NĐ 98), nộp vỏ ống Morphin (TT 20)"
    },
    {
        "id": "u-2", "role": "biomedical_engineer", "name": "KS. Đặng Văn Nam", "role_name": "Kỹ Sư Trang Thiết Bị Y Tế",
        "department": "Phòng Vật Tư - TBYT", "practice_certificate": "BME-204/VTYT",
        "pin_code": "3333", "rfid_card_id": "RFID-BME-6672",
        "responsibilities": "Tiếp nhận sửa máy, quản lý sổ lý lịch máy, theo dõi hạn tem kiểm định (NĐ 98), kiểm kê 31/12 (NĐ 151)"
    },
    {
        "id": "u-3", "role": "pharmacist", "name": "DS. Nguyễn Bích Ngọc", "role_name": "Dược Sĩ Kho Dược",
        "department": "Kho Dược Lâm Sàng", "practice_certificate": "001098/BYT-CCHN",
        "pin_code": "2222", "rfid_card_id": "RFID-PHARM-1190",
        "responsibilities": "Duyệt hoàn bù nợ phiếu (TT 22), xuất kho FEFO (TT 36), giám sát chuỗi lạnh vắc xin, chủ trì hủy vỏ Morphin (TT 20)"
    },
    {
        "id": "u-4", "role": "doctor", "name": "BS. Trần Văn Hùng", "role_name": "Bác Sĩ Điều Trị",
        "department": "Khoa Hồi Sức Tích Cực (ICU)", "practice_certificate": "002341/HN-CCHN",
        "pin_code": "4444", "rfid_card_id": "RFID-DOC-9943",
        "responsibilities": "Kê đơn bù thuốc cấp cứu (TT 22), ký biên bản làm chứng hủy vỏ Morphin (TT 20), nghiệm thu máy tiếp nhận (NĐ 98)"
    },
    {
        "id": "u-5", "role": "director", "name": "TS.BS. Nguyễn Văn An", "role_name": "Ban Giám Đốc Bệnh Viện",
        "department": "Ban Giám Đốc", "practice_certificate": "001002/BYT-CCHN",
        "pin_code": "9999", "rfid_card_id": "RFID-DIR-0001",
        "responsibilities": "Phê duyệt thanh lý tài sản nhà nước (NĐ 151), giải phóng lô vắc xin sau sự cố chuỗi lạnh, giám sát toàn viện"
    }
]

from app.seed_debts_data import DEBTS_DATA
from app.seed_equipment_data import EQUIPMENT_DATA
from app.seed_inventory_data import INVENTORY_DATA
from app.seed_patients_data import PATIENTS_DATA, INITIAL_ADVICES_DATA
from app.seed_cpoe_data import CPOE_DATA
from app.models.cpoe import CpoePrescription

ASSETS_DATA = [
    {"id": "ast-1", "code": "TS-2026-001", "device_name": "Máy thở Puritan Bennett 840 (PB840)", "model": "PB840 Ventilator - Medtronic", "serial_number": "PB840-VN-2021-998", "risk_class": "D", "registered_department": "Khoa Cấp Cứu A9", "actual_department": "Phòng Mổ 2 (Khu Phẫu Thuật)", "is_misallocated": True, "depreciation_rate_percent": 40, "operating_years": 4, "pending_liquidation": False, "last_scanned_at": "08:30 AM - Kiểm kê buồng mổ"},
    {"id": "ast-2", "code": "TS-2026-002", "device_name": "Máy X-Quang di động C-Arm Shimadzu", "model": "OEC-9900 C-Arm System", "serial_number": "SHIM-CARM-2015-11", "risk_class": "C", "registered_department": "Khoa Chẩn Đoán Hình Ảnh", "actual_department": "Kho Phế Liệu Tầng Hầm Bệnh Viện", "is_misallocated": False, "depreciation_rate_percent": 95, "operating_years": 10, "pending_liquidation": False, "last_scanned_at": "09:15 AM - Kiểm kê kho phế liệu"},
    {"id": "ast-3", "code": "TS-2026-003", "device_name": "Máy sốc tim Zoll R Series", "model": "Zoll R Series BLS/ALS Defibrillator", "serial_number": "ZOLL-R-8831", "risk_class": "D", "registered_department": "Khoa Cấp Cứu A9", "actual_department": "Khoa Cấp Cứu A9", "is_misallocated": False, "depreciation_rate_percent": 30, "operating_years": 3, "pending_liquidation": False, "last_scanned_at": "07:45 AM - Xe tiêm cấp cứu A9"},
    {"id": "ast-4", "code": "TS-2026-004", "device_name": "Máy theo dõi bệnh nhân Philips MP50", "model": "IntelliVue MP50 Patient Monitor", "serial_number": "PHI-MP50-4102", "risk_class": "C", "registered_department": "Khoa Cấp Cứu A9", "actual_department": "Hồi Sức Tích Cực ICU - Giường 08", "is_misallocated": True, "depreciation_rate_percent": 50, "operating_years": 5, "pending_liquidation": False, "last_scanned_at": "08:10 AM - Quét buồng ICU"},
    {"id": "ast-5", "code": "TS-2026-005", "device_name": "Máy điện tim 6 cần Fukuda Denshi", "model": "Cardimax FX-7202 ECG", "serial_number": "FKD-FX7202-094", "risk_class": "B", "registered_department": "Khoa Ngoại Chấn Thương", "actual_department": "Kho Vật Tư Hỏng - Phòng 104", "is_misallocated": False, "depreciation_rate_percent": 100, "operating_years": 8, "pending_liquidation": True, "last_scanned_at": "09:30 AM - Rà soát thiết bị loại B"},
    {"id": "ast-6", "code": "TS-2026-006", "device_name": "Hệ thống lọc máu liên tục CRRT Prismaflex", "model": "Prismaflex v8.0 - Baxter", "serial_number": "PRISMA-VN-2022-014", "risk_class": "D", "registered_department": "Hồi Sức Tích Cực (ICU)", "actual_department": "Hồi Sức Tích Cực (ICU)", "is_misallocated": False, "depreciation_rate_percent": 35, "operating_years": 3, "pending_liquidation": False, "last_scanned_at": "08:45 AM - Buồng lọc máu ICU"},
    {"id": "ast-7", "code": "TS-2026-007", "device_name": "Máy thở Maquet Servo-i Universal", "model": "Servo-i Universal Ventilator", "serial_number": "MAQ-SERVOI-3104", "risk_class": "D", "registered_department": "Khoa Hồi Sức Ngoại", "actual_department": "Khoa Hồi Sức Ngoại", "is_misallocated": False, "depreciation_rate_percent": 45, "operating_years": 4, "pending_liquidation": False, "last_scanned_at": "08:20 AM - Buồng Hồi Sức 3"},
    {"id": "ast-8", "code": "TS-2026-008", "device_name": "Máy phá rung tim Philips HeartStart XL", "model": "HeartStart XL M4735A", "serial_number": "PHI-HSXL-7712", "risk_class": "D", "registered_department": "Khoa Can Thiệp Tim Mạch", "actual_department": "Phòng Hồi Tỉnh - Khu Phẫu Thuật", "is_misallocated": True, "depreciation_rate_percent": 60, "operating_years": 6, "pending_liquidation": False, "last_scanned_at": "09:05 AM - Kiểm kê khu mổ"},
    {"id": "ast-9", "code": "TS-2026-009", "device_name": "Bơm tiêm điện B.Braun Perfusor Space", "model": "Perfusor Space Infusion Pump", "serial_number": "BBR-PERF-9921", "risk_class": "C", "registered_department": "Khoa Cấp Cứu A9", "actual_department": "Khoa Cấp Cứu A9", "is_misallocated": False, "depreciation_rate_percent": 50, "operating_years": 5, "pending_liquidation": False, "last_scanned_at": "07:55 AM - Xe tiêm Cấp Cứu"},
    {"id": "ast-10", "code": "TS-2026-010", "device_name": "Máy siêu âm tim màu 4D GE Vivid E95", "model": "Vivid E95 4D Ultrasound System", "serial_number": "GE-VE95-2018-03", "risk_class": "C", "registered_department": "Khoa Can Thiệp Tim Mạch", "actual_department": "Khoa Can Thiệp Tim Mạch", "is_misallocated": False, "depreciation_rate_percent": 55, "operating_years": 5, "pending_liquidation": False, "last_scanned_at": "09:40 AM - Phòng Siêu Âm Tim"},
    {"id": "ast-11", "code": "TS-2026-011", "device_name": "Máy hút dịch áp lực âm di động Atmos Record 55", "model": "Atmos Record 55 Mobile Suction", "serial_number": "ATM-REC55-1022", "risk_class": "B", "registered_department": "Khoa Cấp Cứu A9", "actual_department": "Kho Thiết Bị Tầng 2", "is_misallocated": True, "depreciation_rate_percent": 70, "operating_years": 7, "pending_liquidation": False, "last_scanned_at": "10:00 AM - Quét mã kho đệm"},
    {"id": "ast-12", "code": "TS-2026-012", "device_name": "Máy ly tâm lạnh túi máu Hettich Roto Silenta 630RS", "model": "Roto Silenta 630RS Refrigerated Centrifuge", "serial_number": "HET-ROTO-2012-01", "risk_class": "B", "registered_department": "Đơn Vị Huyết Học Truyền Máu", "actual_department": "Kho Phế Liệu Tầng Hầm", "is_misallocated": False, "depreciation_rate_percent": 100, "operating_years": 12, "pending_liquidation": True, "last_scanned_at": "10:15 AM - Rà soát thiết bị thanh lý"}
]

AUDIT_DATA = [
    {
        "id": "AUD-2026-0091", "timestamp": "2026-10-15 19:20:14", "action_type": "SETTLE_DEBT",
        "action_title": "Hoàn bù cơ số Fentanyl 0.1mg/2ml tủ trực cấp cứu", "target_item": "PN-2026-085 (Fentanyl 0.1mg/2ml x 1 ống)",
        "legal_basis": "Điều 10 Thông tư 22/2011/TT-BYT", "signer_name": "ĐD. Lê Thị Thu",
        "signer_certificate": "004812/HN-CCHN", "witness_name": "BS. Trần Văn Hùng", "witness_certificate": "002341/HN-CCHN",
        "auth_method": "RFID_NFC", "previous_hash": "GENESIS_BLOCK_HOSPITAL_AUDIT_2026",
        "integrity_hash": "930a45042ded56a9c4e95ba76c8519756857441457d4f1af81b9c3173f604465",
        "payload_data": {"ticket_code": "PN-2026-085", "action": "SETTLE"}
    }
]

async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        from sqlalchemy import inspect, text
        chat_log_cols = await conn.run_sync(lambda sync_conn: {col["name"] for col in inspect(sync_conn).get_columns("copilot_chat_logs")})
        copilot_extra_cols = [
            ("utility_score", "FLOAT DEFAULT 0.5"),
            ("is_useful", "BOOLEAN DEFAULT 1"),
            ("quality_category", "VARCHAR(64) DEFAULT 'high_value_clinical'"),
            ("grounded_source", "VARCHAR(256)"),
        ]
        for col_name, col_type in copilot_extra_cols:
            if col_name not in chat_log_cols:
                await conn.execute(text(f"ALTER TABLE copilot_chat_logs ADD COLUMN {col_name} {col_type}"))

        await conn.execute(User.__table__.delete())
        await conn.execute(DebtRecord.__table__.delete())
        await conn.execute(EquipmentTicket.__table__.delete())
        await conn.execute(InventoryBatch.__table__.delete())
        await conn.execute(ColdChainCurrentState.__table__.delete())
        await conn.execute(ColdChainTelemetry.__table__.delete())
        await conn.execute(AssetRecord.__table__.delete())
        await conn.execute(AuditRecord.__table__.delete())
        await conn.execute(PatientProfile.__table__.delete())
        await conn.execute(PrescriptionAdviceRecord.__table__.delete())
        await conn.execute(CpoePrescription.__table__.delete())

    async with AsyncSessionLocal() as session:
        # 1. Users
        for u in USERS_DATA:
            session.add(User(**u))

        # 2. Debts
        for d in DEBTS_DATA:
            session.add(DebtRecord(**d))

        # 3. Equipment
        for eq in EQUIPMENT_DATA:
            session.add(EquipmentTicket(**eq))

        # 4. Inventory Batches
        for b in INVENTORY_DATA:
            session.add(InventoryBatch(**b))

        # 5. Cold Chain State & Logs
        state = ColdChainCurrentState(
            id=1, current_temp=4.5, is_outage=False, is_quarantined=False,
            vvm_level=1, mkt_temp=5.6, outage_minutes=0, total_vaccine_doses=1250
        )
        session.add(state)
        sample_telemetry = [
            ColdChainTelemetry(timestamp="00:00", temperature=4.2),
            ColdChainTelemetry(timestamp="04:00", temperature=4.5),
            ColdChainTelemetry(timestamp="08:00", temperature=4.8),
            ColdChainTelemetry(timestamp="12:00", temperature=5.1),
            ColdChainTelemetry(timestamp="16:00", temperature=4.6),
            ColdChainTelemetry(timestamp="20:00", temperature=4.3),
        ]
        for t in sample_telemetry:
            session.add(t)

        # 6. Assets
        for ast in ASSETS_DATA:
            session.add(AssetRecord(**ast))

        # 7. Audit records
        for aud in AUDIT_DATA:
            session.add(AuditRecord(**aud))

        # 8. Patients
        for p in PATIENTS_DATA:
            session.add(PatientProfile(**p))

        # 9. Initial Prescription Advice
        for a in INITIAL_ADVICES_DATA:
            session.add(PrescriptionAdviceRecord(**a))

        # 10. CPOE Prescriptions
        for c in CPOE_DATA:
            c_dict = {k: v for k, v in c.items() if k != "created_at"}
            session.add(CpoePrescription(**c_dict))

        await session.commit()
        seed_dav_registry_if_needed()
        print("Successfully seeded all hospital clinical datasets into database!")

if __name__ == "__main__":
    asyncio.run(seed())
