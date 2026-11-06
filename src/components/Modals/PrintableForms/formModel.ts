import type { PrintableFormType } from '../PrintableFormModal';
export function fitDocumentScale(availableWidth: number, paperWidth = 794): number {
  if (!Number.isFinite(availableWidth) || availableWidth <= 0 || paperWidth <= 0) return 1;
  return Math.min(1, availableWidth / paperWidth);
}
export const FORM_PRESENTATION: Record<
  PrintableFormType,
  { title: string; group: string; source: 'debt' | 'ticket' | 'asset' | 'aggregate'; hint: string }
> = {
  TT20_AMPOULE_DESTRUCTION: {
    title: 'Hủy vỏ thuốc kiểm soát đặc biệt',
    group: 'Thuốc & tủ trực',
    source: 'aggregate',
    hint: 'Đối chiếu danh sách vỏ và thành viên hội đồng',
  },
  TT22_RESTOCK_PROPOSAL: {
    title: 'Dự trù thuốc tủ trực',
    group: 'Thuốc & tủ trực',
    source: 'aggregate',
    hint: 'Thuốc cần bổ sung và số lượng đề nghị',
  },
  EMERGENCY_BORROW_TICKET: {
    title: 'Phiếu mượn khẩn',
    group: 'Thuốc & tủ trực',
    source: 'debt',
    hint: 'Người bệnh, thuốc và người giao nhận',
  },
  TSC_HANDOVER_TRANSFER: {
    title: 'Bàn giao thiết bị',
    group: 'Thiết bị & tài sản',
    source: 'asset',
    hint: 'Tài sản, đơn vị giao và đơn vị nhận',
  },
  EQUIPMENT_HANDOVER_INSPECT: {
    title: 'Kiểm định & bàn giao thiết bị',
    group: 'Thiết bị & tài sản',
    source: 'ticket',
    hint: 'Thiết bị, số sê-ri và kết quả kiểm tra',
  },
  TSC_ANNUAL_AUDIT: {
    title: 'Kiểm kê tài sản',
    group: 'Thiết bị & tài sản',
    source: 'aggregate',
    hint: 'Danh sách thiết bị và kết quả đối chiếu',
  },
  COLD_CHAIN_INCIDENT_REPORT: {
    title: 'Sự cố chuỗi lạnh',
    group: 'Bảo quản & bàn giao ca',
    source: 'aggregate',
    hint: 'Diễn biến, số lô và ý kiến xử lý',
  },
  SHIFT_HANDOVER_RECORD: {
    title: 'Bàn giao ca trực',
    group: 'Bảo quản & bàn giao ca',
    source: 'aggregate',
    hint: 'Công việc còn lại và người giao nhận ca',
  },
};
export const FORM_GROUPS = ['Thuốc & tủ trực', 'Thiết bị & tài sản', 'Bảo quản & bàn giao ca'];
export const normalizeFormSearch = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim();
