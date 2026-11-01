/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  DebtRecord,
  EquipmentTicket,
  InventoryBatch,
  ColdChainMonitorState,
  QuickSuggestionChip,
  ChatMessage,
  AssetAuditRecord,
  UserRole,
  UserProfile,
  AuditTrailRecord
} from '../types/clinical';

export const USER_PROFILES: Record<UserRole, UserProfile> = {
  nurse: {
    role: 'nurse',
    name: 'ĐD. Lê Thị Thu',
    roleName: 'Điều Dưỡng Ca Trực',
    department: 'Khoa Cấp Cứu A9',
    practiceCertificate: '004812/HN-CCHN',
    pinCode: '1111',
    rfidCardId: 'RFID-NURSE-8821',
    allowedActions: ['BORROW_EMERGENCY', 'RETURN_AMPOULE', 'SETTLE_DEBT', 'CREATE_INCIDENT'],
    allowedTabs: ['overview', 'debt', 'cpoe', 'fefo', 'equipment'],
    responsibilities: 'Thực hiện đơn thuốc & chỉ định điều trị, mượn thuốc cấp cứu ca đêm (TT 22), báo hỏng máy/phụ kiện (NĐ 98), hoàn nộp vỏ ống Morphin (TT 20)',
    defaultTab: 'debt',
    badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-300'
  },
  biomedical_engineer: {
    role: 'biomedical_engineer',
    name: 'KS. Đặng Văn Nam',
    roleName: 'Kỹ Sư Trang Thiết Bị Y Tế',
    department: 'Phòng Vật Tư - TBYT',
    practiceCertificate: 'BME-204/VTYT',
    pinCode: '3333',
    rfidCardId: 'RFID-BME-6672',
    allowedActions: ['HANDOVER_EQUIPMENT', 'TRANSFER_ASSET', 'RESTORE_POWER', 'CREATE_INCIDENT', 'LIQUIDATE_ASSET'],
    allowedTabs: ['overview', 'equipment', 'asset_audit'],
    responsibilities: 'Tiếp nhận sửa máy, quản lý lý lịch máy, thử an toàn điện IEC 60601-1 (NĐ 98), kiểm kê tài sản 31/12 (NĐ 151)',
    defaultTab: 'equipment',
    badgeColor: 'bg-blue-50 text-blue-800 border-blue-300'
  },
  pharmacist: {
    role: 'pharmacist',
    name: 'DS. Nguyễn Bích Ngọc',
    roleName: 'Dược Sĩ / Thủ Kho Dược',
    department: 'Kho Dược Bệnh Viện',
    practiceCertificate: '018234/BYT-CCHN',
    pinCode: '2222',
    rfidCardId: 'RFID-PHARM-4491',
    allowedActions: [
      'APPROVE_PRESCRIPTION',
      'DISPENSE_OUTPATIENT',
      'BORROW_EMERGENCY',
      'SETTLE_DEBT',
      'DESTROY_AMPOULES',
      'DISPATCH_FEFO',
      'RESTOCK_MEDICATION',
      'RESTORE_POWER',
      'RELEASE_VACCINE_QUARANTINE'
    ],
    allowedTabs: ['overview', 'fefo', 'debt', 'coldchain', 'cpoe'],
    responsibilities: 'Duyệt đơn CPOE, cấp bù tủ trực (TT 22), điều phối xuất thuốc FEFO, giám sát chuỗi lạnh 2-8°C (TT 36 GSP), hủy vỏ Morphin (TT 20)',
    defaultTab: 'fefo',
    badgeColor: 'bg-purple-50 text-purple-800 border-purple-300'
  },
  doctor: {
    role: 'doctor',
    name: 'BS. Trần Văn Hùng',
    roleName: 'Bác Sĩ Điều Trị',
    department: 'Hồi Sức Tích Cực (ICU)',
    practiceCertificate: '009125/BYT-CCHN',
    pinCode: '4444',
    rfidCardId: 'RFID-DOC-1109',
    allowedActions: ['PRESCRIBE_MEDICATION', 'BORROW_EMERGENCY', 'SETTLE_DEBT', 'DESTROY_AMPOULES', 'HANDOVER_EQUIPMENT', 'CREATE_INCIDENT'],
    allowedTabs: ['overview', 'cpoe', 'debt', 'fefo', 'equipment', 'coldchain'],
    responsibilities: 'Kê đơn điện tử CPOE (TT 26/2025), kê đơn thuốc nội trú hằng ngày, tra cứu thuốc tủ trực và thiết bị buồng bệnh',
    defaultTab: 'cpoe',
    badgeColor: 'bg-teal-50 text-teal-800 border-teal-300'
  },
  director: {
    role: 'director',
    name: 'TS.BS. Nguyễn Văn An',
    roleName: 'Ban Giám Đốc Bệnh Viện',
    department: 'Ban Giám Đốc',
    practiceCertificate: '001002/BYT-CCHN',
    pinCode: '9999',
    rfidCardId: 'RFID-EXEC-0001',
    allowedActions: [
      'PRESCRIBE_MEDICATION',
      'APPROVE_PRESCRIPTION',
      'BORROW_EMERGENCY',
      'CREATE_INCIDENT',
      'SETTLE_DEBT',
      'RETURN_AMPOULE',
      'DESTROY_AMPOULES',
      'HANDOVER_EQUIPMENT',
      'DISPATCH_FEFO',
      'RESTOCK_MEDICATION',
      'TRANSFER_ASSET',
      'LIQUIDATE_ASSET',
      'RESTORE_POWER',
      'RELEASE_VACCINE_QUARANTINE',
      'SWITCH_ROLE'
    ],
    allowedTabs: ['overview', 'cpoe', 'debt', 'equipment', 'fefo', 'coldchain', 'asset_audit'],
    responsibilities: 'Toàn quyền lãnh đạo cao nhất: Phê duyệt dự trù thuốc Mẫu 01, quyết định thanh lý tài sản (NĐ 151), giải phóng vắc xin, kiểm toán SHA-256',
    defaultTab: 'cpoe',
    badgeColor: 'bg-amber-50 text-amber-800 border-amber-300'
  }
};

export const INITIAL_AUDIT_TRAIL_RECORDS: AuditTrailRecord[] = [
  {
    id: 'AUD-2026-0036',
    timestamp: '2026-10-16 05:30:12',
    actionType: 'RESTORE_POWER',
    actionTitle: 'Khôi phục điện chuỗi lạnh & Kích hoạt Biệt trữ GSP',
    targetItem: 'Tủ bảo quản vắc xin số 1 (4.5°C) - 1.250 liều Verorab/SAT',
    legalBasis: 'Điều 12 Thông tư 36/2018/TT-BYT (GSP)',
    signerRole: 'pharmacist',
    signerName: 'DS. Nguyễn Bích Ngọc',
    signerCertificate: '018234/BYT-CCHN',
    witnessRole: 'biomedical_engineer',
    witnessName: 'KS. Đặng Văn Nam',
    witnessCertificate: 'BME-204/VTYT',
    authMethod: 'RFID_NFC',
    integrityHash: 'SHA256:7c9e12a0...e34891b2',
    status: 'verified'
  },
  {
    id: 'AUD-2026-0037',
    timestamp: '2026-10-16 06:10:45',
    actionType: 'TRANSFER_ASSET',
    actionTitle: 'Biên bản bàn giao điều chuyển tài sản công (Mẫu 01/TSC-ĐC)',
    targetItem: 'Máy phá rung tim Philips HeartStart XL (SN: PHI-HSXL-7712) -> Phòng Hồi Tỉnh',
    legalBasis: 'Điều 39 & Điều 40 Nghị định 151/2017/NĐ-CP',
    signerRole: 'biomedical_engineer',
    signerName: 'KS. Đặng Văn Nam',
    signerCertificate: 'BME-204/VTYT',
    witnessRole: 'doctor',
    witnessName: 'BS. Trần Văn Hùng',
    witnessCertificate: '009125/BYT-CCHN',
    authMethod: 'PIN',
    integrityHash: 'SHA256:4b8a21f9...12cd98a0',
    status: 'verified'
  },
  {
    id: 'AUD-2026-0038',
    timestamp: '2026-10-16 06:15:22',
    actionType: 'RETURN_AMPOULE',
    actionTitle: 'Thu hồi vỏ ống thuốc gây nghiện vào khay kiểm soát',
    targetItem: 'Morphin sulfat 10mg/1ml (PN-2026-089) - BN Võ Minh Trí',
    legalBasis: 'Điều 15 Thông tư 20/2017/TT-BYT',
    signerRole: 'nurse',
    signerName: 'ĐD. Lê Thị Thu',
    signerCertificate: '004812/HN-CCHN',
    authMethod: 'RFID_NFC',
    integrityHash: 'SHA256:8f4c2e71...b9104a32',
    status: 'verified'
  },
  {
    id: 'AUD-2026-0039',
    timestamp: '2026-10-16 06:45:10',
    actionType: 'HANDOVER_EQUIPMENT',
    actionTitle: 'Kiểm định an toàn điện & Nghiệm thu bàn giao buồng bệnh',
    targetItem: 'Máy sốc tim 2 pha Zoll R Series (SC-2026-039)',
    legalBasis: 'Điều 34 Nghị định 98/2021/NĐ-CP & NĐ 07/2023',
    signerRole: 'biomedical_engineer',
    signerName: 'KS. Đặng Văn Nam',
    signerCertificate: 'BME-204/VTYT',
    witnessRole: 'doctor',
    witnessName: 'BS. Trần Văn Hùng',
    witnessCertificate: '009125/BYT-CCHN',
    authMethod: 'PIN',
    integrityHash: 'SHA256:3a1d9c58...4f826e11',
    status: 'verified'
  },
  {
    id: 'AUD-2026-0040',
    timestamp: '2026-10-16 06:55:04',
    actionType: 'DISPATCH_FEFO',
    actionTitle: 'Xuất kho dược phẩm theo nguyên tắc hạn gần xuất trước (FEFO)',
    targetItem: 'Meropenem 1g (Lô LOT-ME24-K2, EXP: 2026-11-28) - Xuất 20 lọ',
    legalBasis: 'Khoản 2 Điều 12 Thông tư 36/2018/TT-BYT (GSP)',
    signerRole: 'pharmacist',
    signerName: 'DS. Nguyễn Bích Ngọc',
    signerCertificate: '018234/BYT-CCHN',
    authMethod: 'RFID_NFC',
    integrityHash: 'SHA256:e7b512aa...ca39810f',
    status: 'verified'
  },
  {
    id: 'AUD-2026-0041',
    timestamp: '2026-10-16 07:15:30',
    actionType: 'DESTROY_AMPOULES',
    actionTitle: 'Hội đồng Tiêu hủy Vỏ ống Thuốc gây nghiện (Mẫu số 10/TT20)',
    targetItem: '05 vỏ ống thủy tinh Morphin sulfat 10mg & Fentanyl 0.1mg',
    legalBasis: 'Điều 15 Thông tư 20/2017/TT-BYT',
    signerRole: 'pharmacist',
    signerName: 'DS. Nguyễn Bích Ngọc',
    signerCertificate: '018234/BYT-CCHN',
    witnessRole: 'nurse',
    witnessName: 'ĐD. Lê Thị Thu',
    witnessCertificate: '004812/HN-CCHN',
    authMethod: 'PIN',
    integrityHash: 'SHA256:9f23e801...aa19280d',
    status: 'verified'
  }
];

export const INITIAL_DEBT_RECORDS: DebtRecord[] = [
  {
    id: 'debt-1',
    code: 'PN-2026-089',
    itemName: 'Morphin (Morphin hydroclorid 10mg/ml)',
    itemType: 'Thuốc gây nghiện',
    quantity: '2 ống',
    patientName: 'Võ Minh Trí (BN-8820)',
    patientRoom: 'Buồng cấp cứu 3 - Giường 02',
    borrowTime: '01:40 AM',
    borrowDate: 'Hôm nay',
    borrowerName: 'ĐD. Lê Thị Thu (Khoa Cấp Cứu)',
    status: 'debt',
    note: 'Cấp cứu đau thắt ngực nhồi máu cơ tim cấp. Bắt buộc thu hồi vỏ ống TT 20/2017.',
    legalBasis: 'Thông tư 22/2011/TT-BYT & TT 20/2017/TT-BYT',
    ampouleReturned: false,
  },
  {
    id: 'debt-2',
    code: 'PN-2026-090',
    itemName: 'Kali clorid 10%',
    itemType: 'Thuốc cấp cứu',
    quantity: '2 ống',
    patientName: 'Võ Minh Trí (BN-8820)',
    patientRoom: 'Buồng cấp cứu 3 - Giường 02',
    borrowTime: '01:45 AM',
    borrowDate: 'Hôm nay',
    borrowerName: 'ĐD. Lê Thị Thu (Khoa Cấp Cứu)',
    status: 'debt',
    note: 'Pha truyền bù điện giải khẩn cấp hạ kali máu nặng 2.4 mmol/L High-Alert.',
    legalBasis: 'Thông tư 22/2011/TT-BYT - Bù cơ số tủ trực cấp cứu khoa lâm sàng',
    ampouleReturned: true,
  },
  {
    id: 'debt-3',
    code: 'PN-2026-085',
    itemName: 'Fentanyl 50 micrograms/ml',
    itemType: 'Thuốc gây nghiện',
    quantity: '1 ống',
    patientName: 'Nguyễn Hải Đăng (BN-8791)',
    patientRoom: 'Phòng mổ 1 - Phẫu thuật thần kinh',
    borrowTime: '19:15 PM',
    borrowDate: 'Hôm qua',
    borrowerName: 'BS. Trần Văn Hùng (Gây mê hồi sức)',
    status: 'settled',
    note: 'Đã bổ sung đơn thuốc điện tử & nộp khay vỏ ống đối soát.',
    legalBasis: 'Thông tư 22/2011/TT-BYT - Điều 9 Quản lý thuốc gây nghiện tại buồng bệnh',
    settledAt: '08:10 AM - Kho Dược Lâm Sàng',
    ampouleReturned: true,
    ampouleReturnTime: '08:15 AM - Đã nộp khay vỏ ống',
    ampouleDestroyed: false,
  },
  {
    id: 'debt-4',
    code: 'PN-2026-088',
    itemName: 'Ceftriaxona Normon 1g',
    itemType: 'Thuốc cấp cứu',
    quantity: '2 lọ',
    patientName: 'Hoàng Kim Dung (BN-8812)',
    patientRoom: 'Hồi sức tích cực ICU - Giường 05',
    borrowTime: '23:30 PM',
    borrowDate: 'Hôm qua',
    borrowerName: 'ĐD. Phạm Thu Trang',
    status: 'debt',
    note: 'Nhiễm khuẩn huyết nặng, tiêm kháng sinh khẩn cấp.',
    legalBasis: 'Thông tư 22/2011/TT-BYT - Quy chế tủ trực lâm sàng',
    ampouleReturned: true,
  },
  {
    id: 'debt-5',
    code: 'PN-2026-091',
    itemName: 'Hadunalin 1 mg/ml',
    itemType: 'Thuốc cấp cứu',
    quantity: '3 ống',
    patientName: 'Đặng Thị Lan (BN-8825)',
    patientRoom: 'Khoa Cấp Cứu A9 - Buồng Sốc phản vệ',
    borrowTime: '02:10 AM',
    borrowDate: 'Hôm nay',
    borrowerName: 'ĐD. Lê Thị Thu',
    status: 'debt',
    note: 'Sốc phản vệ độ III theo phác đồ Thông tư 51/2017/TT-BYT.',
    legalBasis: 'Thông tư 51/2017/TT-BYT & TT 22/2011/TT-BYT - Phác đồ cấp cứu phản vệ',
    ampouleReturned: true,
  },
  {
    id: 'debt-6',
    code: 'PN-2026-092',
    itemName: 'Noradrenalin 4mg/4ml',
    itemType: 'Thuốc cấp cứu',
    quantity: '4 ống',
    patientName: 'Trần Văn Toàn (BN-8819)',
    patientRoom: 'Hồi sức tích cực ICU - Giường 02',
    borrowTime: '03:00 AM',
    borrowDate: 'Hôm nay',
    borrowerName: 'BS. Trần Văn Hùng',
    status: 'debt',
    note: 'Sốc nhiễm trùng tụt huyết áp kháng dịch, duy trì qua bơm tiêm điện.',
    legalBasis: 'Thông tư 22/2011/TT-BYT - Cơ số cấp cứu hồi sức',
    ampouleReturned: true,
  },
  {
    id: 'debt-7',
    code: 'PN-2026-083',
    itemName: 'Diazepam Injection BP 10mg/2ml',
    itemType: 'Thuốc hướng thần',
    quantity: '2 ống',
    patientName: 'Lê Hoàng Nam (BN-8830)',
    patientRoom: 'Buồng cấp cứu Thần kinh - Giường 01',
    borrowTime: '00:25 AM',
    borrowDate: 'Hôm nay',
    borrowerName: 'ĐD. Nguyễn Thị Thảo',
    status: 'settled',
    settledAt: '07:30 AM - BS. Hùng đã duyệt đơn điện tử',
    ampouleReturned: true,
    ampouleReturnTime: '07:45 AM - Đã nộp khay vỏ ống',
    ampouleDestroyed: false,
    note: 'Cắt cơn co giật động kinh liên tục, đã nộp vỏ hoàn tất.',
    legalBasis: 'Thông tư 20/2017/TT-BYT & TT 22/2011/TT-BYT - Quản lý thuốc hướng thần',
  },
  {
    id: 'debt-8',
    code: 'PN-2026-093',
    itemName: 'Meroright 1g (Meropenem)',
    itemType: 'Thuốc cấp cứu',
    quantity: '2 lọ',
    patientName: 'Phạm Thị Mai (BN-8814)',
    patientRoom: 'Hồi sức Ngoại - Giường 04',
    borrowTime: '04:15 AM',
    borrowDate: 'Hôm nay',
    borrowerName: 'BS. Lê Minh Đức',
    status: 'debt',
    note: 'Kháng sinh phổ rộng cấp cứu nhiễm trùng ổ bụng sau phẫu thuật.',
    legalBasis: 'Thông tư 22/2011/TT-BYT - Danh mục thuốc tủ trực cấp cứu',
    ampouleReturned: true,
  },
  {
    id: 'debt-9',
    code: 'PN-2026-082',
    itemName: 'Salbutamol 2,5 mg/ 2,5 ml',
    itemType: 'Thuốc cấp cứu',
    quantity: '2 ống',
    patientName: 'Vũ Đình Hưng (BN-8833)',
    patientRoom: 'Cấp cứu A9 - Giường 06',
    borrowTime: '01:15 AM',
    borrowDate: 'Hôm nay',
    borrowerName: 'ĐD. Lê Thị Thu',
    status: 'settled',
    settledAt: '06:50 AM - ĐD. Thu đã hoàn bù cơ số',
    note: 'Khí dung cấp cứu cắt cơn co thắt phế quản ác tính, đã bù cơ số.',
    legalBasis: 'Thông tư 22/2011/TT-BYT - Quy chế tủ trực lâm sàng',
    ampouleReturned: true,
  },
  {
    id: 'debt-10',
    code: 'PN-2026-081',
    itemName: 'Lactated Ringer’s Injection/Vioser',
    itemType: 'Thuốc cấp cứu',
    quantity: '2 chai',
    patientName: 'Nguyễn Thị Yến (BN-8798)',
    patientRoom: 'Phòng mổ 3 - Gây mê hồi sức',
    borrowTime: '21:40 PM',
    borrowDate: 'Hôm qua',
    borrowerName: 'BS. Trần Văn Hùng',
    status: 'settled',
    settledAt: '08:00 AM - Kho Dược Lâm Sàng',
    note: 'Truyền dịch đa điện giải bù thể tích tuần hoàn cấp cứu.',
    legalBasis: 'Thông tư 51/2017/TT-BYT & Quy chuẩn tủ trực phòng phẫu thuật',
    ampouleReturned: true,
  },
  {
    id: 'debt-11',
    code: 'PN-2026-094',
    itemName: 'Morphin (Morphin hydroclorid 10mg/ml)',
    itemType: 'Thuốc gây nghiện',
    quantity: '1 ống',
    patientName: 'Bùi Đức Mạnh (BN-8835)',
    patientRoom: 'Khoa Ngoại Chấn Thương - Giường 11',
    borrowTime: '03:45 AM',
    borrowDate: 'Hôm nay',
    borrowerName: 'ĐD. Hoàng Văn Tùng',
    status: 'debt',
    ampouleReturned: false,
    note: 'Giảm đau khẩn cấp đa chấn thương gãy hở xương đùi, chưa nộp vỏ.',
    legalBasis: 'Thông tư 20/2017/TT-BYT - Thuốc độc gây nghiện bảng kiểm soát',
  },
  {
    id: 'debt-12',
    code: 'PN-2026-095',
    itemName: 'VANCOMYCIN 1g',
    itemType: 'Thuốc cấp cứu',
    quantity: '1 lọ',
    patientName: 'Nguyễn Quốc Bảo (BN-8810)',
    patientRoom: 'Hồi sức tích cực ICU - Giường 09',
    borrowTime: '02:40 AM',
    borrowDate: 'Hôm nay',
    borrowerName: 'ĐD. Phạm Thu Trang',
    status: 'debt',
    note: 'Pha truyền tĩnh mạch chậm điều trị nhiễm khuẩn huyết do MRSA.',
    legalBasis: 'Thông tư 22/2011/TT-BYT - Cơ số cấp cứu lâm sàng',
    ampouleReturned: true,
  }
];

export const INITIAL_EQUIPMENT_TICKETS: EquipmentTicket[] = [
  {
    id: 'eq-1',
    code: 'SC-2026-042',
    deviceName: 'Máy thở Puritan Bennett 840 (PB840)',
    deviceModel: 'Puritan Bennett 840 - Medtronic',
    serialNumber: 'PB840-VN-2021-998',
    riskClass: 'D',
    accessoryIssue: 'Dây thở silicon nứt khớp nối gây xì khí áp lực thấp (Ppeak giảm)',
    location: 'Phòng mổ 2 - Tầng 3 (Khu Phẫu Thuật)',
    urgency: 'urgent',
    assignedEngineer: 'KS. Đặng Văn Nam (Phòng Vật tư - TBYT)',
    status: 'in_progress',
    reportTime: '02:15 AM - Báo bởi BS. Trực mổ',
    lastInspectionDate: '15/04/2026',
    nextInspectionDue: '15/04/2027',
    inspectionUnit: 'Trung tâm Kỹ thuật Tiêu chuẩn Đo lường Chất lượng 1 (Quatest 1)',
    legalBasis: 'Nghị định 98/2021/NĐ-CP - Thiết bị loại D can thiệp trực tiếp tính mạng',
    actionLog: [
      '02:15 AM: Nhận cảnh báo xì khí từ phòng mổ 2',
      '02:20 AM: Tự động điều phối dây thở dự phòng tiệt trùng tại Kho A1',
      '02:35 AM: KS. Đặng Văn Nam tiếp nhận ticket, tiến hành thay thế và test kín khí'
    ]
  },
  {
    id: 'eq-2',
    code: 'SC-2026-039',
    deviceName: 'Máy sốc tim Zoll R Series',
    deviceModel: 'Zoll R Series Defibrillator BLS/ALS',
    serialNumber: 'ZOLL-R-8831',
    riskClass: 'D',
    accessoryIssue: 'Bản cực sốc tim ngoài lồng ngực (Paddles) bị tróc lớp phủ tiếp xúc',
    location: 'Khoa Cấp Cứu A9 - Xe tiêm số 1',
    urgency: 'normal',
    assignedEngineer: 'KS. Bùi Quốc Bảo (Phòng Vật tư - TBYT)',
    status: 'inspected',
    reportTime: '14:20 PM - 14/10/2026',
    lastInspectionDate: '10/11/2025',
    nextInspectionDue: '10/11/2026 (Còn 26 ngày)',
    inspectionUnit: 'Viện Trang thiết bị và Công trình Y tế (NIEMET)',
    legalBasis: 'Nghị định 98/2021/NĐ-CP - Điều 54 Kiểm định định kỳ thiết bị rủi ro cao',
    actionLog: [
      'Đã thay thế bộ bản cực mới chính hãng Zoll',
      'Đã test xung năng lượng 200J đạt chuẩn',
      'Lên lịch kiểm định dán tem chu kỳ 2026-2027 với Viện TBYT'
    ]
  },
  {
    id: 'eq-3',
    code: 'SC-2026-041',
    deviceName: 'Máy theo dõi bệnh nhân Philips MP50',
    deviceModel: 'Philips IntelliVue MP50 Monitor',
    serialNumber: 'PHI-MP50-4102',
    riskClass: 'C',
    accessoryIssue: 'Cáp đo SpO2 người lớn chập chờn tín hiệu Pleth',
    location: 'Hồi sức tích cực ICU - Giường 08',
    urgency: 'warning',
    assignedEngineer: 'KS. Đặng Văn Nam',
    status: 'pending',
    reportTime: '06:05 AM - Báo ca sáng',
    lastInspectionDate: '01/06/2026',
    nextInspectionDue: '01/06/2027',
    inspectionUnit: 'Quatest 1',
    legalBasis: 'Nghị định 98/2021/NĐ-CP - Kiểm tra bảo dưỡng định kỳ',
    actionLog: [
      'Chờ kỹ sư bàn giao cáp SpO2 Nellcor tương thích từ kho dự trữ'
    ]
  },
  {
    id: 'eq-4',
    code: 'SC-2026-043',
    deviceName: 'Hệ thống lọc máu liên tục CRRT Prismaflex',
    deviceModel: 'Prismaflex System v8.0 - Baxter',
    serialNumber: 'PRISMA-VN-2022-014',
    riskClass: 'D',
    accessoryIssue: 'Cảm biến áp lực xuyên màng TMP (Transmembrane Pressure) vượt ngưỡng cảnh báo 350 mmHg',
    location: 'Hồi sức tích cực ICU - Buồng lọc máu',
    urgency: 'urgent',
    assignedEngineer: 'KS. Đặng Văn Nam',
    status: 'in_progress',
    reportTime: '03:10 AM - Báo bởi BS. Trực ICU',
    lastInspectionDate: '20/03/2026',
    nextInspectionDue: '20/03/2027',
    inspectionUnit: 'Quatest 1',
    legalBasis: 'Nghị định 98/2021/NĐ-CP - Thiết bị loại D can thiệp trực tiếp tính mạng',
    actionLog: [
      '03:10 AM: Báo lỗi đông màng lọc hoặc tăng áp lực dịch siêu lọc',
      '03:25 AM: Kỹ sư phối hợp bác sĩ xả rửa bolus heparin và cân chỉnh sensor áp lực'
    ]
  },
  {
    id: 'eq-5',
    code: 'SC-2026-044',
    deviceName: 'Bơm tiêm điện B.Braun Perfusor Space',
    deviceModel: 'Perfusor Space - B.Braun Germany',
    serialNumber: 'BBR-PERF-9921',
    riskClass: 'C',
    accessoryIssue: 'Cell pin tích điện NiMH bị chai, nguồn sụt dưới 10 phút khi rút phích cắm AC 220V',
    location: 'Khoa Cấp Cứu A9 - Xe tiêm 02',
    urgency: 'warning',
    assignedEngineer: 'KS. Bùi Quốc Bảo',
    status: 'pending',
    reportTime: '05:30 AM - Báo ca trực',
    lastInspectionDate: '12/08/2025',
    nextInspectionDue: '12/08/2026 (Đã quá hạn dán tem)',
    inspectionUnit: 'Viện Trang thiết bị và Công trình Y tế (NIEMET)',
    legalBasis: 'Nghị định 98/2021/NĐ-CP - Kiểm định an toàn điện lực thiết bị y tế',
    actionLog: [
      'Đề xuất thay thế pack pin NiMH chính hãng và dán tem kiểm định lại'
    ]
  },
  {
    id: 'eq-6',
    code: 'SC-2026-040',
    deviceName: 'Máy thở Maquet Servo-i Universal',
    deviceModel: 'Servo-i - Getinge Maquet Sweden',
    serialNumber: 'MAQ-SERVOI-3104',
    riskClass: 'D',
    accessoryIssue: 'O2 Cell (cảm biến nồng độ oxy FiO2) bị cạn hóa chất đo sai lệch 8%',
    location: 'Khoa Hồi Sức Ngoại - Giường 03',
    urgency: 'normal',
    assignedEngineer: 'KS. Đặng Văn Nam',
    status: 'resolved',
    reportTime: '16:00 PM - 15/10/2026',
    lastInspectionDate: '05/05/2026',
    nextInspectionDue: '05/05/2027',
    inspectionUnit: 'Quatest 1',
    legalBasis: 'Nghị định 98/2021/NĐ-CP - Điều 34 Quản lý thiết bị loại D',
    actionLog: [
      'Đã thay O2 Cell chính hãng Getinge',
      'Hiệu chuẩn 2 điểm FiO2 21% và 100% đạt chuẩn',
      'Đã thử tải thông khí phổi giả 60 phút đạt chuẩn lâm sàng'
    ]
  },
  {
    id: 'eq-7',
    code: 'SC-2026-038',
    deviceName: 'Máy phá rung tim Philips HeartStart XL',
    deviceModel: 'HeartStart XL M4735A - Philips',
    serialNumber: 'PHI-HSXL-7712',
    riskClass: 'D',
    accessoryIssue: 'Hạn kiểm định đo lường năng lượng xung phóng hết hạn chu kỳ 2026',
    location: 'Phòng Hồi Tỉnh - Khu Phẫu Thuật',
    urgency: 'normal',
    assignedEngineer: 'KS. Bùi Quốc Bảo',
    status: 'inspected',
    reportTime: '09:00 AM - 13/10/2026',
    lastInspectionDate: '28/10/2025',
    nextInspectionDue: '28/10/2026 (Còn 12 ngày)',
    inspectionUnit: 'Viện Trang thiết bị và Công trình Y tế (NIEMET)',
    legalBasis: 'Nghị định 98/2021/NĐ-CP - Kiểm định định kỳ hằng năm',
    actionLog: [
      'Đã đo kiểm năng lượng phóng 50J, 100J, 200J, 360J sai số dưới 3%',
      'Hồ sơ đã chuyển cho đơn vị kiểm định dán tem chu kỳ 2026-2027'
    ]
  },
  {
    id: 'eq-8',
    code: 'SC-2026-046',
    deviceName: 'Máy đo khí máu và điện giải Radiometer ABL90 FLEX',
    deviceModel: 'ABL90 FLEX PLUS - Radiometer Denmark',
    serialNumber: 'RAD-ABL90-5541',
    riskClass: 'C',
    accessoryIssue: 'Sensor Cassette báo lỗi tắc buồng đo heparinize hút mẫu máu',
    location: 'Phòng Xét Nghiệm Nhanh ICU',
    urgency: 'warning',
    assignedEngineer: 'KS. Đặng Văn Nam',
    status: 'in_progress',
    reportTime: '04:50 AM - Báo ca đêm',
    lastInspectionDate: '10/02/2026',
    nextInspectionDue: '10/02/2027',
    inspectionUnit: 'Quatest 1',
    legalBasis: 'Nghị định 98/2021/NĐ-CP - Thiết bị xét nghiệm chẩn đoán in vitro',
    actionLog: [
      'Tiến hành chu trình Flush xả rửa tự động với dung dịch Clenz',
      'Đã thay màng lọc mẫu máu mao dẫn mới'
    ]
  },
  {
    id: 'eq-9',
    code: 'SC-2026-047',
    deviceName: 'Bình làm ẩm thở máy Fisher & Paykel MR850',
    deviceModel: 'MR850 Heated Respiratory Humidifier',
    serialNumber: 'FP-MR850-8802',
    riskClass: 'C',
    accessoryIssue: 'Đầu dò nhiệt độ dây nhiệt buồng ẩm (Heated wire probe) báo lỗi E102',
    location: 'Hồi sức tích cực ICU - Giường 04',
    urgency: 'urgent',
    assignedEngineer: 'KS. Đặng Văn Nam',
    status: 'in_progress',
    reportTime: '01:50 AM - Báo ca đêm',
    lastInspectionDate: '18/07/2026',
    nextInspectionDue: '18/07/2027',
    inspectionUnit: 'Quatest 1',
    legalBasis: 'Nghị định 98/2021/NĐ-CP - Phụ kiện thiết bị hồi sức hô hấp',
    actionLog: [
      'Cảnh báo nhiệt độ khí thở đầu vào ống nội khí quản giảm dưới 32°C',
      'Đã thay thế cụm probe nhiệt độ dự phòng chính hãng Fisher & Paykel'
    ]
  },
  {
    id: 'eq-10',
    code: 'SC-2026-037',
    deviceName: 'Máy điện tim 12 cần Nihon Kohden Cardiofax M',
    deviceModel: 'Cardiofax M ECG-1250K - Nihon Kohden Japan',
    serialNumber: 'NK-ECG12-1089',
    riskClass: 'B',
    accessoryIssue: 'Bộ dây cáp bệnh nhân 10 đầu đạo trình bị đứt ngầm dây V2-V4 gây nhiễu sóng',
    location: 'Phòng Khám Cấp Cứu 1',
    urgency: 'normal',
    assignedEngineer: 'KS. Bùi Quốc Bảo',
    status: 'resolved',
    reportTime: '11:15 AM - 12/10/2026',
    lastInspectionDate: '02/09/2026',
    nextInspectionDue: '02/09/2027',
    inspectionUnit: 'Trung tâm Đo lường Chất lượng 3',
    legalBasis: 'Nghị định 98/2021/NĐ-CP - Kiểm định tính năng kỹ thuật',
    actionLog: [
      'Đã thay dây cáp bệnh nhân 10 đạo trình chống nhiễu AC 50Hz',
      'Đã test chuẩn trên thiết bị phát tín hiệu mô phỏng ECG đạt 100%'
    ]
  }
];

export { INITIAL_INVENTORY_BATCHES } from './pharmacy/allBatches';

// Dữ liệu kiểm kê tài sản công ngày 31/12 theo Nghị định 151/2017 & NĐ 114/2024
export const INITIAL_ASSET_AUDIT_RECORDS: AssetAuditRecord[] = [
  {
    id: 'asset-1',
    code: 'TS-2026-001',
    deviceName: 'Máy thở Puritan Bennett 840 (PB840)',
    model: 'Puritan Bennett 840 - Medtronic',
    serialNumber: 'PB840-VN-2021-998',
    riskClass: 'D',
    registeredDepartment: 'Khoa Cấp Cứu A9',
    actualDepartment: 'Phòng Mổ 2 (Khu Phẫu Thuật)',
    isMisallocated: true,
    condition: 'misallocated',
    initialValueVND: 850000000,
    depreciationRatePercent: 40,
    operatingYears: 4,
    dormantMonths: 0,
    pendingLiquidation: false,
    qrScannedAt: '08:30 AM - Kiểm kê buồng mổ'
  },
  {
    id: 'asset-2',
    code: 'TS-2026-002',
    deviceName: 'Máy X-Quang di động C-Arm Shimadzu',
    model: 'OEC-9900 C-Arm System',
    serialNumber: 'SHIM-CARM-2015-11',
    riskClass: 'C',
    registeredDepartment: 'Khoa Chẩn Đoán Hình Ảnh',
    actualDepartment: 'Kho Phế Liệu Tầng Hầm Bệnh Viện',
    isMisallocated: false,
    condition: 'dormant_over_12m',
    initialValueVND: 1200000000,
    depreciationRatePercent: 95,
    operatingYears: 10,
    dormantMonths: 18,
    pendingLiquidation: false,
    liquidationReason: 'Hỏng bóng phát tia X, chi phí thay mới 240tr vượt giá trị còn lại, đắp chiếu 18 tháng',
    qrScannedAt: '09:15 AM - Kiểm kê kho phế liệu'
  },
  {
    id: 'asset-3',
    code: 'TS-2026-003',
    deviceName: 'Máy sốc tim Zoll R Series',
    model: 'Zoll R Series BLS/ALS Defibrillator',
    serialNumber: 'ZOLL-R-8831',
    riskClass: 'D',
    registeredDepartment: 'Khoa Cấp Cứu A9',
    actualDepartment: 'Khoa Cấp Cứu A9',
    isMisallocated: false,
    condition: 'operational',
    initialValueVND: 350000000,
    depreciationRatePercent: 30,
    operatingYears: 3,
    dormantMonths: 0,
    pendingLiquidation: false,
    qrScannedAt: '07:45 AM - Xe tiêm cấp cứu A9'
  },
  {
    id: 'asset-4',
    code: 'TS-2026-004',
    deviceName: 'Máy theo dõi bệnh nhân Philips MP50',
    model: 'IntelliVue MP50 Patient Monitor',
    serialNumber: 'PHI-MP50-4102',
    riskClass: 'C',
    registeredDepartment: 'Khoa Cấp Cứu A9',
    actualDepartment: 'Hồi Sức Tích Cực ICU - Giường 08',
    isMisallocated: true,
    condition: 'misallocated',
    initialValueVND: 180000000,
    depreciationRatePercent: 50,
    operatingYears: 5,
    dormantMonths: 0,
    pendingLiquidation: false,
    qrScannedAt: '08:10 AM - Quét buồng ICU'
  },
  {
    id: 'asset-5',
    code: 'TS-2026-005',
    deviceName: 'Máy điện tim 6 cần Fukuda Denshi',
    model: 'Cardimax FX-7202 ECG',
    serialNumber: 'FKD-FX7202-094',
    riskClass: 'B',
    registeredDepartment: 'Khoa Ngoại Chấn Thương',
    actualDepartment: 'Kho Vật Tư Hỏng - Phòng 104',
    isMisallocated: false,
    condition: 'broken_unrepairable',
    initialValueVND: 65000000,
    depreciationRatePercent: 100,
    operatingYears: 8,
    dormantMonths: 14,
    pendingLiquidation: true,
    liquidationReason: 'Chập cháy bo mạch nguồn chính, hãng dừng sản xuất linh kiện thay thế',
    qrScannedAt: '09:30 AM - Rà soát thiết bị loại B'
  },
  {
    id: 'asset-6',
    code: 'TS-2026-006',
    deviceName: 'Hệ thống lọc máu liên tục CRRT Prismaflex',
    model: 'Prismaflex v8.0 - Baxter',
    serialNumber: 'PRISMA-VN-2022-014',
    riskClass: 'D',
    registeredDepartment: 'Hồi Sức Tích Cực (ICU)',
    actualDepartment: 'Hồi Sức Tích Cực (ICU)',
    isMisallocated: false,
    condition: 'operational',
    initialValueVND: 980000000,
    depreciationRatePercent: 35,
    operatingYears: 3,
    dormantMonths: 0,
    pendingLiquidation: false,
    qrScannedAt: '08:45 AM - Buồng lọc máu ICU'
  },
  {
    id: 'asset-7',
    code: 'TS-2026-007',
    deviceName: 'Máy thở Maquet Servo-i Universal',
    model: 'Servo-i Universal Ventilator',
    serialNumber: 'MAQ-SERVOI-3104',
    riskClass: 'D',
    registeredDepartment: 'Khoa Hồi Sức Ngoại',
    actualDepartment: 'Khoa Hồi Sức Ngoại',
    isMisallocated: false,
    condition: 'operational',
    initialValueVND: 720000000,
    depreciationRatePercent: 45,
    operatingYears: 4,
    dormantMonths: 0,
    pendingLiquidation: false,
    qrScannedAt: '08:20 AM - Buồng Hồi Sức 3'
  },
  {
    id: 'asset-8',
    code: 'TS-2026-008',
    deviceName: 'Máy phá rung tim Philips HeartStart XL',
    model: 'HeartStart XL M4735A',
    serialNumber: 'PHI-HSXL-7712',
    riskClass: 'D',
    registeredDepartment: 'Khoa Can Thiệp Tim Mạch',
    actualDepartment: 'Phòng Hồi Tỉnh - Khu Phẫu Thuật',
    isMisallocated: true,
    condition: 'misallocated',
    initialValueVND: 220000000,
    depreciationRatePercent: 60,
    operatingYears: 6,
    dormantMonths: 0,
    pendingLiquidation: false,
    qrScannedAt: '09:05 AM - Kiểm kê khu mổ'
  },
  {
    id: 'asset-9',
    code: 'TS-2026-009',
    deviceName: 'Bơm tiêm điện B.Braun Perfusor Space',
    model: 'Perfusor Space Infusion Pump',
    serialNumber: 'BBR-PERF-9921',
    riskClass: 'C',
    registeredDepartment: 'Khoa Cấp Cứu A9',
    actualDepartment: 'Khoa Cấp Cứu A9',
    isMisallocated: false,
    condition: 'damaged_repairable',
    initialValueVND: 45000000,
    depreciationRatePercent: 50,
    operatingYears: 5,
    dormantMonths: 1,
    pendingLiquidation: false,
    qrScannedAt: '07:55 AM - Xe tiêm Cấp Cứu'
  },
  {
    id: 'asset-10',
    code: 'TS-2026-010',
    deviceName: 'Máy siêu âm tim màu 4D GE Vivid E95',
    model: 'Vivid E95 4D Ultrasound System',
    serialNumber: 'GE-VE95-2018-03',
    riskClass: 'C',
    registeredDepartment: 'Khoa Can Thiệp Tim Mạch',
    actualDepartment: 'Khoa Can Thiệp Tim Mạch',
    isMisallocated: false,
    condition: 'operational',
    initialValueVND: 1850000000,
    depreciationRatePercent: 55,
    operatingYears: 5,
    dormantMonths: 0,
    pendingLiquidation: false,
    qrScannedAt: '09:40 AM - Phòng Siêu Âm Tim'
  },
  {
    id: 'asset-11',
    code: 'TS-2026-011',
    deviceName: 'Máy hút dịch áp lực âm di động Atmos Record 55',
    model: 'Atmos Record 55 Mobile Suction',
    serialNumber: 'ATM-REC55-1022',
    riskClass: 'B',
    registeredDepartment: 'Khoa Cấp Cứu A9',
    actualDepartment: 'Kho Thiết Bị Tầng 2',
    isMisallocated: true,
    condition: 'misallocated',
    initialValueVND: 38000000,
    depreciationRatePercent: 70,
    operatingYears: 7,
    dormantMonths: 2,
    pendingLiquidation: false,
    qrScannedAt: '10:00 AM - Quét mã kho đệm'
  },
  {
    id: 'asset-12',
    code: 'TS-2026-012',
    deviceName: 'Máy ly tâm lạnh túi máu Hettich Roto Silenta 630RS',
    model: 'Roto Silenta 630RS Refrigerated Centrifuge',
    serialNumber: 'HET-ROTO-2012-01',
    riskClass: 'B',
    registeredDepartment: 'Đơn Vị Huyết Học Truyền Máu',
    actualDepartment: 'Kho Phế Liệu Tầng Hầm',
    isMisallocated: false,
    condition: 'broken_unrepairable',
    initialValueVND: 520000000,
    depreciationRatePercent: 100,
    operatingYears: 12,
    dormantMonths: 20,
    pendingLiquidation: true,
    liquidationReason: 'Vỡ buồng ly tâm kim loại, động cơ không đồng bộ rung lắc nguy hiểm, chi phí sửa chữa vượt dự toán mua mới',
    qrScannedAt: '10:15 AM - Rà soát thiết bị thanh lý'
  }
];

export const INITIAL_COLD_CHAIN_STATE: ColdChainMonitorState = {
  storageName: 'Tủ chuyên dụng bảo quản Vaccine & Sinh phẩm số 1 (Dometic HC-302)',
  currentTemp: 4.5,
  currentHumidity: 54,
  targetTempRange: '2.0°C - 8.0°C',
  powerStatus: 'main_power',
  compressorStatus: 'running',
  alarmActive: false,
  totalVaccineDoses: 1250,
  quarantineStatus: 'normal',
  logs: [
    { timestamp: '04:00 AM', temperature: 4.2, humidity: 53, status: 'normal' },
    { timestamp: '05:00 AM', temperature: 4.4, humidity: 54, status: 'normal' },
    { timestamp: '06:00 AM', temperature: 4.6, humidity: 55, status: 'normal' },
    { timestamp: '07:00 AM', temperature: 4.5, humidity: 54, status: 'normal' },
    { timestamp: '08:00 AM', temperature: 4.5, humidity: 54, status: 'normal' },
    { timestamp: '08:30 AM', temperature: 4.5, humidity: 54, status: 'normal' },
  ]
};

export const ROLE_SUGGESTION_CHIPS: Record<UserRole, QuickSuggestionChip[]> = {
  nurse: [
    {
      id: 'nurse-audit',
      label: 'Đối soát giao ban ca trực',
      fullPrompt: 'Chạy đối soát toàn bộ ca trực đêm qua và phát hiện lệch sổ giao ban 07:00 AM',
      badge: 'Giao ban',
      category: 'debt'
    },
    {
      id: 'nurse-1',
      label: 'Lấy 2 lọ Morphin buồng 3',
      fullPrompt: 'Ca đêm vừa lấy 2 lọ Morphin và 1 bộ dây truyền cấp cứu cho buồng 3',
      badge: 'Tủ trực',
      category: 'debt'
    },
    {
      id: 'nurse-2',
      label: 'Thu hồi vỏ ống Morphin',
      fullPrompt: 'Xác nhận đã thu hồi 2 vỏ ống Morphin buồng cấp cứu 3',
      badge: 'Thu vỏ TT 20',
      category: 'debt'
    },
    {
      id: 'nurse-3',
      label: 'Hoàn bù cơ số tủ trực',
      fullPrompt: 'Nộp đơn thuốc hoàn bù cơ số tủ trực cấp cứu ca trực',
      badge: 'Hoàn bù TT 22',
      category: 'debt'
    },
    {
      id: 'nurse-4',
      label: 'Rà soát sổ nợ tủ trực',
      fullPrompt: 'Kiểm tra danh mục thuốc cấp cứu đang nợ chưa hoàn bù',
      badge: 'Sổ nợ',
      category: 'debt'
    }
  ],
  biomedical_engineer: [
    {
      id: 'bme-1',
      label: 'Báo hỏng dây thở PB840',
      fullPrompt: 'Báo hỏng dây thở máy thở Bennett phòng mổ 2 bị xì khí',
      badge: 'Khẩn cấp',
      category: 'equipment'
    },
    {
      id: 'bme-2',
      label: 'Kiểm định máy sốc tim',
      fullPrompt: 'Tra cứu hạn dán tem kiểm định máy sốc tim',
      badge: 'Kiểm định',
      category: 'equipment'
    },
    {
      id: 'bme-3',
      label: 'Quét QR máy thở phòng mổ',
      fullPrompt: 'Kiểm kê tài sản 31/12: Quét mã QR máy thở PB840 tại phòng mổ 2',
      badge: 'Kiểm kê',
      category: 'asset_audit'
    },
    {
      id: 'bme-4',
      label: 'Đề xuất thanh lý máy hỏng',
      fullPrompt: 'Lập danh sách máy hỏng đề xuất thanh lý tài sản công theo NĐ 151',
      badge: 'Thanh lý',
      category: 'asset_audit'
    }
  ],
  pharmacist: [
    {
      id: 'pharm-restock',
      label: '📦 Lập dự trù bù thuốc Mẫu 01',
      fullPrompt: 'Kiểm tra các mặt hàng chạm ngưỡng Min và lập phiếu dự trù Mẫu 01/TT22',
      badge: 'Mẫu 01/TT22',
      category: 'fefo'
    },
    {
      id: 'pharm-1',
      label: 'Xuất PARACETAMOL 500mg (FEFO)',
      fullPrompt: 'Cần xuất lô PARACETAMOL 500mg cận hạn ưu tiên FEFO',
      badge: 'Xuất FEFO',
      category: 'fefo'
    },
    {
      id: 'pharm-2',
      label: 'Cảnh báo cạn kho (Min Stock)',
      fullPrompt: 'Kiểm tra danh mục thuốc và vật tư chạm ngưỡng tối thiểu',
      badge: 'Cạn kho',
      category: 'fefo'
    },
    {
      id: 'pharm-3',
      label: 'Hội đồng hủy vỏ Morphin',
      fullPrompt: 'Xác nhận đã thu hồi 2 vỏ ống Morphin buồng cấp cứu 3',
      badge: 'Hủy vỏ TT 20',
      category: 'debt'
    },
    {
      id: 'pharm-4',
      label: 'Giám sát chuỗi lạnh vắc xin',
      fullPrompt: 'Kiểm tra nhiệt độ bảo quản vắc xin dây chuyền lạnh GSP',
      badge: 'Chuỗi lạnh',
      category: 'coldchain'
    }
  ],
  doctor: [
    {
      id: 'doc-1',
      label: 'Báo hỏng dây thở PB840',
      fullPrompt: 'Báo hỏng dây thở máy thở Bennett phòng mổ 2 bị xì khí',
      badge: 'Sự cố',
      category: 'equipment'
    },
    {
      id: 'doc-2',
      label: 'Tra cứu kiểm định máy thở',
      fullPrompt: 'Tra cứu hạn dán tem kiểm định máy sốc tim',
      badge: 'Kiểm định',
      category: 'equipment'
    },
    {
      id: 'doc-3',
      label: 'Kê đơn hoàn bù Morphin',
      fullPrompt: 'Ca đêm vừa lấy 2 lọ Morphin và 1 bộ dây truyền cấp cứu cho buồng 3',
      badge: 'Đơn bù TT 22',
      category: 'debt'
    },
    {
      id: 'doc-4',
      label: 'Rà soát cơ số cấp cứu',
      fullPrompt: 'Kiểm tra danh mục thuốc và vật tư chạm ngưỡng tối thiểu',
      badge: 'Cơ số trực',
      category: 'debt'
    }
  ],
  director: [
    {
      id: 'dir-1',
      label: 'Đề xuất thanh lý máy hỏng',
      fullPrompt: 'Lập danh sách máy hỏng đề xuất thanh lý tài sản công theo NĐ 151',
      badge: 'Thanh lý',
      category: 'asset_audit'
    },
    {
      id: 'dir-2',
      label: 'Kiểm kê tài sản 31/12',
      fullPrompt: 'Kiểm kê tài sản 31/12: Quét mã QR máy thở PB840 tại phòng mổ 2',
      badge: 'Kiểm kê',
      category: 'asset_audit'
    },
    {
      id: 'dir-3',
      label: 'Cảnh báo cạn kho toàn viện',
      fullPrompt: 'Kiểm tra danh mục thuốc và vật tư chạm ngưỡng tối thiểu',
      badge: 'Định mức',
      category: 'fefo'
    },
    {
      id: 'dir-4',
      label: 'Kiểm định thiết bị loại D',
      fullPrompt: 'Tra cứu hạn dán tem kiểm định máy sốc tim',
      badge: 'Kiểm định',
      category: 'equipment'
    }
  ]
};

export const QUICK_SUGGESTION_CHIPS: QuickSuggestionChip[] = [
  {
    id: 'chip-handover-audit',
    label: 'Đối soát giao ban ca trực',
    fullPrompt: 'Chạy đối soát toàn bộ ca trực đêm qua và phát hiện lệch sổ giao ban 07:00 AM',
    badge: 'Giao ban',
    category: 'debt'
  },
  {
    id: 'chip-restock-m01',
    label: 'Lập dự trù bù thuốc Mẫu 01',
    fullPrompt: 'Kiểm tra các mặt hàng chạm ngưỡng Min và lập phiếu dự trù Mẫu 01/TT22',
    badge: 'Mẫu 01',
    category: 'fefo'
  },
  {
    id: 'chip-1',
    label: 'Lấy 2 lọ Morphin buồng 3',
    fullPrompt: 'Ca đêm vừa lấy 2 lọ Morphin và 1 bộ dây truyền cấp cứu cho buồng 3',
    badge: 'Tủ trực',
    category: 'debt'
  },
  {
    id: 'chip-2',
    label: 'Báo hỏng dây thở PB840',
    fullPrompt: 'Báo hỏng dây thở máy thở Bennett phòng mổ 2 bị xì khí',
    badge: 'Hỏng hóc',
    category: 'equipment'
  },
  {
    id: 'chip-3',
    label: 'Xuất PARACETAMOL 500mg (FEFO)',
    fullPrompt: 'Cần xuất lô PARACETAMOL 500mg cận hạn ưu tiên FEFO',
    badge: 'Xuất FEFO',
    category: 'fefo'
  },
  {
    id: 'chip-4',
    label: 'Cảnh báo cạn kho định mức',
    fullPrompt: 'Kiểm tra danh mục thuốc và vật tư chạm ngưỡng tối thiểu',
    badge: 'Cạn kho',
    category: 'fefo'
  },
  {
    id: 'chip-5',
    label: 'Quét QR máy thở phòng mổ',
    fullPrompt: 'Kiểm kê tài sản 31/12: Quét mã QR máy thở PB840 tại phòng mổ 2',
    badge: 'Kiểm kê',
    category: 'asset_audit'
  },
  {
    id: 'chip-6',
    label: 'Đề xuất thanh lý máy hỏng',
    fullPrompt: 'Lập danh sách máy hỏng đề xuất thanh lý tài sản công theo NĐ 151',
    badge: 'Thanh lý',
    category: 'asset_audit'
  },
  {
    id: 'chip-7',
    label: 'Thu hồi vỏ ống Morphin',
    fullPrompt: 'Xác nhận đã thu hồi 2 vỏ ống Morphin buồng cấp cứu 3',
    badge: 'Hủy vỏ',
    category: 'debt'
  },
  {
    id: 'chip-8',
    label: 'Kiểm định máy sốc tim',
    fullPrompt: 'Tra cứu hạn dán tem kiểm định máy sốc tim',
    badge: 'Kiểm định',
    category: 'inspection'
  }
];

export const INITIAL_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-welcome',
    sender: 'agent',
    text: 'Trợ lý nghiệp vụ lâm sàng sẵn sàng hỗ trợ bác sĩ tra cứu thông tin thuốc, quy định chuyên môn, rà soát ca bệnh và thực hiện nghiệp vụ trong hệ thống.',
    timestamp: '08:00',
    suggestedChips: [
      'Kiểm tra tương tác Clopidogrel với Omeprazol',
      'Tác dụng phụ của Paracetamol?',
      'Tra cứu liều dùng của Ceftriaxone',
      'Tra cứu số đăng ký VD-24757-16'
    ]
  }
];
