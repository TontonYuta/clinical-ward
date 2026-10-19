/**
 * CLINICAL MACROS & ICD-10 ABBREVIATION DICTIONARY
 * 
 * Bộ từ điển gõ tắt Y khoa thông minh & Chuẩn hóa thuật ngữ chẩn đoán lâm sàng
 * Căn cứ:
 * - Bảng phân loại bệnh tật quốc tế ICD-10 (WHO & Quyết định 7603/QĐ-BYT)
 * - Cấu trúc dữ liệu Y tế HL7 FHIR (Condition, Observation, MedicationRequest)
 * - Thông tư 51/2017/TT-BYT (Xử trí sốc phản vệ khẩn cấp)
 * - Thông tư 20/2017/TT-BYT & TT 22/2011/TT-BYT (Quản lý thuốc tủ trực cấp cứu)
 */

export interface ClinicalMacro {
  /** Từ viết tắt / Shortcut kích hoạt autocomplete (VD: "THA", "NMCT", "PUV") */
  shortcut: string;
  /** Tên bệnh / Thuật ngữ lâm sàng đầy đủ kèm mã ICD-10 hoặc Thông tư */
  expansion: string;
  /** Mã ICD-10 tương ứng (nếu có) */
  icd10?: string;
  /** Nhóm chuyên khoa lâm sàng */
  category: 'Tim mạch' | 'Hô hấp' | 'Cấp cứu - Chống độc' | 'Nội tiết - Chuyển hóa' | 'Tiêu hóa' | 'Thần kinh' | 'Thuốc & Y lệnh';
  /** Chuẩn tài nguyên HL7 FHIR */
  fhirResource: 'Condition' | 'MedicationRequest' | 'Observation' | 'Procedure';
  /** Gợi ý câu lệnh mẫu cho Chatbot AI / Y lệnh mượn khẩn */
  suggestedPrompt: string;
  /** Mô tả vắn tắt / Mức độ ưu tiên */
  description: string;
}

export const CLINICAL_MACROS: ClinicalMacro[] = [
  // 1. CẤP CỨU - CHỐNG ĐỘC
  {
    shortcut: 'PUV',
    expansion: 'Phản vệ do thuốc độ 2 theo Thông tư 51/2017/TT-BYT',
    icd10: 'T88.6',
    category: 'Cấp cứu - Chống độc',
    fhirResource: 'Condition',
    suggestedPrompt: 'Lấy gấp 1 ống Adrenalin 1mg tiêm bắp xử trí phản vệ độ 2 theo TT 51',
    description: 'Tối khẩn: Tiêm bắp Adrenalin ngay lập tức vào mặt trước ngoài đùi'
  },
  {
    shortcut: 'PUV3',
    expansion: 'Sốc phản vệ độ 3 (Nguy kịch hô hấp & tuần hoàn) - TT 51/2017/TT-BYT',
    icd10: 'T78.2',
    category: 'Cấp cứu - Chống độc',
    fhirResource: 'Condition',
    suggestedPrompt: 'Báo động đỏ: Sốc phản vệ độ 3 cần Adrenalin 1mg và dịch truyền Lactate Ringer',
    description: 'Tụt huyết áp, mạch nhanh nhỏ, khó thở thanh quản'
  },
  {
    shortcut: 'NGDT',
    expansion: 'Ngộ độc cấp thuốc tê toàn thân (LAST) - Truyền Lipid 20%',
    icd10: 'T41.3',
    category: 'Cấp cứu - Chống độc',
    fhirResource: 'Condition',
    suggestedPrompt: 'Xuất 1 chai Lipid 20% 500ml cấp cứu ngộ độc thuốc tê',
    description: 'Hồi sức ngộ độc thuốc tê cục bộ bằng nhũ dịch Lipid 20%'
  },
  {
    shortcut: 'SHH',
    expansion: 'Suy hô hấp cấp tiến triển [ICD-10: J96.0]',
    icd10: 'J96.0',
    category: 'Cấp cứu - Chống độc',
    fhirResource: 'Condition',
    suggestedPrompt: 'Bệnh nhân suy hô hấp cấp SpO2 82% cần máy thở dự phòng và bóng Ambu',
    description: 'Chỉ định thở oxy mask túi hoặc đặt nội khí quản hỗ trợ thông khí'
  },
  {
    shortcut: 'ARDS',
    expansion: 'Hội chứng suy hô hấp cấp tiến triển người lớn [ICD-10: J80]',
    icd10: 'J80',
    category: 'Cấp cứu - Chống độc',
    fhirResource: 'Condition',
    suggestedPrompt: 'Điều phối máy thở đa năng PB840 cài đặt PEEP cao cho bệnh nhân ARDS',
    description: 'Tổn thương phế nang lan tỏa, PaO2/FiO2 <= 300'
  },
  {
    shortcut: 'STC',
    expansion: 'Sốc tim do suy bơm cấp tính [ICD-10: R57.0]',
    icd10: 'R57.0',
    category: 'Cấp cứu - Chống độc',
    fhirResource: 'Condition',
    suggestedPrompt: 'Bệnh nhân sốc tim huyết áp tụt 70/40 mmHg cần bơm tiêm điện Noradrenalin',
    description: 'Thiếu tưới máu mô thứ phát sau nhồi máu hoặc rối loạn nhịp nặng'
  },

  // 2. TIM MẠCH
  {
    shortcut: 'THA',
    expansion: 'Tăng huyết áp vô căn (Cơn tăng huyết áp khẩn cấp) [ICD-10: I10]',
    icd10: 'I10',
    category: 'Tim mạch',
    fhirResource: 'Condition',
    suggestedPrompt: 'Bệnh nhân THA huyết áp 200/110 mmHg cần hạ áp khẩn',
    description: 'Tăng huyết áp nguyên phát kịch phát cần kiểm soát khẩn cấp'
  },
  {
    shortcut: 'NMCT',
    expansion: 'Nhồi máu cơ tim cấp có ST chênh lên [ICD-10: I21.0]',
    icd10: 'I21.0',
    category: 'Tim mạch',
    fhirResource: 'Condition',
    suggestedPrompt: 'Bệnh nhân NMCT cấp buồng mổ cần 1 ống Morphin 10mg giảm đau và máy sốc tim',
    description: 'Tắc nghẽn hoàn toàn động mạch vành cấp tính'
  },
  {
    shortcut: 'RN',
    expansion: 'Rung nhĩ kịch phát có đáp ứng tần số thất nhanh [ICD-10: I48.0]',
    icd10: 'I48.0',
    category: 'Tim mạch',
    fhirResource: 'Condition',
    suggestedPrompt: 'Xuất 2 ống Amiodarone 150mg tiêm tĩnh mạch kiểm soát nhịp rung nhĩ',
    description: 'Rối loạn nhịp trên thất phổ biến đe dọa huyết động'
  },
  {
    shortcut: 'SNT',
    expansion: 'Hội chứng suy nút xoang / Nhịp tim chậm xoang nặng [ICD-10: I49.5]',
    icd10: 'I49.5',
    category: 'Tim mạch',
    fhirResource: 'Condition',
    suggestedPrompt: 'Lấy 2 ống Atropin sulfat 0.25mg cấp cứu nhịp chậm xoang 35 l/p',
    description: 'Nút xoang phát nhịp dưới 40 nhịp/phút kèm choáng váng'
  },
  {
    shortcut: 'PTP',
    expansion: 'Phù phổi cấp huyết động [ICD-10: J81]',
    icd10: 'J81',
    category: 'Tim mạch',
    fhirResource: 'Condition',
    suggestedPrompt: 'Bệnh nhân phù phổi cấp cần 2 ống Furosemid 20mg tiêm TM và thở CPAP',
    description: 'Trào bọt hồng, khó thở dữ dội, phổi nhiều ran ẩm to nhỏ hạt'
  },

  // 3. HÔ HẤP
  {
    shortcut: 'COPD',
    expansion: 'Đợt cấp bệnh phổi tắc nghẽn mạn tính [ICD-10: J44.1]',
    icd10: 'J44.1',
    category: 'Hô hấp',
    fhirResource: 'Condition',
    suggestedPrompt: 'Bệnh nhân đợt cấp COPD khó thở co kéo cần khí dung Salbutamol và máy hút đờm',
    description: 'Đợt bùng phát khó thở mạn tính tăng tiết đờm'
  },
  {
    shortcut: 'HPQ',
    expansion: 'Cơn hen phế quản ác tính cấp cứu [ICD-10: J45.9]',
    icd10: 'J45.9',
    category: 'Hô hấp',
    fhirResource: 'Condition',
    suggestedPrompt: 'Cơn hen phế quản nặng SpO2 88% cần khí dung giãn phế quản và Solu-Medrol',
    description: 'Co thắt phế quản lan tỏa đáp ứng kém với thuốc xịt thông thường'
  },
  {
    shortcut: 'TKMP',
    expansion: 'Tràn khí màng phổi tự phát áp lực [ICD-10: J93.0]',
    icd10: 'J93.0',
    category: 'Hô hấp',
    fhirResource: 'Condition',
    suggestedPrompt: 'Bệnh nhân tràn khí màng phổi áp lực cần chọc hút kim lớn liên sườn 2',
    description: 'Khí màng phổi tăng áp gây xẹp phổi và đè sụp tĩnh mạch chủ'
  },

  // 4. TIÊU HÓA - NỘI TIẾT
  {
    shortcut: 'XHTH',
    expansion: 'Xuất huyết tiêu hóa trên cấp tính do loét [ICD-10: K25.0]',
    icd10: 'K25.0',
    category: 'Tiêu hóa',
    fhirResource: 'Condition',
    suggestedPrompt: 'Bệnh nhân XHTH nôn máu tươi cần 2 lọ Esomeprazole 40mg và dây truyền tĩnh mạch',
    description: 'Mất máu tiêu hóa trên cấp tính cần bù thể tích và ức chế bơm proton'
  },
  {
    shortcut: 'VTTC',
    expansion: 'Viêm tụy cấp thể hoại tử nặng [ICD-10: K85.9]',
    icd10: 'K85.9',
    category: 'Tiêu hóa',
    fhirResource: 'Condition',
    suggestedPrompt: 'Bệnh nhân viêm tụy cấp đau dữ dội vùng thượng vị cần truyền dịch thể tích lớn',
    description: 'Tăng men amylase/lipase máu trên 3 lần kèm đau bụng cấp'
  },
  {
    shortcut: 'DTĐ2',
    expansion: 'Đái tháo đường type 2 có biến chứng cấp tính [ICD-10: E11.9]',
    icd10: 'E11.9',
    category: 'Nội tiết - Chuyển hóa',
    fhirResource: 'Condition',
    suggestedPrompt: 'Bệnh nhân ĐTĐ type 2 đường huyết mao mạch 28 mmol/L cần bơm tiêm điện Insulin',
    description: 'Tăng áp lực thẩm thấu hoặc toan ceton do đái tháo đường'
  },
  {
    shortcut: 'HĐH',
    expansion: 'Hạ đường huyết cấp tính hôn mê [ICD-10: E16.2]',
    icd10: 'E16.2',
    category: 'Nội tiết - Chuyển hóa',
    fhirResource: 'Condition',
    suggestedPrompt: 'Bệnh nhân hạ đường huyết 1.8 mmol/L vã mồ hôi cần truyền 50ml Glucose 30%',
    description: 'Đường huyết dưới 3.9 mmol/L kèm triệu chứng thần kinh thực vật'
  },

  // 5. THẦN KINH - TÂM THẦN
  {
    shortcut: 'TBMMN',
    expansion: 'Tai biến mạch máu não / Nhồi máu não cấp [ICD-10: I63.9]',
    icd10: 'I63.9',
    category: 'Thần kinh',
    fhirResource: 'Condition',
    suggestedPrompt: 'Bệnh nhân đột quỵ giờ thứ 2 yếu nửa người cần theo dõi monitor liên tục',
    description: 'Khiếm khuyết thần kinh khu trú khởi phát đột ngột trong cửa sổ vàng'
  },
  {
    shortcut: 'CG',
    expansion: 'Cơn co giật toàn thể liên tục / Động kinh [ICD-10: G40.9]',
    icd10: 'G40.9',
    category: 'Thần kinh',
    fhirResource: 'Condition',
    suggestedPrompt: 'Tiêm tĩnh mạch chậm 1 ống Diazepam 10mg cho bệnh nhân co giật',
    description: 'Co cứng co giật toàn thân kéo dài trên 5 phút'
  },
  {
    shortcut: 'GCS',
    expansion: 'Đánh giá thang điểm hôn mê Glasgow Coma Scale [LOINC: 9269-2]',
    icd10: 'R40.2',
    category: 'Thần kinh',
    fhirResource: 'Observation',
    suggestedPrompt: 'GCS bệnh nhân giảm xuống 8 điểm chỉ định đặt ống nội khí quản bảo vệ đường thở',
    description: 'Thang điểm tri giác 3-15 điểm đánh giá mắt, lời nói, vận động'
  },

  // 6. THUỐC VÀ DỤNG CỤ TỐI KHẨN (Y LỆNH GIAO BAN)
  {
    shortcut: 'MOR',
    expansion: 'Morphin hydroclorid 10mg/1ml (Gây nghiện TT 20/2017) [ICD-10: T40.2]',
    category: 'Thuốc & Y lệnh',
    fhirResource: 'MedicationRequest',
    suggestedPrompt: 'Cho 1 lọ morphin 10mg tiêm bắp giảm đau cấp cứu cho bệnh nhân',
    description: 'Giảm đau trung ương bậc 3 - Bắt buộc thu hồi vỏ ống nguyên vẹn theo TT 20'
  },
  {
    shortcut: 'FEN',
    expansion: 'Fentanyl citrate 0.1mg/2ml (Gây nghiện TT 20/2017)',
    category: 'Thuốc & Y lệnh',
    fhirResource: 'MedicationRequest',
    suggestedPrompt: 'Bệnh nhân phòng mổ cần 2 ống Fentanyl 0.1mg khởi mê khẩn cấp',
    description: 'Thuốc giảm đau gây mê cực mạnh (mạnh gấp 100 lần Morphin)'
  },
  {
    shortcut: 'ADR',
    expansion: 'Adrenalin (Epinephrine) 1mg/1ml (Tối khẩn Thông tư 51)',
    category: 'Thuốc & Y lệnh',
    fhirResource: 'MedicationRequest',
    suggestedPrompt: 'Lấy khẩn cấp 1 ống Adrenalin 1mg tiêm bắp',
    description: 'Thuốc đầu tay bắt buộc trong hộp thuốc chống sốc phản vệ'
  },
  {
    shortcut: 'DIAZ',
    expansion: 'Diazepam 10mg/2ml (Thuốc hướng thần TT 20/2017)',
    category: 'Thuốc & Y lệnh',
    fhirResource: 'MedicationRequest',
    suggestedPrompt: 'Tiêm tĩnh mạch 1 ống Diazepam 10mg cắt cơn kích động hoặc co giật',
    description: 'Thuốc an thần chống co giật nhóm Benzodiazepine'
  },
  {
    shortcut: 'KCL',
    expansion: 'Kali Clorid 10% 10ml (Thuốc cảnh báo cao High-Alert ISMP)',
    category: 'Thuốc & Y lệnh',
    fhirResource: 'MedicationRequest',
    suggestedPrompt: 'Pha 1 ống Kali clorid 10% vào 500ml NaCl 0.9% truyền tĩnh mạch chậm có máy đếm giọt',
    description: 'CẢNH BÁO NGUY HIỂM: Tuyệt đối KHÔNG tiêm tĩnh mạch trực tiếp (nguy cơ ngừng tim đột ngột)'
  }
];

/**
 * Tìm kiếm macro theo từ khóa / shortcut
 */
export function searchClinicalMacros(query: string, maxResults: number = 6): ClinicalMacro[] {
  const cleanQuery = query.trim().toLowerCase().replace(/^\//, '');
  if (!cleanQuery) return CLINICAL_MACROS.slice(0, maxResults);

  return CLINICAL_MACROS.filter((item) => {
    const matchShortcut = item.shortcut.toLowerCase().includes(cleanQuery);
    const matchExpansion = item.expansion.toLowerCase().includes(cleanQuery);
    const matchIcd = item.icd10?.toLowerCase().includes(cleanQuery);
    const matchCat = item.category.toLowerCase().includes(cleanQuery);
    return matchShortcut || matchExpansion || matchIcd || matchCat;
  }).slice(0, maxResults);
}
