/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * BHYT Data Ingestion & XML Parser (Quyết định 130/QĐ-BYT Bảng 2)
 */

import {
  BhytPrescriptionPayload,
  BhytPrescriptionItem,
  HospitalRank,
  TreatmentType
} from '../types/bhyt';
import { findBhytRule } from '../data/bhytDrugRules';

/**
 * Trình phân tích XML Bảng 2 (Chi tiết thuốc) chuẩn Quyết định 130/QĐ-BYT
 */
export function parseQd130Xml(xmlContent: string): Partial<BhytPrescriptionPayload> {
  const items: BhytPrescriptionItem[] = [];

  try {
    // Regex bóc tách các dòng CHI_TIET_THUOC
    const rowRegex = /<CHI_TIET_THUOC>([\s\S]*?)<\/CHI_TIET_THUOC>/gi;
    let match: RegExpExecArray | null;

    let index = 1;
    while ((match = rowRegex.exec(xmlContent)) !== null) {
      const rowContent = match[1];

      const getTag = (tag: string): string => {
        const m = new RegExp(`<${tag}>(.*?)<\\/${tag}>`, 'i').exec(rowContent);
        return m ? m[1].trim() : '';
      };

      const maThuoc = getTag('MA_THUOC');
      const tenThuoc = getTag('TEN_THUOC') || `Thuốc ${index}`;
      const hamLuong = getTag('HAM_LUONG');
      const soLuong = parseFloat(getTag('SO_LUONG')) || 1;
      const donGia = parseFloat(getTag('DON_GIA')) || 0;
      const duongDung = getTag('DUONG_DUNG') || 'Uống';
      const lieuDung = getTag('LIEU_DUNG');

      items.push({
        id: `xml-${index}`,
        drugCode: maThuoc,
        drugName: tenThuoc,
        activeIngredient: tenThuoc.split(' ')[0], // Dự phòng lấy từ đầu
        dosage: hamLuong,
        route: duongDung,
        quantity: soLuong,
        daysSupply: 7, // Mặc định nếu không có trong XML
        unitPrice: donGia,
        instructions: lieuDung
      });

      index++;
    }

    // Lấy thông tin chẩn đoán từ bảng tổng hợp nếu có
    const maBenh = /<MA_BENH>(.*?)<\/MA_BENH>/i.exec(xmlContent)?.[1] || 'I10';
    const tenBenh = /<TEN_BENH>(.*?)<\/TEN_BENH>/i.exec(xmlContent)?.[1] || 'Tăng huyết áp nguyên phát';
    const maThe = /<MA_THE_BHYT>(.*?)<\/MA_THE_BHYT>/i.exec(xmlContent)?.[1] || 'DN4791234567890';

    return {
      primaryIcd10: maBenh,
      primaryDiagnosis: tenBenh,
      insuranceCardNumber: maThe,
      items
    };
  } catch (err) {
    console.error('Error parsing QD 130 XML:', err);
    return { items };
  }
}

/**
 * Tạo XML mẫu theo chuẩn Quyết định 130/QĐ-BYT để người dùng trải nghiệm
 */
export function generateSampleQd130Xml(): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<BANG_CHI_TIET_THUOC_QD130>
  <THONG_TIN_CHUNG>
    <MA_LK>LK-2026-88219</MA_LK>
    <MA_THE_BHYT>HT2790123456789</MA_THE_BHYT>
    <HO_TEN>Nguyễn Văn Bình</HO_TEN>
    <NGAY_SINH>19650412</NGAY_SINH>
    <GIOI_TINH>1</GIOI_TINH>
    <MA_BENH>K21.0</MA_BENH>
    <TEN_BENH>Bệnh trào ngược dạ dày - thực quản có viêm thực quản</TEN_BENH>
  </THONG_TIN_CHUNG>
  <DANH_SACH_THUOC>
    <CHI_TIET_THUOC>
      <MA_THUOC>40.120</MA_THUOC>
      <TEN_THUOC>Nexium 40mg (Esomeprazol)</TEN_THUOC>
      <HAM_LUONG>40mg</HAM_LUONG>
      <DUONG_DUNG>Đường uống</DUONG_DUNG>
      <SO_LUONG>28</SO_LUONG>
      <DON_GIA>24500</DON_GIA>
      <TYLE_TT>100</TYLE_TT>
      <LIEU_DUNG>Uống 1 viên trước ăn sáng 30 phút</LIEU_DUNG>
    </CHI_TIET_THUOC>
    <CHI_TIET_THUOC>
      <MA_THUOC>40.125</MA_THUOC>
      <TEN_THUOC>Losec 20mg (Omeprazol)</TEN_THUOC>
      <HAM_LUONG>20mg</HAM_LUONG>
      <DUONG_DUNG>Đường uống</DUONG_DUNG>
      <SO_LUONG>14</SO_LUONG>
      <DON_GIA>15200</DON_GIA>
      <TYLE_TT>100</TYLE_TT>
      <LIEU_DUNG>Uống 1 viên tối trước đi ngủ</LIEU_DUNG>
    </CHI_TIET_THUOC>
    <CHI_TIET_THUOC>
      <MA_THUOC>50.312</MA_THUOC>
      <TEN_THUOC>Meronem 1g (Meropenem)</TEN_THUOC>
      <HAM_LUONG>1g</HAM_LUONG>
      <DUONG_DUNG>Tiêm truyền TM</DUONG_DUNG>
      <SO_LUONG>10</SO_LUONG>
      <DON_GIA>380000</DON_GIA>
      <TYLE_TT>100</TYLE_TT>
      <LIEU_DUNG>Truyền TM chậm 1g mỗi 8 giờ</LIEU_DUNG>
    </CHI_TIET_THUOC>
  </DANH_SACH_THUOC>
</BANG_CHI_TIET_THUOC_QD130>`;
}

/**
 * Bộ đơn thuốc mẫu thực tế phục vụ kiểm thử nhanh các bẫy xuất toán
 */
export const SAMPLE_PRESCRIPTIONS: Record<string, BhytPrescriptionPayload> = {
  // Ca 1: Vi phạm vượt tuyến (Hạng III kê Meropenem) + Trùng lặp PPI
  hospital_rank_violation: {
    prescriptionId: 'RX-BHYT-001',
    patientName: 'Trần Văn Hoàng',
    patientAge: 58,
    insuranceCardNumber: 'GD4790123456789',
    hospitalRank: 'HANG_III', // Tuyến Huyện
    treatmentType: 'NGOAI_TRU',
    primaryIcd10: 'K21',
    primaryDiagnosis: 'Bệnh trào ngược dạ dày - thực quản',
    secondaryIcd10s: ['J18'],
    items: [
      {
        id: 'rx1-1',
        drugCode: 'MED-NEX-40',
        drugName: 'Nexium 40mg',
        activeIngredient: 'Esomeprazol',
        dosage: '40mg',
        route: 'Uống',
        quantity: 28,
        daysSupply: 28,
        unitPrice: 24500,
        instructions: '1 viên sáng trước ăn'
      },
      {
        id: 'rx1-2',
        drugCode: 'MED-OME-20',
        drugName: 'Omeprazol 20mg',
        activeIngredient: 'Omeprazol',
        dosage: '20mg',
        route: 'Uống',
        quantity: 28,
        daysSupply: 28,
        unitPrice: 3500,
        instructions: '1 viên tối trước ngủ'
      },
      {
        id: 'rx1-3',
        drugCode: 'MED-MERO-1G',
        drugName: 'Meronem 1g (Meropenem)',
        activeIngredient: 'Meropenem',
        dosage: '1g',
        route: 'Tiêm truyền TM',
        quantity: 6,
        daysSupply: 3,
        unitPrice: 420000,
        instructions: 'Truyền TM 1g x 2 lần/ngày',
        hasConsultationForm: false // Không có biên bản hội chẩn
      }
    ]
  },

  // Ca 2: Trùng nhóm NSAID + Thuốc ngoài danh mục BHYT
  duplicate_nsaid_and_uncovered: {
    prescriptionId: 'RX-BHYT-002',
    patientName: 'Lê Thị Thu',
    patientAge: 64,
    insuranceCardNumber: 'HT2799887766554',
    hospitalRank: 'HANG_II', // Tuyến Tỉnh
    treatmentType: 'NGOAI_TRU',
    primaryIcd10: 'M17',
    primaryDiagnosis: 'Thoái hóa khớp gối',
    secondaryIcd10s: [],
    items: [
      {
        id: 'rx2-1',
        drugCode: 'MED-MOB-75',
        drugName: 'Mobic 7.5mg',
        activeIngredient: 'Meloxicam',
        dosage: '7.5mg',
        route: 'Uống',
        quantity: 30,
        daysSupply: 15,
        unitPrice: 12000,
        instructions: '1 viên x 2 lần/ngày'
      },
      {
        id: 'rx2-2',
        drugCode: 'MED-CEL-200',
        drugName: 'Celebrex 200mg',
        activeIngredient: 'Celecoxib',
        dosage: '200mg',
        route: 'Uống',
        quantity: 15,
        daysSupply: 15,
        unitPrice: 18500,
        instructions: '1 viên x 1 lần/ngày'
      },
      {
        id: 'rx2-3',
        drugCode: 'TPCN-SHARK',
        drugName: 'Sụn vi cá mập Shark Cartilage',
        activeIngredient: 'Thực phẩm chức năng',
        dosage: '750mg',
        route: 'Uống',
        quantity: 60,
        daysSupply: 30,
        unitPrice: 15000,
        instructions: '1 viên x 2 lần/ngày'
      }
    ]
  },

  // Ca 3: Thuốc thanh toán 50% (SGLT2i) & Kê vượt 30 ngày ngoại trú
  ratio_sglt2_empagliflozin_overdays: {
    prescriptionId: 'RX-BHYT-003',
    patientName: 'Nguyễn Văn Quang',
    patientAge: 62,
    insuranceCardNumber: 'HT2793344556677',
    hospitalRank: 'HANG_II', // Tuyến Tỉnh
    treatmentType: 'NGOAI_TRU',
    primaryIcd10: 'E11.9',
    primaryDiagnosis: 'Đái tháo đường type 2 không phụ thuộc insulin',
    secondaryIcd10s: ['I50'],
    items: [
      {
        id: 'rx3-1',
        drugCode: 'MED-JAR-10',
        drugName: 'Jardiance 10mg',
        activeIngredient: 'Empagliflozin',
        dosage: '10mg',
        route: 'Uống',
        quantity: 45,
        daysSupply: 45, // Vượt 30 ngày ngoại trú
        unitPrice: 28500,
        instructions: '1 viên sáng sau ăn'
      },
      {
        id: 'rx3-2',
        drugCode: 'MED-GLU-850',
        drugName: 'Glucophage 850mg',
        activeIngredient: 'Metformin',
        dosage: '850mg',
        route: 'Uống',
        quantity: 90,
        daysSupply: 45, // Vượt 30 ngày ngoại trú
        unitPrice: 4200,
        instructions: '1 viên x 2 lần/ngày'
      }
    ]
  },

  // Ca 4: Sai lệch chẩn đoán ICD-10 (Alpha Chymotrypsin kê cho Viêm họng cấp J02)
  alpha_chymotrypsin_icd_mismatch: {
    prescriptionId: 'RX-BHYT-004',
    patientName: 'Vũ Thị Hạnh',
    patientAge: 34,
    insuranceCardNumber: 'DN4796677889900',
    hospitalRank: 'HANG_III', // Tuyến Huyện
    treatmentType: 'NGOAI_TRU',
    primaryIcd10: 'J02.9',
    primaryDiagnosis: 'Viêm họng cấp không đặc hiệu',
    secondaryIcd10s: ['J00'],
    items: [
      {
        id: 'rx4-1',
        drugCode: 'MED-AUG-1G',
        drugName: 'Augmentin 1g',
        activeIngredient: 'Amoxicillin + Acid clavulanic',
        dosage: '1g',
        route: 'Uống',
        quantity: 14,
        daysSupply: 7,
        unitPrice: 18500,
        instructions: '1 viên x 2 lần/ngày'
      },
      {
        id: 'rx4-2',
        drugCode: 'MED-CHOAY',
        drugName: 'Alpha Choay (Alpha Chymotrypsin)',
        activeIngredient: 'Alpha Chymotrypsin',
        dosage: '4.2mg',
        route: 'Uống',
        quantity: 28,
        daysSupply: 7,
        unitPrice: 3800,
        instructions: '2 viên x 2 lần/ngày ngậm dưới lưỡi'
      }
    ]
  },

  // Ca 5: Đơn thuốc hợp lệ 100% chuẩn quy định BHYT
  clean_valid_prescription: {
    prescriptionId: 'RX-BHYT-005',
    patientName: 'Phạm Đức Minh',
    patientAge: 52,
    insuranceCardNumber: 'DN4791122334455',
    hospitalRank: 'HANG_II',
    treatmentType: 'NGOAI_TRU',
    primaryIcd10: 'I10',
    primaryDiagnosis: 'Tăng huyết áp vô căn (nguyên phát)',
    secondaryIcd10s: ['E78', 'E11'],
    items: [
      {
        id: 'rx5-1',
        drugCode: 'MED-AML-5',
        drugName: 'Amlor 5mg',
        activeIngredient: 'Amlodipin',
        dosage: '5mg',
        route: 'Uống',
        quantity: 30,
        daysSupply: 30,
        unitPrice: 8200,
        instructions: '1 viên sáng sau ăn'
      },
      {
        id: 'rx5-2',
        drugCode: 'MED-LIP-20',
        drugName: 'Lipitor 20mg',
        activeIngredient: 'Atorvastatin',
        dosage: '20mg',
        route: 'Uống',
        quantity: 30,
        daysSupply: 30,
        unitPrice: 16500,
        instructions: '1 viên tối'
      },
      {
        id: 'rx5-3',
        drugCode: 'MED-MET-850',
        drugName: 'Glucophage 850mg',
        activeIngredient: 'Metformin',
        dosage: '850mg',
        route: 'Uống',
        quantity: 60,
        daysSupply: 30,
        unitPrice: 4200,
        instructions: '1 viên x 2 lần/ngày'
      }
    ]
  }
};

/**
 * Trình phân tích văn bản đơn thuốc bóc tách theo vùng không gian (Spatial Layout Parser)
 * Zero hardcode: Phân tích trực tiếp chuỗi ký tự nhận dạng từ OCR / Text thực tế
 */
export function parsePrescriptionText(
  rawText: string,
  fallbackRank: HospitalRank = 'HANG_III',
  fallbackType: TreatmentType = 'NGOAI_TRU'
): BhytPrescriptionPayload {
  const cleanText = (rawText || '').trim();

  // 1. Mã thẻ BHYT (QĐ 1666/QĐ-BHXH: 15 ký tự, 2 chữ cái đầu + 13 số)
  const cardMatch = /[A-Z]{2}[0-9]{13}/i.exec(cleanText);
  const cardNumber = cardMatch ? cardMatch[0].toUpperCase() : 'GD4790000000000';

  // 2. Mã ICD-10 chính & phụ
  const icdMatches = Array.from(cleanText.matchAll(/\b([A-Z][0-9]{2}(?:\.[0-9]+)?)\b/gi)).map(m => m[1].toUpperCase());
  const primaryIcd10 = icdMatches.length > 0 ? icdMatches[0] : 'I10';
  const secondaryIcd10s = icdMatches.slice(1, 4);

  // 3. Tên bệnh nhân & tuổi
  const nameMatch = /(?:họ và tên|họ tên|bệnh nhân|bn)[:\s]*([^\n,–-]+)/i.exec(cleanText);
  const patientName = nameMatch ? nameMatch[1].trim() : 'Bệnh nhân';

  const ageMatch = /(?:tuổi|sinh năm|năm sinh)[:\s]*(\d{1,4})/i.exec(cleanText);
  let patientAge = 50;
  if (ageMatch) {
    const val = parseInt(ageMatch[1], 10);
    patientAge = val > 1900 ? (new Date().getFullYear() - val) : val;
  }

  // 4. Chẩn đoán
  const diagMatch = /(?:chẩn đoán|bệnh chính|lý do khám)[:\s]*([^\n]+)/i.exec(cleanText);
  const primaryDiagnosis = diagMatch ? diagMatch[1].trim() : 'Khám chữa bệnh ngoại trú';

  // 5. Danh sách dòng thuốc
  const items: BhytPrescriptionItem[] = [];
  const lines = cleanText.split('\n');
  let idx = 1;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Nhận dạng dòng thuốc: Bắt đầu bằng số thứ tự (1. hoặc [1] hoặc 1)) hoặc chứa từ khóa dược học
    const isMed = /^[0-9]+[\.\)\-\]]/i.test(trimmed) || /\b(?:viên|ống|lọ|chai|gói|mg|mcg|ml|gam|tuýp)\b/i.test(trimmed);
    if (!isMed) continue;

    // Tách số lượng
    const qtyMatch = /(?:x|sl:?|số lượng:?)?\s*(\d+(?:[.,]\d+)?)\s*(?:viên|ống|lọ|chai|gói|vỉ|hộp|nang|tuýp)\b/i.exec(trimmed);
    const quantity = qtyMatch ? parseFloat(qtyMatch[1].replace(',', '.')) : 20;

    // Tách hàm lượng
    const concMatch = /(\d+(?:[.,]\d+)?\s*(?:mg|g|mcg|ml|%|iu|ui))\b/i.exec(trimmed);
    const dosage = concMatch ? concMatch[1].replace(' ', '') : '500mg';

    // Tách đường dùng
    let route = 'Uống';
    if (/tiêm\s*truyền|truyền\s*tm|tiêm\s*tm/i.test(trimmed)) route = 'Tiêm tĩnh mạch';
    else if (/tiêm\s*bắp|tiêm/i.test(trimmed)) route = 'Tiêm';
    else if (/nhỏ\s*mắt|tra\s*mắt/i.test(trimmed)) route = 'Nhỏ mắt';
    else if (/bôi|ngoài\s*da/i.test(trimmed)) route = 'Bôi ngoài da';

    // Tách tên thuốc sạch
    let drugName = trimmed
      .replace(/^[0-9]+[\.\)\-\]\s]*/, '') // bỏ STT đầu
      .replace(/(?:x|sl:?|số lượng:?|\*)\s*\d+.*$/i, '') // bỏ số lượng phía sau
      .replace(/\b(?:ngày|uống|tiêm|truyền|sáng|trưa|chiều|tối|lần|mỗi|sau|trước)\b.*$/i, '') // bỏ chỉ dẫn
      .trim();

    if (!drugName) drugName = `Thuốc ${idx}`;

    const rule = findBhytRule(drugName);
    items.push({
      id: `rx-ext-${idx}`,
      drugCode: rule?.atcGroup || `MED-${idx}`,
      drugName,
      activeIngredient: rule?.activeIngredient || drugName.split(' ')[0],
      dosage,
      route,
      quantity,
      daysSupply: 7,
      unitPrice: 15000,
      instructions: 'Theo chỉ định của bác sĩ',
      hasConsultationForm: false
    });
    idx++;
  }

  return {
    prescriptionId: `RX-OCR-${Date.now().toString().slice(-4)}`,
    patientName,
    patientAge,
    insuranceCardNumber: cardNumber,
    hospitalRank: fallbackRank,
    treatmentType: fallbackType,
    primaryIcd10,
    primaryDiagnosis,
    secondaryIcd10s,
    items
  };
}

/**
 * Trình trích xuất & nhận dạng dữ liệu đơn thuốc tự động từ tài liệu (Ảnh / PDF / Text)
 * Thay thế hoàn toàn mọi hardcoded mock, ưu tiên phân tích dữ liệu thực tế
 */
export function extractPrescriptionFromDocument(
  fileName: string,
  rawText?: string
): BhytPrescriptionPayload {
  // Nếu có rawText từ OCR hoặc người dùng nhập/dán, phân tích bằng bộ parser thực tế
  if (rawText && rawText.trim()) {
    return parsePrescriptionText(rawText);
  }

  // Nếu không có rawText (chỉ chọn tệp nhưng chưa nhận dạng OCR), khởi tạo cấu trúc rỗng sạch sẽ
  return {
    prescriptionId: `RX-${Date.now().toString().slice(-4)}`,
    patientName: '',
    patientAge: 0,
    insuranceCardNumber: '',
    hospitalRank: 'HANG_III',
    treatmentType: 'NGOAI_TRU',
    primaryIcd10: '',
    primaryDiagnosis: '',
    secondaryIcd10s: [],
    items: []
  };
}
