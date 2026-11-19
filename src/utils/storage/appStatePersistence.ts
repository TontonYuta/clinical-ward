/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Quản lý Trạng Thái Bền Vững & Tối Ưu UX Khi Reload Trang (State Persistence & SWR) (<=180 LOC)
 */

import {
  DashboardTab,
  UserRole,
  ChatMessage,
  DebtRecord,
  EquipmentTicket,
  InventoryBatch,
  AuditTrailRecord
} from '../../types/clinical';
import {
  INITIAL_DEBT_RECORDS,
  INITIAL_EQUIPMENT_TICKETS,
  INITIAL_INVENTORY_BATCHES,
  INITIAL_CHAT_MESSAGES,
  INITIAL_AUDIT_TRAIL_RECORDS
} from '../../data/initialData';

const KEYS = {
  TAB: 'clinical_current_tab',
  ROLE: 'clinical_user_role',
  DOMAIN: 'clinical_system_domain',
  SIDEBAR_COLLAPSED: 'clinical_sidebar_collapsed',
  COPILOT_OPEN: 'clinical_copilot_open',
  COPILOT_EXPANDED: 'clinical_copilot_expanded',
  AUDIO_MUTED: 'clinical_audio_muted',
  FONT_SCALE: 'clinical_font_scale',
  CHAT_MESSAGES: 'clinical_chat_messages',
  CACHED_DEBTS: 'clinical_cached_debts',
  CACHED_TICKETS: 'clinical_cached_tickets',
  CACHED_BATCHES: 'clinical_cached_batches',
  CACHED_AUDIT: 'clinical_cached_audit'
};

// Tạm thời ẩn các tab TBYT, Sổ nợ vỏ và Chuỗi lạnh theo yêu cầu người dùng (chỉ giữ 4 tab)
const VALID_TABS: DashboardTab[] = ['overview', 'cpoe', 'bhyt_audit', 'fefo', 'documents'];
const VALID_ROLES: UserRole[] = ['nurse', 'doctor', 'pharmacist', 'biomedical_engineer', 'director'];

/**
 * 1. Khôi phục Tab ban đầu từ URL Hash hoặc LocalStorage
 */
export function getInitialTab(): DashboardTab {
  if (typeof window === 'undefined') return 'overview';

  // Ưu tiên 1: Lấy từ window.location.hash (#cpoe, #fefo, #equipment...)
  const hash = window.location.hash.replace('#', '').toLowerCase() as DashboardTab;
  if (VALID_TABS.includes(hash)) {
    return hash;
  }

  // Ưu tiên 2: Lấy từ LocalStorage lưu ở phiên trước
  try {
    const saved = localStorage.getItem(KEYS.TAB) as DashboardTab;
    if (saved && VALID_TABS.includes(saved)) {
      return saved;
    }
  } catch (e) {
    console.warn('Cannot read tab from localStorage', e);
  }

  return 'overview';
}

/**
 * 2. Đồng bộ Tab với URL Hash và LocalStorage (Không gây giật scroll trang)
 */
export function syncTabToUrl(tab: DashboardTab): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEYS.TAB, tab);
    const targetHash = `#${tab}`;
    if (window.location.hash !== targetHash) {
      // Dùng replaceState để không tạo lịch sử rác và không gây giật scroll vị trí
      window.history.replaceState(null, '', `${window.location.pathname}${targetHash}`);
    }
  } catch (e) {
    console.warn('Cannot sync tab to URL', e);
  }
}

/**
 * 3. Khôi phục vai trò người dùng (User Role)
 */
export function getInitialUserRole(): UserRole {
  if (typeof window === 'undefined') return 'nurse';
  try {
    const saved = localStorage.getItem(KEYS.ROLE) as UserRole;
    if (saved && VALID_ROLES.includes(saved)) {
      return saved;
    }
  } catch (e) {}
  return 'nurse';
}

export function saveUserRole(role: UserRole): void {
  try {
    localStorage.setItem(KEYS.ROLE, role);
  } catch (e) {}
}

/**
 * 4. Suy luận và khôi phục phân hệ (Domain: Dược vs Thiết bị)
 */
export function getInitialDomain(currentTab: DashboardTab): 'pharmacy' | 'equipment' {
  if (currentTab === 'equipment' || currentTab === 'asset_audit') {
    return 'equipment';
  }
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(KEYS.DOMAIN);
    if (saved === 'equipment' || saved === 'pharmacy') return saved;
  }
  return 'pharmacy';
}

export function saveDomain(domain: 'pharmacy' | 'equipment'): void {
  try {
    localStorage.setItem(KEYS.DOMAIN, domain);
  } catch (e) {}
}

/**
 * 5. Khôi phục trạng thái Sidebar & Copilot
 */
export function getInitialSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(KEYS.SIDEBAR_COLLAPSED) === 'true';
  } catch {
    return false;
  }
}

export function saveSidebarCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(KEYS.SIDEBAR_COLLAPSED, collapsed ? 'true' : 'false');
  } catch {}
}

export function getInitialCopilotOpen(): boolean {
  try {
    return localStorage.getItem(KEYS.COPILOT_OPEN) === 'true';
  } catch {
    return false;
  }
}

export function saveCopilotOpen(isOpen: boolean): void {
  try {
    localStorage.setItem(KEYS.COPILOT_OPEN, isOpen ? 'true' : 'false');
  } catch {}
}

export function getInitialCopilotExpanded(): boolean {
  try {
    return false; // Default to compact floating window so it never blocks the workstation on reload
  } catch {
    return false;
  }
}

export function saveCopilotExpanded(isExpanded: boolean): void {
  try {
    localStorage.setItem(KEYS.COPILOT_EXPANDED, isExpanded ? 'true' : 'false');
  } catch {}
}

export function getInitialAudioMuted(): boolean {
  try {
    return localStorage.getItem(KEYS.AUDIO_MUTED) === 'true';
  } catch {
    return false;
  }
}

export function saveAudioMuted(isMuted: boolean): void {
  try {
    localStorage.setItem(KEYS.AUDIO_MUTED, isMuted ? 'true' : 'false');
  } catch {}
}

export type LegacyFontScale = 'compact' | 'standard' | 'large';
export type AppFontScale = number | LegacyFontScale;
const LEGACY_FONT_PIXELS: Record<LegacyFontScale, number> = { compact: 14.5, standard: 16, large: 17.5 };
export function getInitialFontScale(): AppFontScale {
  try {
    const saved = localStorage.getItem(KEYS.FONT_SCALE);
    if (!saved) return 16;
    if (saved in LEGACY_FONT_PIXELS) return LEGACY_FONT_PIXELS[saved as LegacyFontScale];
    const pixels = Number(saved);
    return Number.isFinite(pixels) && pixels >= 12 && pixels <= 24 ? pixels : 16;
  } catch { return 16; }
}
export function saveFontScale(scale: AppFontScale): void {
  try {
    const pixels = typeof scale === 'number' ? scale : LEGACY_FONT_PIXELS[scale];
    localStorage.setItem(KEYS.FONT_SCALE, String(pixels));
  } catch {}
}

export type AppFontFamily = 'inter' | 'arial' | 'roboto' | 'be_vietnam_pro' | 'times_new_roman';

export const FONT_FAMILY_CSS: Record<AppFontFamily, string> = {
  inter: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  arial: "Arial, Helvetica, sans-serif",
  roboto: "'Roboto', sans-serif",
  be_vietnam_pro: "'Be Vietnam Pro', sans-serif",
  times_new_roman: "'Times New Roman', Times, serif",
};

export interface FontFamilyOption {
  id: AppFontFamily;
  label: string;
  desc: string;
  fontFamily: string;
}

export const FONT_FAMILY_OPTIONS: FontFamilyOption[] = [
  { id: 'inter', label: 'Inter', desc: 'Hiện đại & Chuẩn quốc tế', fontFamily: "'Inter', sans-serif" },
  { id: 'arial', label: 'Arial', desc: 'Phổ biến & Quen thuộc y tế', fontFamily: "Arial, sans-serif" },
  { id: 'roboto', label: 'Roboto', desc: 'Tròn trịa & Dễ đọc', fontFamily: "'Roboto', sans-serif" },
  { id: 'be_vietnam_pro', label: 'Be Vietnam Pro', desc: 'Tối ưu dấu tiếng Việt', fontFamily: "'Be Vietnam Pro', sans-serif" },
  { id: 'times_new_roman', label: 'Times New Roman', desc: 'Chuẩn văn bản bệnh án', fontFamily: "'Times New Roman', serif" },
];

export function getInitialFontFamily(): AppFontFamily {
  try {
    const saved = localStorage.getItem('clinical_app_font_family') as AppFontFamily | null;
    if (saved && saved in FONT_FAMILY_CSS) return saved;
  } catch {}
  return 'inter';
}

export function saveFontFamily(font: AppFontFamily): void {
  try {
    localStorage.setItem('clinical_app_font_family', font);
  } catch {}
}

/**
 * 6. Khôi phục tin nhắn Chatbot (Duy trì hội thoại khi F5)
 */
export function getInitialChatMessages(): ChatMessage[] {
  if (typeof window === 'undefined') return INITIAL_CHAT_MESSAGES;
  try {
    const raw = localStorage.getItem(KEYS.CHAT_MESSAGES) || localStorage.getItem('clinical_ward_chat_messages');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Tự động thanh lọc các tin nhắn cũ chứa các form nghiệp vụ đã lược bỏ (Mượn cơ số, Sự cố TBYT, Sổ nợ vỏ)
        const cleaned = parsed.filter(m => {
          if (!m) return false;
          const cardType = (m.card?.card_type || m.card?.type || '') as string;
          if (['borrow_confirm', 'incident_confirm', 'debt_settle', 'equipment_ticket'].includes(cardType)) {
            return false;
          }
          return true;
        });
        if (cleaned.length > 0) {
          return cleaned;
        }
      }
    }
  } catch (e) {}
  return INITIAL_CHAT_MESSAGES;
}

export function saveChatMessages(messages: ChatMessage[]): void {
  try {
    // Chỉ lưu 40 tin nhắn gần nhất để tiết kiệm bộ nhớ localStorage
    const truncated = messages.slice(-40);
    localStorage.setItem(KEYS.CHAT_MESSAGES, JSON.stringify(truncated));
  } catch (e) {}
}

export function clearStoredChatMessages(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(KEYS.CHAT_MESSAGES);
    localStorage.removeItem('clinical_ward_chat_messages');
    localStorage.removeItem('clinical_chat_messages');
    localStorage.removeItem('chat_messages');
  } catch (e) {}
}

/**
 * 7. Snapshot Dữ liệu Bộ Nhớ Đệm (Stale-While-Revalidate chống giật flash layout)
 */
export function getCachedDebts(): DebtRecord[] {
  try {
    const raw = localStorage.getItem(KEYS.CACHED_DEBTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return INITIAL_DEBT_RECORDS;
}

export function saveCachedDebts(debts: DebtRecord[]): void {
  try {
    localStorage.setItem(KEYS.CACHED_DEBTS, JSON.stringify(debts));
  } catch {}
}

export function getCachedTickets(): EquipmentTicket[] {
  try {
    const raw = localStorage.getItem(KEYS.CACHED_TICKETS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return INITIAL_EQUIPMENT_TICKETS;
}

export function saveCachedTickets(tickets: EquipmentTicket[]): void {
  try {
    localStorage.setItem(KEYS.CACHED_TICKETS, JSON.stringify(tickets));
  } catch {}
}

export function getCachedBatches(): InventoryBatch[] {
  try {
    const raw = localStorage.getItem(KEYS.CACHED_BATCHES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return INITIAL_INVENTORY_BATCHES;
}

export function saveCachedBatches(batches: InventoryBatch[]): void {
  try {
    localStorage.setItem(KEYS.CACHED_BATCHES, JSON.stringify(batches));
  } catch {}
}

export function getCachedAuditRecords(): AuditTrailRecord[] {
  try {
    const raw = localStorage.getItem(KEYS.CACHED_AUDIT);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return INITIAL_AUDIT_TRAIL_RECORDS;
}

export function saveCachedAuditRecords(records: AuditTrailRecord[]): void {
  try {
    localStorage.setItem(KEYS.CACHED_AUDIT, JSON.stringify(records.slice(0, 50)));
  } catch {}
}

/**
 * Xóa sạch cache khi người dùng bấm "Đặt lại dữ liệu" (Reset Data)
 */
export function clearAllStoredState(): void {
  try {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', window.location.pathname);
    }
  } catch {}
}
