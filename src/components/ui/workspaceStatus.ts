export type ExpiryState = 'expired' | 'near' | 'valid' | 'unknown';
/** Display classification only. Never an authorization to dispense or release a batch. */
export function expiryState(value: string, today = new Date()): ExpiryState {
  let day: number, month: number, year: number;
  const dmy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  const my = /^(\d{2})\/(\d{4})$/.exec(value);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dmy) [, day, month, year] = dmy.map(Number);
  else if (my) {
    month = Number(my[1]);
    year = Number(my[2]);
    day = new Date(Date.UTC(year, month, 0)).getUTCDate();
  } else if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else return 'unknown';
  const expiry = new Date(Date.UTC(year, month - 1, day));
  if (
    expiry.getUTCFullYear() !== year ||
    expiry.getUTCMonth() !== month - 1 ||
    expiry.getUTCDate() !== day
  )
    return 'unknown';
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const days = (expiry.getTime() - now) / 86400000;
  return days < 0 ? 'expired' : days <= 90 ? 'near' : 'valid';
}
/** Current configured cabinet band, not a universal legal storage range for every product. */
export function temperatureAlarm(state: { currentTemp: number; alarmActive: boolean }): boolean {
  return (
    state.alarmActive ||
    !Number.isFinite(state.currentTemp) ||
    state.currentTemp < 2 ||
    state.currentTemp > 8
  );
}
export function vaccineState(
  item: { expiryDate: string; status: string },
  quarantined: boolean,
  today = new Date(),
) {
  const expiry = expiryState(item.expiryDate, today);
  if (expiry === 'expired') return { label: 'Hết hạn', tone: 'danger' };
  if (quarantined || item.status === 'quarantined') return { label: 'Biệt trữ', tone: 'warning' };
  if (expiry === 'unknown') return { label: 'Kiểm tra hạn', tone: 'warning' };
  if (expiry === 'near') return { label: 'Cận hạn', tone: 'warning' };
  return { label: 'Theo dõi', tone: 'neutral' };
}

export function prescriptionState(order: { status: string; digitalSignature?: string }) {
  if (order.status === 'cancelled') return { label: 'Đã hủy', tone: 'neutral' };
  if (order.status === 'dispensed') return { label: 'Đã cấp', tone: 'neutral' };
  if (order.status === 'draft') return { label: 'Bản nháp', tone: 'warning' };
  if (order.status === 'signed' && order.digitalSignature?.trim())
    return { label: 'Đã ghi nhận ký', tone: 'success' };
  return { label: 'Chưa có chữ ký', tone: 'warning' };
}
