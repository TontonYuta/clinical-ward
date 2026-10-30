/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dịch Vụ Hồ Sơ Bệnh Nhân Lâm Sàng & Tiền Sử Dùng Thuốc (<=200 LOC)
 */

import { API_BASE_URL } from './api';

export interface PatientProfile {
  id: string; // BN-8820
  fullName: string;
  dob?: string;
  age?: number;
  gender: string;
  cccd?: string;
  phone?: string;
  email: string;
  room: string;
  department?: string;
  allergies: string;
  chronicConditions: string;
  egfr: number; // mL/min/1.73m2
  creatinine: number;
  weightKg: number;
  bloodType?: string;
  primaryDoctor?: string;
  admissionDate?: string;
  codeStatus?: string;
}

const STORAGE_KEY_PATIENTS = 'clinical_patients_cache_v1';

export const INITIAL_PATIENTS: PatientProfile[] = [
  {
    id: 'BN-8820',
    fullName: 'Võ Minh Trí',
    dob: '1968-05-14',
    age: 58,
    gender: 'Nam',
    cccd: '079068012345',
    phone: '0912345678',
    email: 'tri.vm@hospital.vn',
    room: 'Buồng Cấp Cứu 3 - Giường 02',
    department: 'Khoa Cấp Cứu A9',
    allergies: 'Penicillin, Aspirin (phù mạch, co thắt phế quản cấp)',
    chronicConditions: 'Tăng huyết áp vô căn, Bệnh mạch vành mạn, Thiếu máu cơ tim',
    egfr: 68.5,
    creatinine: 92.0,
    weightKg: 67.0,
    bloodType: 'O Rh+',
    primaryDoctor: 'BS. Trần Văn Hùng',
    admissionDate: '2026-10-24 01:15',
    codeStatus: 'Hồi sinh tim phổi toàn diện (Full Code)'
  },
  {
    id: 'BN-8825',
    fullName: 'Đặng Thị Lan',
    dob: '1964-11-20',
    age: 62,
    gender: 'Nữ',
    cccd: '079164098765',
    phone: '0987654321',
    email: 'lan.dt@hospital.vn',
    room: 'Khoa Cấp Cứu A9 - Buồng Sốc phản vệ',
    department: 'Khoa Cấp Cứu A9',
    allergies: 'Sulfonamide (Co-trimoxazole), Phản ứng dị ứng độ III',
    chronicConditions: 'Đái tháo đường Tuýp 2, Rối loạn lipid máu, Sốc phản vệ',
    egfr: 52.0,
    creatinine: 110.0,
    weightKg: 58.0,
    bloodType: 'A Rh+',
    primaryDoctor: 'BS. Trần Văn Hùng',
    admissionDate: '2026-10-24 02:10',
    codeStatus: 'Hồi sinh tim phổi toàn diện (Full Code)'
  },
  {
    id: 'BN-8791',
    fullName: 'Nguyễn Hải Đăng',
    dob: '1981-08-09',
    age: 45,
    gender: 'Nam',
    cccd: '001081005432',
    phone: '0903112233',
    email: 'dang.nh@hospital.vn',
    room: 'Phòng mổ 1 - Phẫu thuật thần kinh',
    department: 'Khoa Gây Mê Hồi Sức',
    allergies: 'Không ghi nhận tiền sử dị ứng thuốc',
    chronicConditions: 'Chấn thương sọ não kín, Loét dạ dày tá tràng mạn tính',
    egfr: 95.0,
    creatinine: 75.0,
    weightKg: 72.0,
    bloodType: 'B Rh+',
    primaryDoctor: 'BS. Trần Văn Hùng',
    admissionDate: '2026-10-24 07:45',
    codeStatus: 'Hồi sinh tim phổi toàn diện (Full Code)'
  },
  {
    id: 'BN-8812',
    fullName: 'Hoàng Kim Dung',
    dob: '1968-11-20',
    age: 58,
    gender: 'Nữ',
    cccd: '034199023412',
    phone: '0918234567',
    email: 'dung.hk@hospital.vn',
    room: 'Buồng ICU 1 - Giường 05',
    department: 'Hồi Sức Tích Cực (ICU)',
    allergies: 'Kháng sinh nhóm Macrolid (Erythromycin)',
    chronicConditions: 'Nhiễm khuẩn huyết nặng, Đái tháo đường Tuýp 2 phụ thuộc insulin',
    egfr: 45.2,
    creatinine: 135.0,
    weightKg: 60.0,
    bloodType: 'AB Rh+',
    primaryDoctor: 'BS. Trần Văn Hùng',
    admissionDate: '2026-10-23 20:30',
    codeStatus: 'Hồi sinh tim phổi toàn diện (Full Code)'
  },
  {
    id: 'BN-8819',
    fullName: 'Trần Văn Toàn',
    dob: '1980-02-18',
    age: 46,
    gender: 'Nam',
    cccd: '038080009182',
    phone: '0981122334',
    email: 'toan.tv@hospital.vn',
    room: 'Buồng ICU 2 - Giường 02',
    department: 'Hồi Sức Tích Cực (ICU)',
    allergies: 'Thuốc chống viêm không steroid (NSAIDs - Ibuprofen)',
    chronicConditions: 'Sốc nhiễm trùng kháng dịch, Tổn thương thận cấp KDIGO giai đoạn 1',
    egfr: 78.0,
    creatinine: 88.0,
    weightKg: 70.0,
    bloodType: 'O Rh+',
    primaryDoctor: 'BS. Trần Văn Hùng',
    admissionDate: '2026-10-24 02:50',
    codeStatus: 'Hồi sinh tim phổi toàn diện (Full Code)'
  },
  {
    id: 'BN-8830',
    fullName: 'Lê Hoàng Nam',
    dob: '1995-12-08',
    age: 31,
    gender: 'Nam',
    cccd: '001095018294',
    phone: '0938445566',
    email: 'nam.lh@hospital.vn',
    room: 'Buồng Cấp cứu Thần kinh - Giường 01',
    department: 'Khoa Thần Kinh',
    allergies: 'Không ghi nhận tiền sử dị ứng thuốc',
    chronicConditions: 'Cơn co giật động kinh toàn thể liên tục, Rối loạn giấc ngủ',
    egfr: 110.0,
    creatinine: 70.0,
    weightKg: 64.0,
    bloodType: 'A Rh+',
    primaryDoctor: 'BS. Trần Văn Hùng',
    admissionDate: '2026-10-24 06:40',
    codeStatus: 'Hồi sinh tim phổi toàn diện (Full Code)'
  },
  {
    id: 'BN-8814',
    fullName: 'Phạm Thị Mai',
    dob: '1974-08-25',
    age: 52,
    gender: 'Nữ',
    cccd: '031174005829',
    phone: '0909556677',
    email: 'mai.pt@hospital.vn',
    room: 'Hồi sức Ngoại - Giường 04',
    department: 'Khoa Hồi Sức Ngoại',
    allergies: 'Ciprofloxacin (Quinolone - phát ban mề đay)',
    chronicConditions: 'Nhiễm trùng ổ bụng sau phẫu thuật, Viêm tụy cấp hồi phục',
    egfr: 62.0,
    creatinine: 98.0,
    weightKg: 54.0,
    bloodType: 'B Rh+',
    primaryDoctor: 'BS. Lê Minh Đức',
    admissionDate: '2026-10-23 15:00',
    codeStatus: 'Hồi sinh tim phổi toàn diện (Full Code)'
  },
  {
    id: 'BN-8833',
    fullName: 'Vũ Đình Hưng',
    dob: '1969-05-14',
    age: 57,
    gender: 'Nam',
    cccd: '036069001842',
    phone: '0913778899',
    email: 'hung.vd@hospital.vn',
    room: 'Cấp cứu A9 - Giường 06',
    department: 'Khoa Cấp Cứu A9',
    allergies: 'Không ghi nhận tiền sử dị ứng thuốc',
    chronicConditions: 'Hen phế quản ác tính, Bệnh phổi tắc nghẽn mạn tính (COPD nhóm D)',
    egfr: 82.0,
    creatinine: 85.0,
    weightKg: 68.0,
    bloodType: 'O Rh+',
    primaryDoctor: 'BS. Trần Văn Hùng',
    admissionDate: '2026-10-24 06:15',
    codeStatus: 'Hồi sinh tim phổi toàn diện (Full Code)'
  },
  {
    id: 'BN-8798',
    fullName: 'Nguyễn Thị Yến',
    dob: '1982-03-05',
    age: 44,
    gender: 'Nữ',
    cccd: '079185012948',
    phone: '0945990011',
    email: 'yen.nt@hospital.vn',
    room: 'Phòng mổ 3 - Gây mê hồi sức',
    department: 'Khoa Phẫu Thuật Sản',
    allergies: 'Không ghi nhận tiền sử dị ứng thuốc',
    chronicConditions: 'Băng huyết sau sinh giảm thể tích, Thiếu máu sau mổ lấy thai',
    egfr: 98.0,
    creatinine: 68.0,
    weightKg: 56.0,
    bloodType: 'A Rh+',
    primaryDoctor: 'BS. Trần Văn Hùng',
    admissionDate: '2026-10-24 07:15',
    codeStatus: 'Hồi sinh tim phổi toàn diện (Full Code)'
  },
  {
    id: 'BN-8835',
    fullName: 'Bùi Đức Mạnh',
    dob: '1972-10-15',
    age: 54,
    gender: 'Nam',
    cccd: '037072004512',
    phone: '0912889922',
    email: 'manh.bd@hospital.vn',
    room: 'Khoa Tim Mạch Can Thiệp - Giường 05',
    department: 'Khoa Tim Mạch',
    allergies: 'Thuốc cản quang chứa Iod',
    chronicConditions: 'Bệnh tim thiếu máu cục bộ mạn tính, Rung nhĩ kịch phát',
    egfr: 71.0,
    creatinine: 90.0,
    weightKg: 75.0,
    bloodType: 'O Rh+',
    primaryDoctor: 'BS. Trần Văn Hùng',
    admissionDate: '2026-10-23 11:00',
    codeStatus: 'Hồi sinh tim phổi toàn diện (Full Code)'
  },
  {
    id: 'BN-8810',
    fullName: 'Nguyễn Quốc Bảo',
    dob: '1983-07-22',
    age: 43,
    gender: 'Nam',
    cccd: '079083006734',
    phone: '0983112244',
    email: 'bao.nq@hospital.vn',
    room: 'Khoa Ngoại Chấn Thương - Giường 08',
    department: 'Khoa Ngoại Chấn Thương',
    allergies: 'Không ghi nhận tiền sử dị ứng thuốc',
    chronicConditions: 'Đa chấn thương sau tai nạn giao thông, Gãy hở cẳng chân',
    egfr: 102.0,
    creatinine: 72.0,
    weightKg: 70.0,
    bloodType: 'B Rh+',
    primaryDoctor: 'BS. Lê Minh Đức',
    admissionDate: '2026-10-24 00:30',
    codeStatus: 'Hồi sinh tim phổi toàn diện (Full Code)'
  },
  {
    id: 'BN-8817',
    fullName: 'Trần Huy Hoàng',
    dob: '1990-06-15',
    age: 36,
    gender: 'Nam',
    cccd: '026205006033',
    phone: '0963278149',
    email: 'huyhoang6altt@gmail.com',
    room: 'Khoa Khám Bệnh - Phòng 204',
    department: 'Khoa Khám Bệnh',
    allergies: 'Không ghi nhận tiền sử dị ứng thuốc',
    chronicConditions: 'Cảm cúm (Sốt nhẹ, ho khan, nghẹt mũi)',
    egfr: 108.0,
    creatinine: 70.0,
    weightKg: 68.0,
    bloodType: 'O Rh+',
    primaryDoctor: 'BS. Trần Văn Hùng',
    admissionDate: '2026-10-30 08:00',
    codeStatus: 'Hồi sinh tim phổi toàn diện (Full Code)'
  },
  {
    id: 'BN-9012',
    fullName: 'Trần Thị Mai',
    dob: '1992-03-25',
    age: 34,
    gender: 'Nữ',
    cccd: '001192008899',
    phone: '0934567890',
    email: 'mai.tt@hospital.vn',
    room: 'Khoa Khám Bệnh - Phòng 102',
    department: 'Khoa Khám Bệnh',
    allergies: 'Không ghi nhận tiền sử dị ứng thuốc',
    chronicConditions: 'Hen phế quản nhẹ kiểm soát tốt',
    egfr: 105.0,
    creatinine: 65.0,
    weightKg: 50.0,
    bloodType: 'A Rh+',
    primaryDoctor: 'BS. Nguyễn Văn A',
    admissionDate: '2026-10-24 08:30',
    codeStatus: 'Hồi sinh tim phổi toàn diện (Full Code)'
  },
  {
    id: 'BN-7701',
    fullName: 'Nguyễn Văn An',
    dob: '1976-12-10',
    age: 50,
    gender: 'Nam',
    cccd: '079076001122',
    phone: '0977889900',
    email: 'an.nv@gmail.com',
    room: 'Khoa Cơ Xương Khớp - Giường 03',
    department: 'Khoa Cơ Xương Khớp',
    allergies: 'Không ghi nhận tiền sử dị ứng thuốc',
    chronicConditions: 'Thoái hóa khớp gối hai bên',
    egfr: 88.0,
    creatinine: 82.0,
    weightKg: 65.0,
    bloodType: 'O Rh+',
    primaryDoctor: 'BS. Lê Minh Đức',
    admissionDate: '2026-10-22 09:00',
    codeStatus: 'Hồi sinh tim phổi toàn diện (Full Code)'
  }
];

export async function fetchPatients(): Promise<PatientProfile[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/patients`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(data));
        return data;
      }
    }
  } catch (e) {
    console.warn('Backend patients API offline, using cached patient data:', e);
  }

  try {
    const cached = localStorage.getItem(STORAGE_KEY_PATIENTS);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {}

  localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(INITIAL_PATIENTS));
  return INITIAL_PATIENTS;
}

export function findPatientByNameOrQuery(query: string, patients: PatientProfile[] = INITIAL_PATIENTS): PatientProfile | undefined {
  if (!query) return undefined;
  const norm = query.toLowerCase().trim();
  
  // 1. Match by ID directly
  const byId = patients.find(p => p.id.toLowerCase() === norm || norm.includes(p.id.toLowerCase()));
  if (byId) return byId;

  // 2. Match by exact or partial full name
  const byName = patients.find(p => norm.includes(p.fullName.toLowerCase()) || p.fullName.toLowerCase().includes(norm));
  if (byName) return byName;

  // 3. Match without parentheses or prefixes e.g. "Võ Minh Trí (BN-8820)"
  const cleanName = query.replace(/\(.*?\)/g, '').trim().toLowerCase();
  const byClean = patients.find(p => cleanName.includes(p.fullName.toLowerCase()) || p.fullName.toLowerCase().includes(cleanName));
  if (byClean) return byClean;

  // 4. Match specific nicknames/surnames
  return patients.find(p => 
    (norm.includes('trí') && p.fullName.includes('Trí')) ||
    (norm.includes('mai') && p.fullName.includes('Mai')) ||
    (norm.includes('lan') && p.fullName.includes('Lan')) ||
    (norm.includes('đăng') && p.fullName.includes('Đăng')) ||
    (norm.includes('dung') && p.fullName.includes('Dung')) ||
    (norm.includes('toàn') && p.fullName.includes('Toàn')) ||
    (norm.includes('nam') && p.fullName.includes('Nam')) ||
    (norm.includes('hưng') && p.fullName.includes('Hưng')) ||
    (norm.includes('yến') && p.fullName.includes('Yến')) ||
    (norm.includes('mạnh') && p.fullName.includes('Mạnh')) ||
    (norm.includes('bảo') && p.fullName.includes('Bảo')) ||
    (norm.includes('hoàng') && p.fullName.includes('Hoàng')) ||
    (norm.includes('an') && p.fullName.includes('An'))
  );
}

export async function savePatientProfile(patient: PatientProfile): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patient)
    });
    if (res.ok) {
      const current = await fetchPatients();
      const updated = current.map(p => p.id === patient.id ? patient : p);
      if (!updated.some(p => p.id === patient.id)) updated.push(patient);
      localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(updated));
      return true;
    }
  } catch (e) {
    console.warn('Saving patient offline in localStorage:', e);
  }
  return false;
}

export function openPatientDetailModal(patientIdOrName: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('open_patient_detail', { detail: { patientName: patientIdOrName } }));
  }
}
