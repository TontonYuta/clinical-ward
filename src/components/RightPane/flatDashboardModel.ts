import type { UserRole } from '../../types/clinical';

export function canSearchPatients(role: UserRole): boolean {
  return role === 'doctor' || role === 'nurse';
}

export function canSearchMedications(role: UserRole): boolean {
  return role !== 'biomedical_engineer';
}

export function normalizeLookupQuery(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}
