/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dữ Liệu Đơn Thuốc Điện Tử Bác Sĩ Chuẩn TT 26/2025/TT-BYT từ CSDL 54.885 Thuốc Cục QLD (<=200 LOC)
 */

import { PrescriptionOrder } from '../types/cpoe';

export const INITIAL_PRESCRIPTIONS: PrescriptionOrder[] = [
  {
    id: 'RX-2026-001',
    prescriptionType: 'outpatient',
    patientId: 'BN-8820',
    patientName: 'Võ Minh Trí',
    patientCccd: '001201019283',
    patientDob: '1975-06-12',
    patientGender: 'Nam',
    department: 'Khoa Khám Bệnh - Phòng khám Tim Mạch',
    diagnosisIcd10: 'I10',
    diagnosisText: 'Tăng huyết áp vô căn (nguyên phát)',
    isChronicDisease: true,
    daysPrescribed: 60,
    doctorName: 'BS. Trần Văn Hùng',
    doctorCertificate: '009125/BYT-CCHN',
    prescribedAt: '2026-10-24 08:30:15',
    digitalSignature: 'SHA256:7f83b1a89c02d4e8c1... (Đã ký số điện tử)',
    status: 'signed',
    items: [
      {
        id: 'rxi-1',
        medicationName: 'Safeesem 5 (Amlodipin 5mg)',
        activeIngredient: 'S-amlodipine (dưới dạng S-amlodipine besylate) - SĐK: 890110197826',
        dosage: '5mg',
        frequency: '1 viên/ngày (uống buổi sáng)',
        route: 'Uống',
        quantity: 60,
        unit: 'Viên',
        instructions: 'Uống sau bữa ăn sáng, không bẻ viên thuốc'
      },
      {
        id: 'rxi-2',
        medicationName: 'Atorvastatin Sandoz 20mg',
        activeIngredient: 'Atorvastatin (dưới dạng Atorvastatin calci trihydrat) - SĐK: 590110192126',
        dosage: '20mg',
        frequency: '1 viên/ngày (uống buổi tối)',
        route: 'Uống',
        quantity: 60,
        unit: 'Viên',
        instructions: 'Uống trước khi đi ngủ, kiểm soát mỡ máu mạn tính'
      }
    ]
  },
  {
    id: 'RX-2026-002',
    prescriptionType: 'outpatient',
    patientId: 'BN-8812',
    patientName: 'Hoàng Kim Dung',
    patientCccd: '034199023412',
    patientDob: '1968-11-20',
    patientGender: 'Nữ',
    department: 'Khoa Khám Bệnh - Phòng Nội Tiết',
    diagnosisIcd10: 'E11',
    diagnosisText: 'Đái tháo đường typ 2 không phụ thuộc insulin (mục 42 Phụ lục VII TT 26/2025)',
    isChronicDisease: true,
    daysPrescribed: 90,
    doctorName: 'BS. Trần Văn Hùng',
    doctorCertificate: '009125/BYT-CCHN',
    prescribedAt: '2026-10-24 09:15:00',
    digitalSignature: 'SHA256:5b91a0c4f812e9d3... (Đã ký số điện tử)',
    status: 'signed',
    items: [
      {
        id: 'rxi-3',
        medicationName: 'Panfor PR-750 (Metformin 750mg)',
        activeIngredient: 'Metformin Hydrochloride - SĐK: 890110197726',
        dosage: '750mg',
        frequency: '2 viên/ngày (sáng 1, tối 1)',
        route: 'Uống',
        quantity: 180,
        unit: 'Viên',
        instructions: 'Uống ngay trong hoặc sau bữa ăn chính'
      }
    ]
  },
  {
    id: 'RX-2026-003',
    prescriptionType: 'inpatient_daily',
    patientId: 'BN-8798',
    patientName: 'Nguyễn Thị Yến',
    patientCccd: '079185012948',
    patientDob: '1982-03-05',
    patientGender: 'Nữ',
    department: 'Hồi Sức Tích Cực (ICU)',
    roomBed: 'Buồng ICU 2 - Giường 04',
    diagnosisIcd10: 'A41.9',
    diagnosisText: 'Nhiễm khuẩn huyết không xác định',
    isChronicDisease: false,
    daysPrescribed: 1,
    doctorName: 'BS. Trần Văn Hùng',
    doctorCertificate: '009125/BYT-CCHN',
    prescribedAt: '2026-10-24 07:00:00',
    digitalSignature: 'SHA256:1a84f32e90c88... (Đã ký số đơn thuốc)',
    status: 'signed',
    items: [
      {
        id: 'rxi-4',
        medicationName: 'Ceftriaxona Normon 1g',
        activeIngredient: 'Ceftriaxon (dưới dạng ceftriaxon natri) - SĐK: 840110304425',
        dosage: '1g',
        frequency: '2 lần/ngày (cách 12h: 08:00 - 20:00)',
        route: 'Tiêm tĩnh mạch',
        quantity: 2,
        unit: 'Lọ',
        instructions: 'Pha với 10ml nước cất tiêm chậm trong 5 phút'
      }
    ]
  }
];
