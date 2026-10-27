/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dữ Liệu Đơn Thuốc Điện Tử Bác Sĩ CPOE - 100% Đồng bộ Sổ Nợ Vỏ & CSDL 55k Thuốc Cục QLD (<=200 LOC)
 */

import { PrescriptionOrder } from '../types/cpoe';

export const INITIAL_PRESCRIPTIONS: PrescriptionOrder[] = [
  {
    id: 'RX-2026-001', prescriptionType: 'inpatient_daily', patientId: 'BN-8820', patientName: 'Võ Minh Trí',
    patientCccd: '001201019283', patientDob: '1975-06-12', patientGender: 'Nam', department: 'Khoa Cấp Cứu A9',
    roomBed: 'Buồng cấp cứu 3 - Giường 02', diagnosisIcd10: 'I21.9', diagnosisText: 'Nhồi máu cơ tim cấp (Bù cơ số PN-2026-089 & 090)',
    isChronicDisease: false, daysPrescribed: 1, doctorName: 'BS. Trần Văn Hùng', doctorCertificate: '009125/BYT-CCHN',
    prescribedAt: '2026-10-24 02:00:00', digitalSignature: 'SHA256:7f83b1a89c02 (Đã ký số TT 26)', status: 'signed',
    items: [
      { id: 'rxi-1', medicationName: 'Morphin (Morphin hydroclorid 10mg/ml)', activeIngredient: 'Morphin hydroclorid - SĐK: 893111093823', dosage: '10mg/ml', frequency: 'Tiêm chậm cấp cứu', route: 'Tiêm tĩnh mạch', quantity: 2, unit: 'Ống', instructions: 'Tiêm tĩnh mạch chậm, thu hồi vỏ ống theo TT 20/2017', isNarcotic: true },
      { id: 'rxi-2', medicationName: 'Kali clorid 10%', activeIngredient: 'Kali clorid - SĐK: 893110375223', dosage: '1g/10ml', frequency: 'Pha truyền bù điện giải', route: 'Truyền tĩnh mạch', quantity: 2, unit: 'Ống', instructions: 'Pha với NaCl 0.9% truyền tĩnh mạch chậm, cấm tiêm trực tiếp' }
    ]
  },
  {
    id: 'RX-2026-002', prescriptionType: 'inpatient_daily', patientId: 'BN-8791', patientName: 'Nguyễn Hải Đăng',
    patientCccd: '025091004128', patientDob: '1988-04-15', patientGender: 'Nam', department: 'Khoa Gây Mê Hồi Sức',
    roomBed: 'Phòng mổ 1 - Phẫu thuật thần kinh', diagnosisIcd10: 'S06.9', diagnosisText: 'Chấn thương sọ não (Hoàn trả phiếu PN-2026-085)',
    isChronicDisease: false, daysPrescribed: 1, doctorName: 'BS. Trần Văn Hùng', doctorCertificate: '009125/BYT-CCHN',
    prescribedAt: '2026-10-24 08:10:00', digitalSignature: 'SHA256:9c12a801b734 (Đã duyệt đơn)', status: 'signed',
    items: [
      { id: 'rxi-3', medicationName: 'Fentanyl 50 micrograms/ml', activeIngredient: 'Fentanyl - SĐK: VN-22499-20', dosage: '0.1mg/2ml', frequency: 'Giảm đau tiền phẫu', route: 'Tiêm tĩnh mạch', quantity: 1, unit: 'Ống', instructions: 'Đã nộp khay vỏ đối soát buồng mổ', isNarcotic: true }
    ]
  },
  {
    id: 'RX-2026-003', prescriptionType: 'inpatient_daily', patientId: 'BN-8812', patientName: 'Hoàng Kim Dung',
    patientCccd: '034199023412', patientDob: '1968-11-20', patientGender: 'Nữ', department: 'Hồi Sức Tích Cực (ICU)',
    roomBed: 'Buồng ICU 1 - Giường 05', diagnosisIcd10: 'A41.9', diagnosisText: 'Nhiễm khuẩn huyết nặng & ĐTĐ typ 2 (Bù nợ PN-2026-088)',
    isChronicDisease: true, daysPrescribed: 7, doctorName: 'BS. Trần Văn Hùng', doctorCertificate: '009125/BYT-CCHN',
    prescribedAt: '2026-10-24 07:30:00', digitalSignature: 'SHA256:5b91a0c4f812 (Đã ký số)', status: 'signed',
    items: [
      { id: 'rxi-4', medicationName: 'Ceftriaxona Normon 1g', activeIngredient: 'Ceftriaxon natri - SĐK: 840110304425', dosage: '1g', frequency: '2 lần/ngày (q12h)', route: 'Tiêm tĩnh mạch', quantity: 2, unit: 'Lọ', instructions: 'Pha nước cất tiêm chậm, cấm pha chung dung dịch Calci' },
      { id: 'rxi-5', medicationName: 'Panfor PR-750', activeIngredient: 'Metformin HCl - SĐK: 890110197726', dosage: '750mg', frequency: '1 viên/ngày', route: 'Uống', quantity: 7, unit: 'Viên', instructions: 'Uống sau bữa ăn tối' }
    ]
  },
  {
    id: 'RX-2026-004', prescriptionType: 'inpatient_daily', patientId: 'BN-8825', patientName: 'Đặng Thị Lan',
    patientCccd: '001185002934', patientDob: '1985-09-03', patientGender: 'Nữ', department: 'Khoa Cấp Cứu A9',
    roomBed: 'Buồng Sốc phản vệ', diagnosisIcd10: 'T78.2', diagnosisText: 'Sốc phản vệ độ III (Phác đồ TT 51/2017 & Bù PN-2026-091)',
    isChronicDisease: false, daysPrescribed: 1, doctorName: 'BS. Trần Văn Hùng', doctorCertificate: '009125/BYT-CCHN',
    prescribedAt: '2026-10-24 02:30:00', digitalSignature: 'SHA256:3e82a919cd10 (Ký cấp cứu)', status: 'signed',
    items: [
      { id: 'rxi-6', medicationName: 'Hadunalin 1 mg/ml', activeIngredient: 'Adrenalin - SĐK: 893110151100', dosage: '1mg/1ml', frequency: 'Tiêm bắp ngay', route: 'Tiêm bắp', quantity: 3, unit: 'Ống', instructions: 'Tiêm bắp mặt trước ngoài đùi 1/2 ống mỗi 3-5 phút theo TT 51' }
    ]
  },
  {
    id: 'RX-2026-005', prescriptionType: 'inpatient_daily', patientId: 'BN-8819', patientName: 'Trần Văn Toàn',
    patientCccd: '038080009182', patientDob: '1980-02-18', patientGender: 'Nam', department: 'Hồi Sức Tích Cực (ICU)',
    roomBed: 'Buồng ICU 2 - Giường 02', diagnosisIcd10: 'R57.2', diagnosisText: 'Sốc nhiễm trùng kháng dịch (Bù cơ số PN-2026-092)',
    isChronicDisease: false, daysPrescribed: 1, doctorName: 'BS. Trần Văn Hùng', doctorCertificate: '009125/BYT-CCHN',
    prescribedAt: '2026-10-24 03:15:00', digitalSignature: 'SHA256:77a1029c8841 (Đã ký số)', status: 'signed',
    items: [
      { id: 'rxi-7', medicationName: 'Noradrenalin 4mg/4ml', activeIngredient: 'Norepinephrin - SĐK: 893110107400', dosage: '4mg/4ml', frequency: 'Bơm tiêm điện liên tục', route: 'Truyền tĩnh mạch', quantity: 4, unit: 'Ống', instructions: 'Pha Glucose 5% duy trì qua bơm tiêm điện tĩnh mạch lớn' }
    ]
  },
  {
    id: 'RX-2026-006', prescriptionType: 'inpatient_daily', patientId: 'BN-8830', patientName: 'Lê Hoàng Nam',
    patientCccd: '001095018294', patientDob: '1995-12-08', patientGender: 'Nam', department: 'Khoa Thần Kinh',
    roomBed: 'Buồng Cấp cứu Thần kinh - Giường 01', diagnosisIcd10: 'G41.9', diagnosisText: 'Cơn co giật động kinh liên tục (Hoàn tất nợ vỏ PN-2026-083)',
    isChronicDisease: false, daysPrescribed: 1, doctorName: 'BS. Trần Văn Hùng', doctorCertificate: '009125/BYT-CCHN',
    prescribedAt: '2026-10-24 07:30:00', digitalSignature: 'SHA256:44b912c01823 (Đã duyệt đơn)', status: 'signed',
    items: [
      { id: 'rxi-8', medicationName: 'Diazepam Injection BP 10mg/2ml', activeIngredient: 'Diazepam - SĐK: 890112769224', dosage: '10mg/2ml', frequency: 'Tiêm chậm cắt cơn', route: 'Tiêm tĩnh mạch', quantity: 2, unit: 'Ống', instructions: 'Tiêm tĩnh mạch rất chậm, đã nộp khay vỏ đối soát TT 20/2017', isNarcotic: true }
    ]
  },
  {
    id: 'RX-2026-007', prescriptionType: 'inpatient_daily', patientId: 'BN-8814', patientName: 'Phạm Thị Mai',
    patientCccd: '031174005829', patientDob: '1974-08-25', patientGender: 'Nữ', department: 'Hồi Sức Ngoại',
    roomBed: 'Hồi sức Ngoại - Giường 04', diagnosisIcd10: 'K65.0', diagnosisText: 'Nhiễm trùng ổ bụng sau phẫu thuật (Bù nợ PN-2026-093)',
    isChronicDisease: false, daysPrescribed: 3, doctorName: 'BS. Lê Minh Đức', doctorCertificate: '008412/BYT-CCHN',
    prescribedAt: '2026-10-24 04:30:00', digitalSignature: 'SHA256:1198c0812ab5 (Đã ký số)', status: 'signed',
    items: [
      { id: 'rxi-9', medicationName: 'Meroright 1g (Meropenem)', activeIngredient: 'Meropenem - SĐK: 890110464223', dosage: '1g', frequency: '3 lần/ngày (q8h)', route: 'Truyền tĩnh mạch', quantity: 2, unit: 'Lọ', instructions: 'Pha với 100ml NaCl 0.9% truyền tĩnh mạch trong 30 phút' }
    ]
  },
  {
    id: 'RX-2026-008', prescriptionType: 'inpatient_daily', patientId: 'BN-8833', patientName: 'Vũ Đình Hưng',
    patientCccd: '036069001842', patientDob: '1969-05-14', patientGender: 'Nam', department: 'Khoa Cấp Cứu A9',
    roomBed: 'Cấp cứu A9 - Giường 06', diagnosisIcd10: 'J45.9', diagnosisText: 'Cơn hen phế quản ác tính (Đã bù cơ số tủ trực PN-2026-082)',
    isChronicDisease: false, daysPrescribed: 1, doctorName: 'BS. Trần Văn Hùng', doctorCertificate: '009125/BYT-CCHN',
    prescribedAt: '2026-10-24 06:50:00', digitalSignature: 'SHA256:55ab91c8012e (Đã hoàn bù)', status: 'signed',
    items: [
      { id: 'rxi-10', medicationName: 'Salbutamol 2,5 mg/ 2,5 ml', activeIngredient: 'Salbutamol - SĐK: 893115477725', dosage: '2.5mg/2.5ml', frequency: 'Khí dung ngắt quãng', route: 'Hít', quantity: 2, unit: 'Ống', instructions: 'Khí dung qua mặt nạ thở oxy 6 lít/phút' }
    ]
  },
  {
    id: 'RX-2026-009', prescriptionType: 'inpatient_daily', patientId: 'BN-8798', patientName: 'Nguyễn Thị Yến',
    patientCccd: '079185012948', patientDob: '1982-03-05', patientGender: 'Nữ', department: 'Khoa Phẫu Thuật Sản',
    roomBed: 'Phòng mổ 3 - Gây mê hồi sức', diagnosisIcd10: 'O72.0', diagnosisText: 'Băng huyết sau sinh mất thể tích (Bù nợ PN-2026-081)',
    isChronicDisease: false, daysPrescribed: 1, doctorName: 'BS. Trần Văn Hùng', doctorCertificate: '009125/BYT-CCHN',
    prescribedAt: '2026-10-24 08:00:00', digitalSignature: 'SHA256:8812c981ab22 (Đã quyết toán)', status: 'signed',
    items: [
      { id: 'rxi-11', medicationName: 'Lactated Ringer’s Injection/Vioser', activeIngredient: 'Ringer lactat - SĐK: 520110410325', dosage: '500ml', frequency: 'Truyền tĩnh mạch nhanh', route: 'Truyền tĩnh mạch', quantity: 2, unit: 'Chai', instructions: 'Bù thể tích tuần hoàn cấp cứu, không truyền cùng Ceftriaxon' }
    ]
  },
  {
    id: 'RX-2026-010', prescriptionType: 'inpatient_daily', patientId: 'BN-8835', patientName: 'Bùi Đức Mạnh',
    patientCccd: '001092003819', patientDob: '1992-10-10', patientGender: 'Nam', department: 'Khoa Ngoại Chấn Thương',
    roomBed: 'Khoa Ngoại Chấn Thương - Giường 11', diagnosisIcd10: 'S72.0', diagnosisText: 'Gãy hở xương đùi đa chấn thương (Phiếu nợ PN-2026-094)',
    isChronicDisease: false, daysPrescribed: 1, doctorName: 'BS. Trần Văn Hùng', doctorCertificate: '009125/BYT-CCHN',
    prescribedAt: '2026-10-24 04:00:00', digitalSignature: 'SHA256:9901cb188124 (Đã ký y lệnh)', status: 'signed',
    items: [
      { id: 'rxi-12', medicationName: 'Morphin (Morphin hydroclorid 10mg/ml)', activeIngredient: 'Morphin hydroclorid - SĐK: 893111093823', dosage: '10mg/1ml', frequency: 'Tiêm bắp giảm đau', route: 'Tiêm bắp', quantity: 1, unit: 'Ống', instructions: 'Giảm đau tiền phẫu, yêu cầu khoa nộp vỏ ống đối soát', isNarcotic: true }
    ]
  },
  {
    id: 'RX-2026-011', prescriptionType: 'inpatient_daily', patientId: 'BN-8810', patientName: 'Nguyễn Quốc Bảo',
    patientCccd: '019077002819', patientDob: '1977-07-19', patientGender: 'Nam', department: 'Hồi Sức Tích Cực (ICU)',
    roomBed: 'Buồng ICU 3 - Giường 09', diagnosisIcd10: 'A41.0', diagnosisText: 'Nhiễm khuẩn huyết do tụ cầu vàng MRSA (Bù nợ PN-2026-095)',
    isChronicDisease: false, daysPrescribed: 5, doctorName: 'BS. Trần Văn Hùng', doctorCertificate: '009125/BYT-CCHN',
    prescribedAt: '2026-10-24 03:00:00', digitalSignature: 'SHA256:6618ab891230 (Đã ký số)', status: 'signed',
    items: [
      { id: 'rxi-13', medicationName: 'VANCOMYCIN 1g', activeIngredient: 'Vancomycin HCl - SĐK: 890110595324', dosage: '1g', frequency: '2 lần/ngày (q12h)', route: 'Truyền tĩnh mạch', quantity: 1, unit: 'Lọ', instructions: 'Pha với 200ml NaCl 0.9% truyền tĩnh mạch chậm trong 60-100 phút' }
    ]
  },
  {
    id: 'RX-2026-012', prescriptionType: 'outpatient', patientId: 'BN-8820', patientName: 'Võ Minh Trí',
    patientCccd: '001201019283', patientDob: '1975-06-12', patientGender: 'Nam', department: 'Khoa Khám Bệnh - Phòng khám Tim Mạch',
    diagnosisIcd10: 'I10', diagnosisText: 'Tăng huyết áp nguyên phát & Rối loạn lipid máu mạn tính',
    isChronicDisease: true, daysPrescribed: 60, doctorName: 'BS. Trần Văn Hùng', doctorCertificate: '009125/BYT-CCHN',
    prescribedAt: '2026-10-24 08:30:15', digitalSignature: 'SHA256:7f83b1a89c02d4e8c1 (Đã ký số điện tử)', status: 'signed',
    items: [
      { id: 'rxi-14', medicationName: 'Safeesem 5', activeIngredient: 'S-amlodipine - SĐK: 890110197826', dosage: '5mg', frequency: '1 viên/ngày (sáng)', route: 'Uống', quantity: 60, unit: 'Viên', instructions: 'Uống sau bữa ăn sáng, không bẻ viên thuốc' },
      { id: 'rxi-15', medicationName: 'Atorvastatin Sandoz 20mg', activeIngredient: 'Atorvastatin calci - SĐK: 590110192126', dosage: '20mg', frequency: '1 viên/ngày (tối)', route: 'Uống', quantity: 60, unit: 'Viên', instructions: 'Uống trước khi đi ngủ, kiểm soát mỡ máu mạn tính' }
    ]
  }
];
