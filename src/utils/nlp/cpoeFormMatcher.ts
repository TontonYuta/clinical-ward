/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Nhận diện ý định mở form kê đơn CPOE từ câu lệnh người dùng
 */

export function normalizeVietnamese(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd');
}

export function isPrescriptionFormIntent(query: string): boolean {
  if (!query) return false;
  const raw = query.trim().toLowerCase();
  const norm = normalizeVietnamese(raw);

  // Không áp dụng cho các câu hỏi chỉ dẫn dặn dò, nhắc thuốc, tra cứu tương tác
  if (norm.includes('dan do') || norm.includes('nhac thuoc') || norm.includes('lich uong') || norm.includes('tuong tac')) {
    return false;
  }

  // Khớp rõ ràng yêu cầu mở form / giao diện / biểu mẫu kê đơn
  const hasOpenForm = /(?:mo|vao|hien|bat|show)\s+(?:bieu\s+mau\s+|form\s+|giao\s+dien\s+|tab\s+|phan\s+he\s+)?(?:ke\s+don|cpoe|don\s+thuoc|toa\s+thuoc|ke\s+toa)/.test(norm);
  const isDirectOpenCommand = /^(?:mo\s+)?(?:form\s+)?(?:cpoe|ke\s+don|ke\s+don\s+thuoc|don\s+thuoc|toa\s+thuoc|ke\s+toa\s+thuoc|tao\s+don|tao\s+don\s+thuoc)$/.test(norm);
  const hasCpoeForm = norm.includes('cpoe') && (norm.includes('mo') || norm.includes('form') || norm.includes('vao') || norm.includes('giao dien'));
  const hasFormKeDon = norm.includes('form') && (norm.includes('ke don') || norm.includes('tao don') || norm.includes('don thuoc'));
  const hasMoKeDon = (norm.includes('mo') || norm.includes('vao')) && (norm.includes('ke don') || norm.includes('don thuoc') || norm.includes('toa thuoc'));
  const hasPrescribeAction = (norm.includes('ke don thuoc') || norm.includes('tao don thuoc')) && !norm.includes('cho benh nhan') && !norm.includes('cho bn');

  return hasOpenForm || isDirectOpenCommand || hasCpoeForm || hasFormKeDon || hasMoKeDon || hasPrescribeAction;
}
