export interface StaffItem {
  id: string;
  role: 'doctor' | 'nurse' | 'pharmacist' | 'biomedical_engineer' | 'director' | string;
  name: string;
  role_name: string;
  department: string;
  practice_certificate: string;
  pin_code: string;
  rfid_card_id: string;
  responsibilities: string;
  email?: string | null;
  phone?: string | null;
  dob?: string | null;
  academic_title?: string | null;
  is_active: boolean;
  avatar_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface StaffCreatePayload {
  id?: string;
  name: string;
  role: string;
  role_name: string;
  department: string;
  practice_certificate: string;
  pin_code: string;
  rfid_card_id: string;
  responsibilities?: string;
  email?: string;
  phone?: string;
  dob?: string;
  academic_title?: string;
  is_active?: boolean;
  avatar_url?: string;
}

export interface StaffUpdatePayload {
  name?: string;
  role?: string;
  role_name?: string;
  department?: string;
  practice_certificate?: string;
  pin_code?: string;
  rfid_card_id?: string;
  responsibilities?: string;
  email?: string;
  phone?: string;
  dob?: string;
  academic_title?: string;
  is_active?: boolean;
  avatar_url?: string;
}

export interface StaffListResponse {
  total: number;
  active_count: number;
  suspended_count: number;
  items: StaffItem[];
}
