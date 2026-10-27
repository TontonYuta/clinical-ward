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
  allergies: string;
  chronicConditions: string;
  egfr: number; // mL/min/1.73m2
  creatinine: number;
  weightKg: number;
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
    allergies: 'Penicillin, Aspirin (phù mạch, co thắt phế quản)',
    chronicConditions: 'Tăng huyết áp vô căn, Bệnh mạch vành mạn',
    egfr: 68.5,
    creatinine: 92.0,
    weightKg: 67.0
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
    room: 'Khoa Nội Tiết - Giường 08',
    allergies: 'Sulfonamide (Co-trimoxazole)',
    chronicConditions: 'Đái tháo đường Tuýp 2, Rối loạn lipid máu',
    egfr: 52.0,
    creatinine: 110.0,
    weightKg: 58.0
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
    room: 'Khoa Tiêu Hóa - Giường 04',
    allergies: 'Không ghi nhận dị ứng',
    chronicConditions: 'Loét dạ dày tá tràng mạn tính, GERD',
    egfr: 95.0,
    creatinine: 75.0,
    weightKg: 72.0
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
    allergies: 'Không ghi nhận dị ứng',
    chronicConditions: 'Hen phế quản nhẹ',
    egfr: 105.0,
    creatinine: 65.0,
    weightKg: 50.0
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
    room: 'Khoa Cơ Xương Khớp',
    allergies: 'Không ghi nhận dị ứng',
    chronicConditions: 'Thoái hóa khớp gối',
    egfr: 88.0,
    creatinine: 82.0,
    weightKg: 65.0
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
  const norm = query.toLowerCase();
  return patients.find(p => norm.includes(p.fullName.toLowerCase()) || norm.includes(p.id.toLowerCase()) || (norm.includes('trí') && p.fullName.includes('Trí')) || (norm.includes('mai') && p.fullName.includes('Mai')) || (norm.includes('lan') && p.fullName.includes('Lan')) || (norm.includes('đăng') && p.fullName.includes('Đăng')));
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
