/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { Bot } from 'lucide-react';
import {
  DebtRecord,
  EquipmentTicket,
  InventoryBatch,
  ColdChainMonitorState,
  ChatMessage,
  IncidentStatus,
  AssetAuditRecord,
  UserRole,
  UserProfile,
  ClinicalActionType,
  AuditTrailRecord,
  ClinicalAuthRequest
} from './types/clinical';
import {
  INITIAL_DEBT_RECORDS,
  INITIAL_EQUIPMENT_TICKETS,
  INITIAL_INVENTORY_BATCHES,
  INITIAL_COLD_CHAIN_STATE,
  QUICK_SUGGESTION_CHIPS,
  ROLE_SUGGESTION_CHIPS,
  USER_PROFILES,
  INITIAL_CHAT_MESSAGES,
  INITIAL_ASSET_AUDIT_RECORDS,
  INITIAL_AUDIT_TRAIL_RECORDS
} from './data/initialData';
import { Sidebar } from './components/Sidebar';
import { ChatWindow } from './components/LeftPane/ChatWindow';
import { Dashboard, DashboardTab } from './components/RightPane/Dashboard';
import { TelegramToast } from './components/Modals/TelegramToast';
import { ClinicalAuthModal } from './components/Modals/ClinicalAuthModal';
import { AuditTrailModal } from './components/Modals/AuditTrailModal';
import { PatientDetailModal } from './components/Modals/PatientDetailModal';
import type { PrintableFormType } from './components/Modals/PrintableFormModal';
import { MobileBottomNav } from './components/Navigation/MobileBottomNav';
import { processClinicalAgentQueryAsync } from './utils/clinicalNLP';
import { borrowEmergencyItemApi, reportIncidentApi } from './services/api';
import { debtApi, equipmentApi, inventoryApi } from './services/api/index';
import { cpoeApi } from './services/api/cpoeApi';
import { clinicalAudio } from './utils/audio';

const LegalDocsModal = lazy(() => import('./components/Modals/LegalDocsModal').then(m => ({ default: m.LegalDocsModal })));
const UserGuideModal = lazy(() => import('./components/Modals/UserGuideModal').then(m => ({ default: m.UserGuideModal })));
const PrintableFormModal = lazy(() => import('./components/Modals/PrintableFormModal').then(m => ({ default: m.PrintableFormModal })));
const MedicationSafetyModal = lazy(() => import('./components/Modals/MedicationSafetyModal').then(m => ({ default: m.MedicationSafetyModal })));
import {
  getInitialTab,
  syncTabToUrl,
  getInitialUserRole,
  saveUserRole,
  getInitialSidebarCollapsed,
  saveSidebarCollapsed,
  getInitialCopilotOpen,
  saveCopilotOpen,
  getInitialCopilotExpanded,
  saveCopilotExpanded,
  getInitialAudioMuted,
  saveAudioMuted,
  getInitialChatMessages,
  saveChatMessages,
  getCachedDebts,
  saveCachedDebts,
  getCachedTickets,
  saveCachedTickets,
  getCachedBatches,
  saveCachedBatches,
  getCachedAuditRecords,
  saveCachedAuditRecords,
  clearAllStoredState
} from './utils/storage/appStatePersistence';

export default function App({ authenticatedRole, onLogout }: { authenticatedRole?: UserRole; onLogout?: () => Promise<void> } = {}) {
  // State khôi phục bền vững từ URL Hash & LocalStorage Cache (SWR chống giật layout khi reload)
  const [debts, setDebts] = useState<DebtRecord[]>(getCachedDebts);
  const [tickets, setTickets] = useState<EquipmentTicket[]>(getCachedTickets);
  const [batches, setBatches] = useState<InventoryBatch[]>(getCachedBatches);
  const [coldChainState, setColdChainState] = useState<ColdChainMonitorState>(INITIAL_COLD_CHAIN_STATE);
  const [assets, setAssets] = useState<AssetAuditRecord[]>(INITIAL_ASSET_AUDIT_RECORDS);
  const [auditRecords, setAuditRecords] = useState<AuditTrailRecord[]>(getCachedAuditRecords);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(getInitialChatMessages);
  const [currentTab, setCurrentTab] = useState<DashboardTab>(getInitialTab);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>(authenticatedRole || getInitialUserRole);
  const [authRequest, setAuthRequest] = useState<ClinicalAuthRequest | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(getInitialSidebarCollapsed);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState<boolean>(getInitialCopilotOpen);
  const [isCopilotExpanded, setIsCopilotExpanded] = useState<boolean>(getInitialCopilotExpanded);
  const [isLegalDocsOpen, setIsLegalDocsOpen] = useState<boolean>(false);
  const [isAuditTrailOpen, setIsAuditTrailOpen] = useState<boolean>(false);
  const [isUserGuideOpen, setIsUserGuideOpen] = useState<boolean>(false);
  const [isPrintableFormOpen, setIsPrintableFormOpen] = useState<boolean>(false);
  const [printableInitialType, setPrintableInitialType] = useState<PrintableFormType>('TT20_AMPOULE_DESTRUCTION');
  const [selectedDebtForPrint, setSelectedDebtForPrint] = useState<DebtRecord | null>(null);
  const [selectedTicketForPrint, setSelectedTicketForPrint] = useState<EquipmentTicket | null>(null);
  const [selectedAssetForPrint, setSelectedAssetForPrint] = useState<AssetAuditRecord | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(getInitialAudioMuted);
  const [chatPosition, setChatPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingChat, setIsDraggingChat] = useState(false);
  const chatDragOffset = useRef({ x: 0, y: 0 });
  const chatPanelRef = useRef<HTMLDivElement>(null);
  const dragFrame = useRef<number | null>(null);
  const pendingChatPosition = useRef<{ x: number; y: number } | null>(null);
  const [showTelegramToast, setShowTelegramToast] = useState<boolean>(false);
  const [isMedicationSafetyOpen, setIsMedicationSafetyOpen] = useState<boolean>(false);
  const [safetyModalMedName, setSafetyModalMedName] = useState<string | undefined>(undefined);
  const [safetyModalMedId, setSafetyModalMedId] = useState<string | undefined>(undefined);
  const [selectedPatientForGlobalModal, setSelectedPatientForGlobalModal] = useState<string | null>(null);

  useEffect(() => {
    const handleOpenPatient = (e: any) => {
      if (e?.detail?.patientName || e?.detail?.patientId) {
        setSelectedPatientForGlobalModal(e.detail.patientName || e.detail.patientId);
      }
    };
    window.addEventListener('open_patient_detail', handleOpenPatient);
    return () => window.removeEventListener('open_patient_detail', handleOpenPatient);
  }, []);

  const handleOpenMedicationSafety = (medNameOrId?: string) => {
    if (medNameOrId?.startsWith('med-')) {
      setSafetyModalMedId(medNameOrId);
      setSafetyModalMedName(undefined);
    } else {
      setSafetyModalMedName(medNameOrId);
      setSafetyModalMedId(undefined);
    }
    setIsMedicationSafetyOpen(true);
  };

  const handleChatPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const target = event.target as HTMLElement;
    const dragHandle = target.closest('[data-testid="chat-window-drag-handle"]');
    if (!dragHandle || target.closest('button, input, select, textarea, a')) return;
    const panel = event.currentTarget;
    const rect = panel.getBoundingClientRect();
    if (!rect) return;
    if (!chatPosition) setChatPosition({ x: rect.left, y: rect.top });
    pendingChatPosition.current = { x: rect.left, y: rect.top };
    chatDragOffset.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    setIsDraggingChat(true);
    event.preventDefault();
    panel.setPointerCapture(event.pointerId);
  };

  const handleChatPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingChat || isCopilotExpanded) return;
    const panel = event.currentTarget;
    const width = panel?.offsetWidth ?? Math.min(440, window.innerWidth - 32);
    const height = panel?.offsetHeight ?? Math.min(640, window.innerHeight - 40);
    pendingChatPosition.current = {
      x: Math.max(8, Math.min(window.innerWidth - width - 8, event.clientX - chatDragOffset.current.x)),
      y: Math.max(8, Math.min(window.innerHeight - height - 8, event.clientY - chatDragOffset.current.y)),
    };
    if (dragFrame.current === null) {
      dragFrame.current = window.requestAnimationFrame(() => {
        const next = pendingChatPosition.current;
        if (next && chatPanelRef.current) {
          chatPanelRef.current.style.left = String(next.x) + 'px';
          chatPanelRef.current.style.top = String(next.y) + 'px';
          chatPanelRef.current.style.right = 'auto';
          chatPanelRef.current.style.bottom = 'auto';
        }
        dragFrame.current = null;
      });
    }
  };

  useEffect(() => {
    if (!isDraggingChat) return;
    const stopDragging = () => {
      if (dragFrame.current !== null) {
        window.cancelAnimationFrame(dragFrame.current);
        dragFrame.current = null;
      }
      const finalPosition = pendingChatPosition.current;
      if (finalPosition) setChatPosition(finalPosition);
      pendingChatPosition.current = null;
      setIsDraggingChat(false);
    };
    window.addEventListener('pointerup', stopDragging);
    window.addEventListener('pointercancel', stopDragging);
    return () => { window.removeEventListener('pointerup', stopDragging); window.removeEventListener('pointercancel', stopDragging); };
  }, [isDraggingChat]);

  // Stop alarm on unmount
  useEffect(() => {
    return () => {
      clinicalAudio.stopAlarm();
    };
  }, []);

  // Global ergonomics: Cmd+K / Ctrl+K toggles Clinical AI Copilot
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileSidebarOpen(false);
        setIsCopilotOpen(false);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCopilotOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Keep the page behind the mobile navigation drawer from scrolling.
  useEffect(() => {
    if (!isMobileSidebarOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [isMobileSidebarOpen]);

  // 1. Tự động đồng bộ Tab sang URL Hash (#cpoe, #fefo...) và LocalStorage
  useEffect(() => {
    syncTabToUrl(currentTab);
  }, [currentTab]);

  // 2. Lắng nghe sự kiện hashchange (Hỗ trợ nút Back / Forward trình duyệt)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '').toLowerCase() as DashboardTab;
      if (['cpoe', 'debt', 'equipment', 'fefo', 'coldchain', 'asset_audit'].includes(hash)) {
        setCurrentTab(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // 3. Tự động lưu bền vững các tùy chọn giao diện khi thay đổi
  useEffect(() => { saveChatMessages(chatMessages); }, [chatMessages]);
  useEffect(() => { saveSidebarCollapsed(isSidebarCollapsed); }, [isSidebarCollapsed]);
  useEffect(() => { saveCopilotOpen(isCopilotOpen); }, [isCopilotOpen]);
  useEffect(() => { saveCopilotExpanded(isCopilotExpanded); }, [isCopilotExpanded]);
  useEffect(() => { saveAudioMuted(isAudioMuted); }, [isAudioMuted]);

  // 4. Đồng bộ dữ liệu ngầm với SQLite WAL backend (Stale-While-Revalidate chống giật layout)
  useEffect(() => {
    let isMounted = true;
    Promise.allSettled([
      debtApi.fetchDebts(),
      equipmentApi.fetchEquipmentTickets(),
      inventoryApi.fetchInventoryBatches(),
    ]).then(([resDebts, resTickets, resBatches]) => {
      if (!isMounted) return;
      if (resDebts.status === 'fulfilled' && resDebts.value.length > 0) {
        setDebts(resDebts.value);
        saveCachedDebts(resDebts.value);
      }
      if (resTickets.status === 'fulfilled' && resTickets.value.length > 0) {
        setTickets(resTickets.value);
        saveCachedTickets(resTickets.value);
      }
      if (resBatches.status === 'fulfilled' && resBatches.value.length > 0) {
        setBatches(resBatches.value);
        saveCachedBatches(resBatches.value);
      }
    }).catch(() => {});
    return () => { isMounted = false; };
  }, []);

  // Handler: Switch user role (RBAC)
  const handleSelectUserRole = (newRole: UserRole) => {
    setCurrentUserRole(newRole);
    saveUserRole(newRole);
    const profile = USER_PROFILES[newRole];
    if (profile && !profile.allowedTabs.includes(currentTab)) {
      setCurrentTab(profile.defaultTab);
    }
    if (!isAudioMuted) clinicalAudio.playSuccessChime();
  };

  // Handler: Open Printable Forms Center (Option A: Bộ Y Tế & Bộ Tài Chính)
  const handleOpenPrintForm = (
    formType: PrintableFormType = 'TT20_AMPOULE_DESTRUCTION',
    item?: any
  ) => {
    setPrintableInitialType(formType);
    if (formType === 'TT20_AMPOULE_DESTRUCTION' || formType === 'EMERGENCY_BORROW_TICKET') {
      setSelectedDebtForPrint((item as DebtRecord) || debts[0] || null);
    } else if (formType === 'EQUIPMENT_HANDOVER_INSPECT') {
      setSelectedTicketForPrint((item as EquipmentTicket) || tickets[0] || null);
    } else if (formType === 'TSC_HANDOVER_TRANSFER' || formType === 'TSC_ANNUAL_AUDIT') {
      setSelectedAssetForPrint((item as AssetAuditRecord) || assets[0] || null);
    }
    setIsPrintableFormOpen(true);
  };

  // Helper: Append immutable audit record & notify AI Copilot
  const appendAuditRecord = (
    actionType: ClinicalActionType,
    actionTitle: string,
    targetItem: string,
    legalBasis: string,
    signer: UserProfile,
    witness?: UserProfile,
    authMethod: 'PIN' | 'RFID_NFC' = 'PIN'
  ) => {
    const nowStr = new Date().toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    const recordId = `AUD-2026-${String(auditRecords.length + 41).padStart(4, '0')}`;
    const randomHash = Math.random().toString(36).substring(2, 8);
    const integrityHash = `SHA256:${randomHash}a1...${randomHash}f9`;

    const newRecord: AuditTrailRecord = {
      id: recordId,
      timestamp: nowStr,
      actionType,
      actionTitle,
      targetItem,
      legalBasis,
      signerRole: signer.role,
      signerName: signer.name,
      signerCertificate: signer.practiceCertificate,
      witnessRole: witness?.role,
      witnessName: witness?.name,
      witnessCertificate: witness?.practiceCertificate,
      authMethod,
      integrityHash,
      status: 'verified'
    };

    setAuditRecords(prev => [newRecord, ...prev]);

    // Also push verifiable confirmation message to AI Copilot
    const auditMsg: ChatMessage = {
      id: `msg-audit-${Date.now()}`,
      sender: 'system',
      text: `🔒 **Ký xác thực lâm sàng thành công (${recordId})**:
• **Nghiệp vụ**: ${actionTitle}
• **Đối tượng**: ${targetItem}
• **Người ký duyệt**: ${signer.name} (${signer.roleName}) - CCHN: \`${signer.practiceCertificate}\`
${witness ? `• **Người làm chứng**: ${witness.name} (${witness.roleName}) - CCHN: \`${witness.practiceCertificate}\`\n` : ''}• **Phương thức xác nhận**: ${authMethod === 'RFID_NFC' ? 'Thẻ định danh nhân viên' : 'Mã PIN chuyên môn'}
• **Căn cứ pháp lý**: ${legalBasis}`,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      legalReference: {
        lawCode: legalBasis.split(' - ')[0] || legalBasis,
        title: actionTitle,
        clause: 'Ký số y tế (NĐ 130)'
      }
    };
    setChatMessages(prev => [...prev, auditMsg]);
  };

  // Handler: Reset mock data
  const handleResetData = () => {
    clinicalAudio.stopAlarm();
    clearAllStoredState();
    setDebts(INITIAL_DEBT_RECORDS);
    setTickets(INITIAL_EQUIPMENT_TICKETS);
    setBatches(INITIAL_INVENTORY_BATCHES);
    setColdChainState(INITIAL_COLD_CHAIN_STATE);
    setAssets(INITIAL_ASSET_AUDIT_RECORDS);
    setAuditRecords(INITIAL_AUDIT_TRAIL_RECORDS);
    setChatMessages(INITIAL_CHAT_MESSAGES);
    setCurrentUserRole('nurse');
    setCurrentTab('debt');
    setAuthRequest(null);
    setIsCopilotOpen(false);
    setIsLegalDocsOpen(false);
    setIsAuditTrailOpen(false);
    setIsUserGuideOpen(false);
    setShowTelegramToast(false);
    if (!isAudioMuted) clinicalAudio.playSuccessChime();
  };

  // Handler: Settle debt in Tab 1 (Requires clinical authentication)
  const handleSettleDebt = (id: string) => {
    const item = debts.find(d => d.id === id);
    if (!item) return;

    setAuthRequest({
      actionType: 'SETTLE_DEBT',
      title: 'Phê duyệt Hoàn bù Cơ số Thuốc tủ trực cấp cứu',
      description: `Xác nhận nộp đơn thuốc hợp lệ và hoàn bù cơ số tủ trực cho bệnh nhân ${item.patientName} (${item.patientRoom}).`,
      targetItem: `${item.code}: ${item.itemName} (${item.quantity})`,
      legalBasis: item.legalBasis || 'Thông tư 22/2011/TT-BYT - Điều 9 & Điều 10',
      requiredRoles: ['pharmacist', 'doctor', 'nurse', 'director'],
      onConfirm: (signer, witness, method) => {
        const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

        // 1. Update debt status in Tab 1
        setDebts(prev =>
          prev.map(d =>
            d.id === id
              ? {
                  ...d,
                  status: 'settled',
                  settledAt: `${nowTime} - ${signer.name} (${signer.roleName}) đã duyệt hoàn bù`
                }
              : d
          )
        );

        // 2. Cross-module: Deduct inventory stock from Kho Dược (Tab 3) following FEFO
        const qtyMatch = item.quantity.match(/\d+/);
        const parsedQty = qtyMatch ? parseInt(qtyMatch[0], 10) : 1;
        let deductedBatchNumber = '';

        setBatches(prev => {
          const lowerItem = item.itemName.toLowerCase();
          const matched = prev
            .filter(b => {
              const lowerBatch = b.itemName.toLowerCase();
              if (lowerItem.includes('morphin') && lowerBatch.includes('morphin')) return true;
              if (lowerItem.includes('fentanyl') && lowerBatch.includes('fentanyl')) return true;
              if (lowerItem.includes('ceftriaxone') && lowerBatch.includes('ceftriaxone')) return true;
              if (lowerItem.includes('meropenem') && lowerBatch.includes('meropenem')) return true;
              if (lowerItem.includes('adrenalin') && lowerBatch.includes('adrenalin')) return true;
              if (lowerItem.includes('noradrenalin') && lowerBatch.includes('noradrenalin')) return true;
              if (lowerItem.includes('diazepam') && (lowerBatch.includes('diazepam') || lowerBatch.includes('midazolam'))) return true;
              if (lowerItem.includes('cordarone') && lowerBatch.includes('cordarone')) return true;
              if (lowerItem.includes('truyền') && (lowerBatch.includes('truyền') || lowerBatch.includes('bơm'))) return true;
              if (lowerItem.includes('catgut') && lowerBatch.includes('catgut')) return true;
              if (lowerItem.includes('catheter') && lowerBatch.includes('catheter')) return true;
              return false;
            })
            .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

          if (matched.length > 0) {
            const targetBatch = matched[0];
            deductedBatchNumber = targetBatch.batchNumber;
            return prev.map(b => {
              if (b.id === targetBatch.id) {
                const updatedStock = Math.max(0, b.currentStock - parsedQty);
                return {
                  ...b,
                  currentStock: updatedStock,
                  isLowStock: updatedStock <= b.minThreshold
                };
              }
              return b;
            });
          }
          return prev;
        });

        // 3. Immutable audit trail entry
        appendAuditRecord(
          'SETTLE_DEBT',
          'Hoàn bù cơ số tủ trực cấp cứu & Xuất kho cấp phát',
          `${item.code}: ${item.itemName} (${item.quantity}) -> Kho Dược xuất bù Lô ${deductedBatchNumber || 'cận hạn'}`,
          'Thông tư 22/2011/TT-BYT & TT 36/2018 GSP',
          signer,
          witness,
          method
        );

        // 4. Copilot message notification
        const copilotMsg: ChatMessage = {
          id: `msg-settle-link-${Date.now()}`,
          sender: 'agent',
          text: `Hoàn bù cơ số tủ trực & Trừ kho Dược thành công:
• Phiếu: **${item.code}** (${item.itemName} - SL: ${item.quantity})
• Kho Dược: Đã xuất bù ${parsedQty} đơn vị từ **Lô ${deductedBatchNumber || 'cận hạn nhất'}**.
• Căn cứ: Điều 10 Thông tư 22/2011/TT-BYT & TT 36/2018 GSP.`,
          timestamp: nowTime,
          legalReference: {
            lawCode: 'TT 22/2011 & TT 36/2018 GSP',
            title: 'Hoàn bù cơ số & Xuất kho cấp phát',
            clause: 'Điều 10'
          }
        };
        setChatMessages(prev => [...prev, copilotMsg]);
      }
    });
  };

  // Handler: Update equipment ticket status in Tab 2
  const handleUpdateTicketStatus = (id: string, newStatus: IncidentStatus) => {
    const ticket = tickets.find(t => t.id === id);
    if (!ticket) return;

    if (newStatus === 'resolved') {
      setAuthRequest({
        actionType: 'HANDOVER_EQUIPMENT',
        title: 'Nghiệm thu Thử tải An toàn điện & Bàn giao Lâm sàng',
        description: `Xác nhận thiết bị đã qua kiểm định an toàn điện lực, đạt tiêu chuẩn lâm sàng và sẵn sàng đưa vào buồng bệnh phục vụ bệnh nhân.`,
        targetItem: `${ticket.code}: ${ticket.deviceName} (${ticket.serialNumber}) - Loại ${ticket.riskClass}`,
        legalBasis: 'Điều 34 Nghị định 98/2021/NĐ-CP & NĐ 07/2023',
        requiredRoles: ['biomedical_engineer', 'director'],
        requiresDualWitness: true,
        dualWitnessRoles: ['nurse', 'doctor'],
        onConfirm: (signer, witness, method) => {
          const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
          setTickets(prev =>
            prev.map(t =>
              t.id === id
                ? {
                    ...t,
                    status: 'resolved',
                    actionLog: [...(t.actionLog || []), `${nowTime}: ${signer.name} (BME) và ${witness?.name || 'ĐD'} đã nghiệm thu thử tải bàn giao`]
                  }
                : t
            )
          );

          // Cross-module: Synchronize with Tab 5 Asset Audit Record
          setAssets(prev =>
            prev.map(a =>
              a.serialNumber === ticket.serialNumber || a.code === ticket.code
                ? {
                    ...a,
                    condition: 'operational',
                    actualDepartment: ticket.location
                  }
                : a
            )
          );

          appendAuditRecord(
            'HANDOVER_EQUIPMENT',
            'Kiểm định an toàn điện & Nghiệm thu bàn giao thiết bị',
            `${ticket.code}: ${ticket.deviceName} (SN: ${ticket.serialNumber})`,
            'Điều 34 Nghị định 98/2021/NĐ-CP',
            signer,
            witness,
            method
          );
        }
      });
    } else {
      const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      setTickets(prev =>
        prev.map(t =>
          t.id === id
            ? {
                ...t,
                status: newStatus,
                actionLog: [...(t.actionLog || []), `${nowTime}: Cập nhật trạng thái '${newStatus}'`]
              }
            : t
        )
      );
    }
  };

  // Handler: Add new debt (Manual borrowing from cabinet without AI)
  const handleAddNewDebt = (newRecordData: Omit<DebtRecord, 'id' | 'code' | 'borrowDate' | 'borrowTime' | 'status'>) => {
    setAuthRequest({
      actionType: 'BORROW_EMERGENCY',
      title: 'Ký xác thực Xuất mượn khẩn Thuốc / Vật tư Tủ trực ca đêm',
      description: `Xác nhận điều dưỡng/bác sĩ xuất mượn khẩn cơ số ${newRecordData.itemName} (${newRecordData.quantity}) cho bệnh nhân ${newRecordData.patientName} tại ${newRecordData.patientRoom}.`,
      targetItem: `${newRecordData.itemName} (${newRecordData.quantity}) - ${newRecordData.patientName}`,
      legalBasis: newRecordData.legalBasis || 'Thông tư 22/2011/TT-BYT - Điều 9 & Điều 10',
      requiredRoles: ['nurse', 'doctor', 'pharmacist', 'director'],
      onConfirm: (signer, witness, method) => {
        const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        const newCode = `PN-2026-${String(debts.length + 92).padStart(3, '0')}`;
        const newDebtRecord: DebtRecord = {
          ...newRecordData,
          id: `debt-${Date.now()}`,
          code: newCode,
          borrowTime: nowTime,
          borrowDate: '2026-10-16',
          status: 'debt',
          borrowerName: `${signer.name} (${signer.roleName})`
        };

        setDebts(prev => [newDebtRecord, ...prev]);

        debtApi.borrowItem({
          itemName: newRecordData.itemName,
          itemType: newRecordData.itemType,
          quantity: newRecordData.quantity,
          patientName: newRecordData.patientName,
          patientRoom: newRecordData.patientRoom,
          borrowerName: `${signer.name} (${signer.roleName})`,
          clinicalReason: newRecordData.note,
        }).catch((err) => console.warn('Could not persist debt to backend:', err));

        appendAuditRecord(
          'BORROW_EMERGENCY',
          'Xuất mượn khẩn cơ số tủ trực cấp cứu ca đêm',
          `${newCode}: ${newRecordData.itemName} (${newRecordData.quantity}) - BN: ${newRecordData.patientName}`,
          newDebtRecord.legalBasis,
          signer,
          witness,
          method
        );

        const copilotMsg: ChatMessage = {
          id: `msg-borrow-${Date.now()}`,
          sender: 'system',
          text: `📋 **Ghi sổ nợ tủ trực thành công (${newCode})**:
• **Thuốc/Vật tư**: ${newRecordData.itemName} (SL: ${newRecordData.quantity})
• **Bệnh nhân**: ${newRecordData.patientName} - ${newRecordData.patientRoom}
• **Người thực hiện**: ${signer.name} (${signer.roleName}) - CCHN: \`${signer.practiceCertificate}\`
• **Quy định hoàn bù**: Bác sĩ kê đơn bù trước 07:00 sáng mai (TT 22/2011/TT-BYT).`,
          timestamp: nowTime
        };
        setChatMessages(prev => [...prev, copilotMsg]);
      }
    });
  };

  // Handler: Add new ticket (Manual equipment incident without AI)
  const handleAddNewTicket = (newTicket: EquipmentTicket) => {
    setAuthRequest({
      actionType: 'CREATE_INCIDENT',
      title: 'Ký xác thực Báo hỏng / Sự cố Trang thiết bị y tế',
      description: `Ghi nhận sự cố hư hỏng lâm sàng đối với thiết bị ${newTicket.deviceName} (SN: ${newTicket.serialNumber}) tại ${newTicket.location}.`,
      targetItem: `${newTicket.code}: ${newTicket.deviceName} (${newTicket.serialNumber})`,
      legalBasis: newTicket.legalBasis || 'Điều 34 Nghị định 98/2021/NĐ-CP & NĐ 07/2023',
      requiredRoles: ['nurse', 'doctor', 'biomedical_engineer', 'director'],
      onConfirm: (signer, witness, method) => {
        setTickets(prev => [newTicket, ...prev]);
        appendAuditRecord(
          'CREATE_INCIDENT',
          'Báo hỏng / sự cố trang thiết bị y tế',
          `${newTicket.code}: ${newTicket.deviceName} (${newTicket.serialNumber})`,
          newTicket.legalBasis,
          signer,
          witness,
          method
        );
      }
    });
  };

  // Handler: Dispatch batch in Tab 3 (FEFO) (Requires pharmacist/director auth)
  const handleDispatchBatch = (batchId: string, quantity: number) => {
    const batch = batches.find(b => b.id === batchId);
    if (!batch) return;

    setAuthRequest({
      actionType: 'DISPATCH_FEFO',
      title: 'Ký lệnh xuất kho dược phẩm cấp phát',
      description: `Xác nhận lệnh xuất ${quantity} ${batch.unit} từ ${batch.warehouseLocation} (${batch.expiryDate}).`,
      targetItem: `${batch.itemName} (Lô: ${batch.batchNumber}, EXP: ${batch.expiryDate})`,
      legalBasis: 'Khoản 2 Điều 12 Thông tư 36/2018/TT-BYT (GSP)',
      requiredRoles: ['pharmacist', 'director'],
      onConfirm: (signer, witness, method) => {
        setBatches(prev =>
          prev.map(b => {
            if (b.id === batchId) {
              const updatedStock = Math.max(0, b.currentStock - quantity);
              return {
                ...b,
                currentStock: updatedStock
              };
            }
            return b;
          })
        );
        appendAuditRecord(
          'DISPATCH_FEFO',
          'Xuất kho dược phẩm cấp phát',
          `${batch.itemName} (Lô ${batch.batchNumber}) - SL: ${quantity} ${batch.unit}`,
          'Khoản 2 Điều 12 Thông tư 36/2018/TT-BYT (GSP)',
          signer,
          witness,
          method
        );
      }
    });
  };

  // Handler: Destroy returned narcotics ampoules (TT 20/2017/TT-BYT Council - MANDATORY DUAL WITNESS)
  const handleDestroyAmpoules = (ids: string[]) => {
    setAuthRequest({
      actionType: 'DESTROY_AMPOULES',
      title: 'Hội đồng Tiêu hủy Vỏ ống Thuốc gây nghiện (Mẫu số 10/TT20)',
      description: `Thực hiện nghiền nát tiêu hủy hoàn toàn ${ids.length} vỏ ống Morphin sulfat / Fentanyl trước sự chứng kiến độc lập của Hội đồng 02 thành viên.`,
      targetItem: `${ids.length} vỏ ống thủy tinh thuốc gây nghiện đã thu hồi`,
      legalBasis: 'Điều 15 Thông tư 20/2017/TT-BYT',
      requiredRoles: ['pharmacist', 'director'],
      requiresDualWitness: true,
      dualWitnessRoles: ['nurse', 'doctor'],
      onConfirm: (signer, witness, method) => {
        setDebts(prev =>
          prev.map(d =>
            ids.includes(d.id)
              ? {
                  ...d,
                  ampouleDestroyed: true
                }
              : d
          )
        );

        appendAuditRecord(
          'DESTROY_AMPOULES',
          'Hội đồng Tiêu hủy Vỏ ống Thuốc gây nghiện',
          `${ids.length} vỏ ống thủy tinh Morphin sulfat / Fentanyl`,
          'Điều 15 Thông tư 20/2017/TT-BYT',
          signer,
          witness,
          method
        );
      }
    });
  };

  // Handler: Request restocking for low-stock inventory batches (TT 22/2011/TT-BYT)
  const handleRestockBatches = (batchIds: string[]) => {
    setAuthRequest({
      actionType: 'RESTOCK_MEDICATION',
      title: 'Ký duyệt Phiếu Dự trù Bổ sung Cơ số Thuốc',
      description: `Phê duyệt nhập khẩn cho ${batchIds.length} mặt hàng thuốc/vật tư đang chạm ngưỡng tối thiểu để phục hồi về định mức an toàn.`,
      targetItem: `${batchIds.length} mặt hàng cạn cơ số an toàn`,
      legalBasis: 'Điều 7 Thông tư 22/2011/TT-BYT',
      requiredRoles: ['pharmacist', 'director'],
      onConfirm: (signer, witness, method) => {
        setBatches(prev =>
          prev.map(b => {
            if (batchIds.includes(b.id)) {
              return {
                ...b,
                currentStock: b.maxThreshold,
                isLowStock: false
              };
            }
            return b;
          })
        );
        appendAuditRecord(
          'RESTOCK_MEDICATION',
          'Phê duyệt Phiếu Dự trù Bổ sung Cơ số Thuốc',
          `${batchIds.length} mặt hàng thuốc/vật tư`,
          'Điều 7 Thông tư 22/2011/TT-BYT',
          signer,
          witness,
          method
        );
      }
    });
  };

  // Handler: Simulate 07:00 AM Morning Reminder (Requested in prompt)
  const handleSimulateMorningReminder = () => {
    if (!isAudioMuted) {
      clinicalAudio.playTelegramChime();
    }
    setShowTelegramToast(true);

    const activeDebtList = debts.filter(d => d.status === 'debt');
    const nowStr = '07:00 AM';

    const reminderMsg: ChatMessage = {
      id: `msg-reminder-${Date.now()}`,
      sender: 'agent',
      text: `Nhắc giao ban 07:00 sáng (Thông tư 22/2011/TT-BYT):
Hiện có **${activeDebtList.length} khoản nợ tủ trực** chưa hoàn bù cơ số.
Đề nghị Điều dưỡng trưởng mang đơn thuốc đã ký duyệt lên Kho Dược nhận bù cơ số trước 08:30 sáng.`,
      timestamp: nowStr,
      legalReference: {
        lawCode: 'TT 22/2011/TT-BYT',
        title: 'Hoàn bù cơ số tủ trực',
        clause: 'Điều 10'
      },
      actionPayload: {
        type: 'DEBT_REMINDER',
        targetTab: 'debt'
      }
    };

    setChatMessages(prev => [...prev, reminderMsg]);
    setCurrentTab('debt');
  };

  // Handler: Trigger Cold Chain Outage (Requested in prompt: Jump to 11°C, red alarm, sound, message to left pane)
  const handleTriggerOutage = () => {
    // 1. Update cold chain state to 11.0°C and alarm active
    const nowStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const newLog = {
      timestamp: nowStr,
      temperature: 11.0,
      humidity: 68,
      status: 'critical' as const
    };

    setColdChainState(prev => ({
      ...prev,
      currentTemp: 11.0,
      currentHumidity: 68,
      powerStatus: 'outage_critical',
      compressorStatus: 'fault',
      alarmActive: true,
      alarmMessage: 'MẤT ĐIỆN LƯỚI - NHIỆT ĐỘ 11.0°C',
      logs: [...prev.logs, newLog]
    }));

    // Cross-module: Automatically open urgent maintenance ticket for BME in Tab 2
    const newOutageTicket: EquipmentTicket = {
      id: 'eq-outage-vax01',
      code: 'SC-2026-045',
      deviceName: 'Tủ chuyên dụng bảo quản Vắc xin số 1 (Dometic HC-302)',
      deviceModel: 'Dometic HC-302 Cold Chain GSP',
      serialNumber: 'DOM-HC302-VAX01',
      riskClass: 'B',
      accessoryIssue: 'Mất điện lưới 220V, máy nén dừng, nhiệt độ buồng vọt lên 11.0°C (Vượt dải 2-8°C GSP)',
      location: 'Kho Lạnh Dược - Phòng Chuỗi Lạnh',
      urgency: 'urgent',
      assignedEngineer: 'KS. Đặng Văn Nam (Phòng Vật tư - TBYT)',
      status: 'in_progress',
      reportTime: `${nowStr} - Cảnh báo tự động IoT`,
      lastInspectionDate: '10/05/2026',
      nextInspectionDue: '10/05/2027',
      inspectionUnit: 'Quatest 1',
      legalBasis: 'Điều 34 Nghị định 98/2021/NĐ-CP & TT 36/2018/TT-BYT GSP',
      actionLog: [
        `${nowStr}: Cảm biến IoT phát hiện mất điện lưới 220V, nhiệt độ đạt đỉnh 11.0°C`,
        `${nowStr}: Hệ thống tự động mở Ticket khẩn cho KS. Đặng Văn Nam kiểm tra nguồn điện & máy phát dự phòng`
      ]
    };
    setTickets(prev => [newOutageTicket, ...prev.filter(t => t.id !== 'eq-outage-vax01')]);

    // 2. Play medical emergency alarm
    if (!isAudioMuted) {
      clinicalAudio.playEmergencyAlarm();
    }

    // 3. Dispatch urgent AI agent message to the Left Pane
    const alertMsg: ChatMessage = {
      id: `msg-outage-${Date.now()}`,
      sender: 'agent',
      text: `🚨 Cảnh báo mất điện Tủ vaccine số 1 (Nhiệt độ: **11.0°C**):
Vượt dải an toàn 2.0°C - 8.0°C theo chuẩn GSP.
Quy trình ứng phó SOP-GSP-09:
1. Không mở cửa tủ.
2. Hệ thống đã tự động tạo Ticket sửa chữa khẩn **#SC-2026-045** cho KS. Đặng Văn Nam.
3. Nếu quá 15 phút chưa có điện: Kích hoạt hòm đá tích lạnh bảo quản khẩn 1.250 liều sinh phẩm.`,
      timestamp: nowStr,
      legalReference: {
        lawCode: 'TT 36/2018/TT-BYT GSP & NĐ 98',
        title: 'Dây chuyền lạnh & Thiết bị',
        clause: 'Bảo quản vắc xin'
      },
      actionPayload: {
        type: 'OUTAGE_SIMULATION',
        targetTab: 'coldchain'
      }
    };

    setChatMessages(prev => [...prev, alertMsg]);
    setCurrentTab('coldchain');
  };

  // Handler: Restore power in Tab 4 (Requires pharmacist/BME authentication and activates Quarantine)
  const handleRestorePower = () => {
    clinicalAudio.stopAlarm();
    setAuthRequest({
      actionType: 'RESTORE_POWER',
      title: 'Xác nhận Khôi phục Dây chuyền lạnh GSP & Kích hoạt Biệt trữ',
      description: 'Xác nhận nguồn điện AC 220V hoạt động bình thường, máy nén làm lạnh đã phục hồi nhiệt độ về 4.5°C. Kích hoạt trạng thái Biệt trữ (Quarantine) cho 1.250 liều vắc xin theo Điều 12 TT 36/2018 GSP.',
      targetItem: 'Tủ bảo quản vắc xin số 1 - Kho Lạnh Dược',
      legalBasis: 'Thông tư 36/2018/TT-BYT (GSP) - Điều 12 Quy chế Biệt trữ',
      requiredRoles: ['pharmacist', 'biomedical_engineer', 'director'],
      onConfirm: (signer, witness, method) => {
        const nowStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        const restoreLog = {
          timestamp: nowStr,
          temperature: 4.5,
          humidity: 54,
          status: 'normal' as const
        };

        setColdChainState(prev => ({
          ...prev,
          currentTemp: 4.5,
          currentHumidity: 54,
          powerStatus: 'main_power',
          compressorStatus: 'running',
          alarmActive: false,
          alarmMessage: undefined,
          quarantineStatus: 'quarantined',
          quarantineReason: 'Nhiệt độ buồng đạt 11.0°C. Biệt trữ chờ Hội đồng Dược thẩm định chỉ thị VVM & MKT.',
          vvmStage: 1,
          mktTemperature: 5.6,
          logs: [...prev.logs, restoreLog]
        }));

        // Cross-module: Update ticket in Tab 2 to inspected
        setTickets(prev =>
          prev.map(t =>
            t.code === 'SC-2026-045'
              ? {
                  ...t,
                  status: 'inspected',
                  actionLog: [
                    ...(t.actionLog || []),
                    `${nowStr}: ${signer.name} đã phục hồi nguồn điện, nhiệt độ hạ về 4.5°C. Đã niêm phong biệt trữ 1.250 liều vắc xin chờ Hội đồng Dược kiểm định VVM`
                  ]
                }
              : t
          )
        );

        appendAuditRecord(
          'RESTORE_POWER',
          'Khôi phục điện chuỗi lạnh & Kích hoạt Biệt trữ GSP',
          'Tủ vắc xin số 1 (4.5°C) - 1.250 liều chuyển vào Biệt trữ',
          'Thông tư 36/2018/TT-BYT (GSP)',
          signer,
          witness,
          method
        );

        const restoreMsg: ChatMessage = {
          id: `msg-restore-${Date.now()}`,
          sender: 'agent',
          text: `Khôi phục nguồn điện tủ vắc xin thành công (Nhiệt độ: **4.5°C**):
• ${signer.name} (${signer.roleName}) đã nghiệm thu nguồn điện lưới ổn định.
• **Quy chế Biệt trữ GSP kích hoạt:** Do phơi nhiễm 11.0°C, toàn bộ **1.250 liều vắc xin** đang ở trạng thái **Biệt trữ (Quarantine)**.
• Hội đồng Dược & ĐT cần kiểm tra chỉ thị màu VVM và ký duyệt *Lệnh Giải Phóng Lô* trước khi đưa vắc xin vào sử dụng.`,
          timestamp: nowStr,
          legalReference: {
            lawCode: 'TT 36/2018/TT-BYT (GSP)',
            title: 'Biệt trữ thuốc/vắc xin sự cố',
            clause: 'Điều 12'
          }
        };
        setChatMessages(prev => [...prev, restoreMsg]);
      }
    });
  };

  // Handler: Release vaccine quarantine after VVM inspection (TT 36/2018 GSP & WHO PQS - DUAL WITNESS)
  const handleReleaseVaccineQuarantine = () => {
    setAuthRequest({
      actionType: 'RELEASE_VACCINE_QUARANTINE',
      title: 'Hội đồng Dược & ĐT: Ký Lệnh Giải Phóng Lô Vắc Xin sau Sự cố Nhiệt độ',
      description: 'Xác nhận chỉ thị VVM Stage 1 (An toàn), nhiệt độ MKT 5.6°C và thời gian phơi nhiễm 12 phút đạt chuẩn an toàn sinh học theo WHO. Giải phóng 1.250 liều vắc xin từ khu vực biệt trữ về kho sử dụng.',
      targetItem: '1.250 liều vắc xin (Verorab, SAT 1500, Viêm gan B) - Tủ bảo quản số 1',
      legalBasis: 'Điều 12 Thông tư 36/2018/TT-BYT (GSP) & Hướng dẫn WHO/IVB/06.10',
      requiredRoles: ['pharmacist', 'director'],
      requiresDualWitness: true,
      dualWitnessRoles: ['doctor', 'nurse'],
      onConfirm: (signer, witness, method) => {
        const nowStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        setColdChainState(prev => ({
          ...prev,
          quarantineStatus: 'released',
          quarantineReason: undefined
        }));

        // Cross-module: Update ticket in Tab 2 to resolved
        setTickets(prev =>
          prev.map(t =>
            t.code === 'SC-2026-045'
              ? {
                  ...t,
                  status: 'resolved',
                  actionLog: [
                    ...(t.actionLog || []),
                    `${nowStr}: ${signer.name} (Kho Dược) và ${witness?.name} đã ký biên bản giải phóng lô tiêm chủng theo chuẩn GSP`
                  ]
                }
              : t
          )
        );

        appendAuditRecord(
          'RELEASE_VACCINE_QUARANTINE',
          'Ký Lệnh Giải Phóng Lô Vắc Xin sau Sự cố Chuỗi lạnh',
          '1.250 liều vắc xin (VVM Stage 1, MKT 5.6°C) - Kho Lạnh Dược GSP',
          'Điều 12 Thông tư 36/2018/TT-BYT (GSP)',
          signer,
          witness,
          method
        );

        const releaseMsg: ChatMessage = {
          id: `msg-release-vax-${Date.now()}`,
          sender: 'agent',
          text: `Giải phóng lô vắc xin thành công (Chuẩn GSP & WHO):
• ${signer.name} (${signer.roleName}) và ${witness?.name} đã nghiệm thu chỉ thị VVM Stage 1 & MKT 5.6°C.
• Toàn bộ **1.250 liều vắc xin** đã được chuyển từ trạng thái Biệt trữ về Kho tiêm chủng an toàn.
• Ticket sửa chữa thiết bị **SC-2026-045** đã được hoàn tất và đóng sổ.`,
          timestamp: nowStr,
          legalReference: {
            lawCode: 'TT 36/2018/TT-BYT (GSP)',
            title: 'Giải phóng lô vắc xin',
            clause: 'Điều 12'
          }
        };
        setChatMessages(prev => [...prev, releaseMsg]);
      }
    });
  };

  // Handler: Toggle ampoule shell return for narcotics (TT 20/2017)
  const handleToggleAmpouleReturn = (id: string) => {
    const item = debts.find(d => d.id === id);
    if (!item) return;

    setAuthRequest({
      actionType: 'RETURN_AMPOULE',
      title: 'Xác nhận Thu hồi Vỏ ống Thuốc gây nghiện vào khay kiểm soát',
      description: `Kiểm đếm và khóa vỏ ống thủy tinh rỗng vào khay niêm phong của tủ trực theo quy chuẩn Thông tư 20.`,
      targetItem: `${item.code}: ${item.itemName} (${item.quantity}) - BN: ${item.patientName}`,
      legalBasis: 'Điều 15 Thông tư 20/2017/TT-BYT',
      requiredRoles: ['nurse', 'pharmacist', 'doctor', 'director'],
      onConfirm: (signer, witness, method) => {
        const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        setDebts(prev =>
          prev.map(d =>
            d.id === id
              ? {
                  ...d,
                  ampouleReturned: true,
                  ampouleReturnTime: `${nowTime} - ${signer.name} đã thu hồi vỏ ống`
                }
              : d
          )
        );
        debtApi.returnAmpoule(id).catch((err) => console.warn('Could not persist ampoule return:', err));
        appendAuditRecord(
          'RETURN_AMPOULE',
          'Thu hồi vỏ ống thuốc gây nghiện',
          `${item.code}: ${item.itemName} - BN: ${item.patientName}`,
          'Điều 15 Thông tư 20/2017/TT-BYT',
          signer,
          witness,
          method
        );
      }
    });
  };

  // Handler: Confirm asset transfer when misallocated (NĐ 151/2017)
  const handleConfirmTransfer = (id: string, newDept: string) => {
    const asset = assets.find(a => a.id === id);
    if (!asset) return;

    setAuthRequest({
      actionType: 'TRANSFER_ASSET',
      title: 'Biên bản Bàn giao & Điều chuyển Tài sản cố định (Mẫu 01/TSC-ĐC)',
      description: `Đồng bộ vị trí buồng bệnh thực tế (${newDept}) vào sổ theo dõi tài sản công theo NĐ 151. Yêu cầu ký xác nhận giữa Bên Giao (${asset.registeredDepartment}) và Bên Nhận (${newDept}).`,
      targetItem: `${asset.code}: ${asset.deviceName} (SN: ${asset.serialNumber}) -> ${newDept}`,
      legalBasis: 'Điều 39 & Điều 40 Nghị định 151/2017/NĐ-CP',
      requiredRoles: ['biomedical_engineer', 'director'],
      requiresDualWitness: true,
      dualWitnessRoles: ['nurse', 'doctor', 'biomedical_engineer'],
      onConfirm: (signer, witness, method) => {
        const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        setAssets(prev =>
          prev.map(a =>
            a.id === id
              ? {
                  ...a,
                  registeredDepartment: newDept,
                  actualDepartment: newDept,
                  isMisallocated: false,
                  condition: 'operational',
                  qrScannedAt: `${nowTime} - ${signer.name} và ${witness?.name || 'ĐD'} đã ký biên bản bàn giao NĐ 151`
                }
              : a
          )
        );

        // Cross-module: Synchronize with Tab 2 equipment tickets
        setTickets(prev =>
          prev.map(t =>
            t.serialNumber === asset.serialNumber
              ? {
                  ...t,
                  location: newDept,
                  actionLog: [
                    ...(t.actionLog || []),
                    `${nowTime}: ${signer.name} (BME) và ${witness?.name} đã ký biên bản bàn giao sang ${newDept} (Mẫu 01/TSC-ĐC)`
                  ]
                }
              : t
          )
        );

        appendAuditRecord(
          'TRANSFER_ASSET',
          'Biên bản bàn giao điều chuyển tài sản công (Mẫu 01/TSC-ĐC)',
          `${asset.code}: ${asset.deviceName} -> ${newDept}`,
          'Điều 39 & Điều 40 Nghị định 151/2017/NĐ-CP',
          signer,
          witness,
          method
        );
      }
    });
  };

  // Handler: Request asset liquidation for unrepairable machines (NĐ 151/2017 - DIRECTOR ONLY)
  const handleRequestLiquidation = (id: string, reason: string) => {
    const asset = assets.find(a => a.id === id);
    if (!asset) return;

    setAuthRequest({
      actionType: 'LIQUIDATE_ASSET',
      title: 'Ký Tờ trình Hội đồng Thanh lý Tài sản Nhà nước',
      description: `Kiến nghị thành lập Hội đồng thanh lý tài sản nhà nước hết khấu hao hoặc hư hỏng không thể phục hồi: ${reason}`,
      targetItem: `${asset.code}: ${asset.deviceName} (Hao mòn ${asset.depreciationRatePercent}%, ${asset.operatingYears} năm)`,
      legalBasis: 'Nghị định 151/2017/NĐ-CP & Nghị định 114/2024/NĐ-CP',
      requiredRoles: ['director'], // Strictly Director!
      onConfirm: (signer, witness, method) => {
        setAssets(prev =>
          prev.map(a =>
            a.id === id
              ? {
                  ...a,
                  pendingLiquidation: true,
                  liquidationReason: reason
                }
              : a
          )
        );
        appendAuditRecord(
          'LIQUIDATE_ASSET',
          'Ký tờ trình Hội đồng thanh lý tài sản công',
          `${asset.code}: ${asset.deviceName} (Lý do: ${reason})`,
          'Nghị định 151/2017/NĐ-CP & NĐ 114/2024/NĐ-CP',
          signer,
          witness,
          method
        );
      }
    });
  };

  // Handler: Simulate QR scan audit at ward
  const handleSimulateQrScan = () => {
    const nowStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const scanMsg: ChatMessage = {
      id: `msg-qr-${Date.now()}`,
      sender: 'agent',
      text: `Quét mã QR tại Phòng Mổ 2: Phát hiện Máy thở Bennett 840 (SN: PB840-VN-2021-998) đang nằm sai buồng bệnh so với sổ sách (Khoa Cấp Cứu A9). Đề xuất bấm nút 'Điều chuyển' để chuẩn hóa dữ liệu.`,
      timestamp: nowStr,
      legalReference: {
        lawCode: 'NĐ 151/2017/NĐ-CP',
        title: 'Kiểm kê tài sản',
        clause: 'Điều 39 & 40'
      },
      actionPayload: {
        type: 'ASSET_AUDIT',
        targetTab: 'asset_audit'
      }
    };
    setChatMessages(prev => [...prev, scanMsg]);
    setCurrentTab('asset_audit');
  };

  // Handler: Execute interactive clinical action card dispatched by AI Copilot
  const handleExecuteCardAction = (messageId: string, actionType: string, cardData: any) => {
    const markExecuted = () => {
      setChatMessages(prev =>
        prev.map(m =>
          m.id === messageId && m.card
            ? { ...m, card: { ...m.card, status: 'executed' as const } }
            : m
        )
      );
    };

    // Handler for Medication Safety Monograph
    if (actionType === 'OPEN_MEDICATION_SAFETY') {
      const medName = cardData?.medName || cardData?.itemName;
      const medId = cardData?.medId;
      handleOpenMedicationSafety(medId || medName);
      markExecuted();
      return;
    }

    if (actionType === 'EXECUTE_BORROW') {
      const itemName = cardData.debt_record?.itemName || cardData.item_name || 'Morphin sulfat 10mg/1ml';
      const itemType = cardData.debt_record?.itemType || cardData.item_type || 'Thuốc gây nghiện';
      const isNarcotic = Boolean(cardData.is_narcotic || itemType.includes('nghiện'));
      const qtyStr = cardData.debt_record?.quantity || cardData.quantity_str || `${cardData.quantity || 1} ống`;
      const qtyNum = cardData.debt_record?.quantity ? (parseInt(cardData.debt_record.quantity, 10) || 1) : (cardData.quantity || 1);
      const patientName = cardData.debt_record?.patientName || cardData.patient_name || 'Bệnh nhân Cấp Cứu';
      const patientRoom = cardData.debt_record?.patientRoom || cardData.patient_room || 'Khoa Cấp Cứu A9';
      const clinicalReason = cardData.debt_record?.note || cardData.clinical_reason || 'Cấp cứu bệnh nhân nặng';

      setAuthRequest({
        actionType: 'BORROW_EMERGENCY',
        title: `Ký xác thực Xuất mượn khẩn ${itemName}`,
        description: `Xác nhận rút khẩn ${qtyStr} ${itemName} từ cơ số tủ trực cấp cứu cho bệnh nhân ${patientName} (${patientRoom}). ${clinicalReason}`,
        targetItem: `${itemName} (${qtyStr}) - BN: ${patientName}`,
        legalBasis: isNarcotic
          ? 'Điều 10 Thông tư 22/2011/TT-BYT & Điều 15 Thông tư 20/2017/TT-BYT'
          : 'Điều 10 Thông tư 22/2011/TT-BYT',
        requiredRoles: ['nurse', 'doctor', 'pharmacist', 'director'],
        requiresDualWitness: isNarcotic,
        dualWitnessRoles: ['doctor', 'pharmacist', 'nurse'],
        onConfirm: async (signer, witness, method) => {
          const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
          const newCode = `PN-2026-${String(debts.length + 93).padStart(3, '0')}`;

          const newRecord: DebtRecord = {
            id: cardData.debt_record?.id || `debt-${Date.now()}`,
            code: newCode,
            itemName,
            itemType,
            quantity: qtyStr,
            patientName,
            patientRoom,
            borrowTime: nowTime,
            borrowDate: 'Hôm nay',
            borrowerName: `${signer.name} (${signer.roleName})`,
            status: 'debt',
            note: clinicalReason,
            legalBasis: isNarcotic ? 'Thông tư 22/2011/TT-BYT & TT 20/2017/TT-BYT' : 'Thông tư 22/2011/TT-BYT',
            ampouleReturned: !isNarcotic,
            ampouleDestroyed: false
          };

          setDebts(prev => [newRecord, ...prev]);
          markExecuted();

          appendAuditRecord(
            'BORROW_EMERGENCY',
            `Xuất mượn khẩn tủ trực: ${itemName}`,
            `${newCode}: ${itemName} (${qtyStr}) - BN: ${patientName}`,
            newRecord.legalBasis,
            signer,
            witness,
            method
          );

          try {
            await borrowEmergencyItemApi({
              item_name: itemName,
              item_type: itemType,
              quantity: qtyNum,
              patient_name: patientName,
              patient_room: patientRoom,
              borrower: signer.name,
              clinical_reason: clinicalReason,
              auth_method: method
            });
          } catch (e) {
            console.warn('Backend sync warning (offline fallback active):', e);
          }

          const confirmMsg: ChatMessage = {
            id: `msg-confirm-${Date.now()}`,
            sender: 'system',
            text: `✅ **Đã xuất mượn khẩn thành công (${newCode})**:
• **Mặt hàng**: ${itemName} (SL: ${qtyStr})
• **Bệnh nhân**: ${patientName} - ${patientRoom}
• **Người ký duyệt**: ${signer.name} (${signer.roleName}) - CCHN: \`${signer.practiceCertificate}\`
${witness ? `• **Người làm chứng**: ${witness.name} (${witness.roleName}) - CCHN: \`${witness.practiceCertificate}\`\n` : ''}• **Căn cứ**: ${newRecord.legalBasis}`,
            timestamp: nowTime
          };
          setChatMessages(prev => [...prev, confirmMsg]);

          if (USER_PROFILES[currentUserRole]?.allowedTabs.includes('debt')) {
            setCurrentTab('debt');
          }
          if (!isAudioMuted) clinicalAudio.playSuccessChime();
        }
      });
    } else if (actionType === 'EXECUTE_INCIDENT') {
      const deviceName = cardData.ticket?.deviceName || cardData.device_name || 'Máy thở Puritan Bennett 840 (PB840)';
      const deviceModel = cardData.ticket?.deviceModel || cardData.device_model || 'PB840 Ventilator';
      const serialNumber = cardData.ticket?.serialNumber || cardData.serial_number || 'PB840-VN-2021-998';
      const riskClass = cardData.ticket?.riskClass || cardData.risk_class || 'D';
      const location = cardData.ticket?.location || cardData.location || 'Khoa Cấp Cứu A9';
      const issue = cardData.ticket?.accessoryIssue || cardData.accessory_issue || 'Sự cố thiết bị lâm sàng';
      const urgency = cardData.ticket?.urgency || cardData.urgency || (riskClass === 'D' ? 'urgent' : 'warning');

      setAuthRequest({
        actionType: 'CREATE_INCIDENT',
        title: `Ký xác thực Báo hỏng ${deviceName}`,
        description: `Lập biên bản báo hỏng lâm sàng: ${issue} tại ${location}. Thiết bị phân loại rủi ro Loại ${riskClass} (Nghị định 98/2021/NĐ-CP).`,
        targetItem: `${deviceName} (SN: ${serialNumber}) - Loại ${riskClass}`,
        legalBasis: 'Điều 34 Nghị định 98/2021/NĐ-CP & Thông tư 05/2022/TT-BYT',
        requiredRoles: ['nurse', 'doctor', 'biomedical_engineer', 'director'],
        onConfirm: async (signer, witness, method) => {
          const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
          const newCode = `SC-2026-${String(tickets.length + 46).padStart(3, '0')}`;

          const newTicket: EquipmentTicket = {
            id: cardData.ticket?.id || `eq-${Date.now()}`,
            code: newCode,
            deviceName,
            deviceModel,
            serialNumber,
            riskClass: riskClass as any,
            accessoryIssue: issue,
            location,
            urgency: urgency as any,
            assignedEngineer: 'KS. Đặng Văn Nam (Phòng Vật tư - TBYT)',
            status: 'pending',
            reportTime: `${nowTime} - Báo qua AI Copilot`,
            lastInspectionDate: '15/04/2026',
            nextInspectionDue: '15/04/2027',
            inspectionUnit: 'Quatest 1',
            legalBasis: `Điều 34 Nghị định 98/2021/NĐ-CP - Quản lý thiết bị loại ${riskClass}`,
            actionLog: [
              `${nowTime}: ${signer.name} (${signer.roleName}) báo hỏng từ ${location}`,
              `${nowTime}: Điều phối kỹ sư kiểm định và linh kiện thay thế`
            ]
          };

          setTickets(prev => [newTicket, ...prev]);
          markExecuted();

          appendAuditRecord(
            'CREATE_INCIDENT',
            `Báo hỏng TBYT Loại ${riskClass}: ${deviceName}`,
            `${newCode}: ${deviceName} (${serialNumber}) - ${location}`,
            newTicket.legalBasis,
            signer,
            witness,
            method
          );

          try {
            await reportIncidentApi({
              device_name: deviceName,
              device_model: deviceModel,
              serial_number: serialNumber,
              risk_class: riskClass,
              location,
              accessory_issue: issue,
              urgency,
              assigned_engineer: 'KS. Đặng Văn Nam'
            });
          } catch (e) {
            console.warn('Backend sync warning:', e);
          }

          setShowTelegramToast(true);
          if (!isAudioMuted) clinicalAudio.playTelegramChime();

          const confirmMsg: ChatMessage = {
            id: `msg-confirm-${Date.now()}`,
            sender: 'system',
            text: `🚨 **Đã phát lệnh báo hỏng thiết bị y tế (${newCode})**:
• **Thiết bị**: ${deviceName} (Model: ${deviceModel} - SN: \`${serialNumber}\`)
• **Phân loại**: Mức độ rủi ro **Loại ${riskClass}** (${urgency === 'urgent' ? 'Ưu tiên khẩn cấp P1' : 'Ưu tiên tiêu chuẩn'})
• **Vị trí**: ${location}
• **Tình trạng**: ${issue}
• **Phân công xử lý**: KS. Đặng Văn Nam (Đã gửi thông báo Telegram đến Đội Kỹ thuật TBYT).`,
            timestamp: nowTime
          };
          setChatMessages(prev => [...prev, confirmMsg]);

          if (USER_PROFILES[currentUserRole]?.allowedTabs.includes('equipment')) {
            setCurrentTab('equipment');
          }
        }
      });
    } else if (actionType === 'EXECUTE_RESTOCK') {
      const batchIds = cardData.batch_ids || batches.filter(b => b.isLowStock || b.currentStock <= b.minThreshold).map(b => b.id);
      if (batchIds.length > 0) {
        handleRestockBatches(batchIds);
        markExecuted();
        if (USER_PROFILES[currentUserRole]?.allowedTabs.includes('fefo')) {
          setCurrentTab('fefo');
        }
      }
    } else if (actionType === 'NAVIGATE') {
      const targetTab = cardData?.target_tab || cardData?.targetTab;
      if (targetTab) {
        const userAllowedTabs = USER_PROFILES[currentUserRole]?.allowedTabs || ['debt'];
        if (userAllowedTabs.includes(targetTab)) {
          setCurrentTab(targetTab);
        }
      }
    } else if (actionType === 'OPEN_AUDIT_MODAL') {
      setIsAuditTrailOpen(true);
    } else if (actionType === 'OPEN_LEGAL_MODAL') {
      setIsLegalDocsOpen(true);
    } else if (actionType === 'OPEN_REGISTRY_MODAL' || actionType === 'OPEN_MED_SAFETY') {
      const med = cardData?.item_name || cardData?.medicationName || cardData?.drug_name || 'Augmentin 1g';
      handleOpenMedicationSafety(med);
      markExecuted();
    } else if (actionType === 'OPEN_FEFO_MODAL') {
      if (USER_PROFILES[currentUserRole]?.allowedTabs.includes('fefo')) {
        setCurrentTab('fefo');
      }
      markExecuted();
    } else if (actionType === 'OPEN_PRINTABLE_FORM') {
      const formType = cardData?.formType || cardData?.form_type || 'EMERGENCY_BORROW_TICKET';
      setPrintableInitialType(formType as any);
      setIsPrintableFormOpen(true);
      markExecuted();
    } else if (actionType === 'IMPORT_OCR_INVOICE') {
      const items = cardData?.items || [];
      const newBatches: InventoryBatch[] = items.map((it: any, idx: number) => ({
        id: `batch-ocr-${Date.now()}-${idx}`,
        itemCode: `VT-${Math.floor(1000 + Math.random() * 9000)}`,
        itemName: it.name,
        category: it.isNarcotic ? 'Thuốc gây nghiện' : 'Kháng sinh',
        batchNumber: it.batch || it.batchNumber,
        expiryDate: it.expiry || it.expiryDate,
        daysLeft: 180,
        isNearExpiry: false,
        currentStock: it.quantity,
        unit: it.unit || 'lọ',
        warehouseLocation: it.isNarcotic ? 'Tủ sắt thuốc độc 2 khóa' : 'Kệ A1 - Tầng 2',
        storageCondition: '15-25°C GSP',
        priorityOrder: 10,
        minThreshold: 20,
        maxThreshold: 300,
        isLowStock: false
      }));

      setBatches(prev => [...newBatches, ...prev]);
      markExecuted();
      if (USER_PROFILES[currentUserRole]?.allowedTabs.includes('fefo')) {
        setCurrentTab('fefo');
      }
      if (!isAudioMuted) clinicalAudio.playSuccessChime();

      const confirmMsg: ChatMessage = {
        id: `msg-ocr-confirm-${Date.now()}`,
        sender: 'system',
        text: `📦 **Nhập kho FEFO tự động thành công từ Hóa đơn GTGT (${cardData.invoiceNumber || 'HĐ-2026'})**:\n• **Nhà cung cấp**: ${cardData.supplier || 'CPC1'}\n• **Tổng số mặt hàng đã nhập**: ${newBatches.length} danh mục\n• **Nguyên tắc áp dụng**: First Expired, First Out (Thông tư 36/2018/TT-BYT GSP).`,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      };
      setChatMessages(prev => [...prev, confirmMsg]);
    } else if (actionType === 'EXECUTE_CREATE_CPOE_ORDER') {
      const order = cardData;
      if (order && order.id) {
        cpoeApi.createCpoeOrder(order).catch(console.warn);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('cpoe_order_created', { detail: order }));
        }
        markExecuted();
        if (USER_PROFILES[currentUserRole]?.allowedTabs.includes('cpoe')) {
          setCurrentTab('cpoe');
        }
        if (!isAudioMuted) clinicalAudio.playSuccessChime();
        const confirmMsg: ChatMessage = {
          id: `msg-cpoe-confirm-${Date.now()}`,
          sender: 'system',
          text: `✅ **Đã ký duyệt & tạo đơn thuốc thành công (${order.id})**:\n• **Bệnh nhân**: ${order.patientName}\n• **Chẩn đoán**: ${order.diagnosisIcd10} - ${order.diagnosisText}\n• **Số khoản thuốc**: ${order.items?.length || 0} mục • Thời gian: ${order.daysPrescribed} ngày\n• **Quy chế**: Điều 4 Thông tư 26/2025/TT-BYT.`,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        };
        setChatMessages(prev => [...prev, confirmMsg]);
      }
    } else if (actionType === 'EXECUTE_RETURN_AMPOULE') {
      const debtId = cardData?.debtId;
      if (debtId) {
        handleToggleAmpouleReturn(debtId);
        markExecuted();
        if (USER_PROFILES[currentUserRole]?.allowedTabs.includes('debt')) {
          setCurrentTab('debt');
        }
        if (!isAudioMuted) clinicalAudio.playSuccessChime();
        const confirmMsg: ChatMessage = {
          id: `msg-ampoule-return-${Date.now()}`,
          sender: 'system',
          text: `✅ **Đã xác nhận thu hồi vỏ ống thuốc thành công (${cardData.code})**:\n• **Mặt hàng**: ${cardData.itemName}\n• **Bệnh nhân**: ${cardData.patientName}\n• **Quy chế**: Điều 15 Thông tư 20/2017/TT-BYT (Lưu trữ và niêm phong vỏ thuốc độc gây nghiện).`,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        };
        setChatMessages(prev => [...prev, confirmMsg]);
      }
    } else if (actionType === 'EXECUTE_SETTLE_DEBT') {
      const debtId = cardData?.debtId;
      if (debtId) {
        handleSettleDebt(debtId);
        markExecuted();
        if (USER_PROFILES[currentUserRole]?.allowedTabs.includes('debt')) {
          setCurrentTab('debt');
        }
        if (!isAudioMuted) clinicalAudio.playSuccessChime();
        const confirmMsg: ChatMessage = {
          id: `msg-debt-settled-${Date.now()}`,
          sender: 'system',
          text: `✅ **Đã đối soát và thanh toán hoàn tất phiếu nợ (${cardData.code})**: Toàn bộ cơ số đã hoàn trả tủ trực cấp cứu.`,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        };
        setChatMessages(prev => [...prev, confirmMsg]);
      }
    }
  };

  // Handler: User sends a message from Left Pane input / chips / voice / image
  const handleSendMessage = async (inputText: string, attachment?: any) => {
    const nowStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    // 1. Add user message
    const userMsg: ChatMessage = {
      id: `msg-user-${Date.now()}`,
      sender: 'user',
      text: inputText,
      timestamp: nowStr,
      attachments: attachment ? [attachment] : undefined
    };

    setChatMessages(prev => [...prev, userMsg]);
    setIsProcessing(true);

    try {
      // 2. Process query with clinical agent engine (FastAPI Copilot REST API + Local Clinical fallback)
      const { replyMessage, actionPayload } = await processClinicalAgentQueryAsync(
        inputText,
        {
          debts,
          tickets,
          batches,
          coldChainState,
          assets
        },
        USER_PROFILES[currentUserRole]
      );

      // 3. Execute State Updates on Right Pane if actionPayload provided and NOT awaiting card confirmation
      if (actionPayload) {
        if (actionPayload.type === 'DEBT_ADDED' && actionPayload.data && !replyMessage.card) {
          const newRecords: DebtRecord[] = actionPayload.data;
          setDebts(prev => [...newRecords, ...prev]);
          if (!isAudioMuted) clinicalAudio.playSuccessChime();
        } else if (actionPayload.type === 'TICKET_CREATED' && actionPayload.data && !replyMessage.card) {
          const newTicket: EquipmentTicket = actionPayload.data;
          setTickets(prev => [newTicket, ...prev]);
          if (!isAudioMuted) clinicalAudio.playSuccessChime();
        } else if (actionPayload.type === 'FEFO_DISPATCHED' && actionPayload.data) {
          const { batch, quantity } = actionPayload.data;
          setBatches(prev =>
            prev.map(b => (b.batchNumber === batch ? { ...b, currentStock: Math.max(0, b.currentStock - quantity) } : b))
          );
          if (!isAudioMuted) clinicalAudio.playSuccessChime();
        } else if (actionPayload.type === 'AMPOULE_RETURNED') {
          setDebts(prev =>
            prev.map(d =>
              d.itemType === 'Thuốc gây nghiện' && !d.ampouleReturned
                ? { ...d, ampouleReturned: true, ampouleReturnTime: 'Đã thu hồi vỏ ống' }
                : d
            )
          );
          if (!isAudioMuted) clinicalAudio.playSuccessChime();
        }

        // Switch to corresponding tab (Enforcing strict RBAC isolation)
        if (actionPayload.targetTab) {
          const userAllowedTabs = USER_PROFILES[currentUserRole]?.allowedTabs || ['debt'];
          if (userAllowedTabs.includes(actionPayload.targetTab)) {
            setCurrentTab(actionPayload.targetTab);
          } else {
            const rbacWarningMsg: ChatMessage = {
              id: `msg-rbac-${Date.now()}`,
              sender: 'system',
              text: `⚠️ **Phân quyền truy cập (${USER_PROFILES[currentUserRole]?.roleName})**: Bạn không có thẩm quyền truy cập phân hệ **${actionPayload.targetTab}**. Dữ liệu đã được hệ thống lưu vết nhưng giao diện làm việc chỉ hiển thị trong phạm vi phân quyền của bạn.`,
              timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
            };
            setChatMessages(prev => [...prev, rbacWarningMsg]);
          }
        }
      }

      setChatMessages(prev => [...prev, replyMessage]);
    } catch (err) {
      console.error('Lỗi phân tích cú pháp AI Agent:', err);
      const errorMsg: ChatMessage = {
        id: `msg-err-${Date.now()}`,
        sender: 'agent',
        text: 'Đã xảy ra sự cố khi kết nối với máy chủ AI Copilot. Vui lòng kiểm tra lại đường truyền mạng hoặc thử lại bằng các lệnh nhanh.',
        timestamp: nowStr
      };
      setChatMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-row h-[100dvh] min-h-0 w-screen overflow-hidden bg-slate-900 text-slate-800 print:h-auto print:w-auto print:overflow-visible print:bg-white print:block relative">
      {/* 1. Mobile Drawer Backdrop Overlay */}
      {isMobileSidebarOpen && (
        <div
          onClick={() => setIsMobileSidebarOpen(false)}
          aria-hidden="true"
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 md:hidden animate-in fade-in duration-200"
        />
      )}

      {/* 2. Mobile Drawer Navigation Sidebar */}
      <div
        id="mobile-navigation-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Điều hướng chính"
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-white shadow-2xl md:hidden transition-transform duration-300 ease-in-out transform ${
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } print:hidden`}
      >
        <Sidebar
          currentTab={currentTab}
          onTabChange={(tab) => {
            setCurrentTab(tab);
            setIsMobileSidebarOpen(false);
          }}
          currentUserRole={currentUserRole}
          onSelectUserRole={(role) => {
            handleSelectUserRole(role);
            setIsMobileSidebarOpen(false);
          }}
          isCollapsed={false}
          onToggleCollapse={() => setIsMobileSidebarOpen(false)}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
          debtCount={debts.filter(d => d.status === 'debt').length}
          urgentTicketsCount={tickets.filter(t => t.urgency === 'urgent' && t.status !== 'resolved').length}
          nearExpiryAndLowStockCount={batches.filter(b => b.isNearExpiry || b.isLowStock || b.currentStock <= b.minThreshold).length}
          coldChainTemp={coldChainState.currentTemp}
          isColdAlarm={coldChainState.alarmActive || coldChainState.currentTemp > 8.0}
          misallocatedAssetsCount={assets.filter(a => a.isMisallocated).length}
          onOpenLegalDocs={() => {
            setIsLegalDocsOpen(true);
            setIsMobileSidebarOpen(false);
          }}
          onOpenAuditTrail={() => {
            setIsAuditTrailOpen(true);
            setIsMobileSidebarOpen(false);
          }}
          onOpenUserGuide={() => {
            setIsUserGuideOpen(true);
            setIsMobileSidebarOpen(false);
          }}
          onOpenPrintableForms={() => {
            handleOpenPrintForm('TT20_AMPOULE_DESTRUCTION');
            setIsMobileSidebarOpen(false);
          }}
          onOpenMedicationSafety={() => {
            handleOpenMedicationSafety();
            setIsMobileSidebarOpen(false);
          }}
        />
      </div>

      {/* 3. Desktop Left Enterprise Navigation Sidebar */}
      <div className="hidden md:block shrink-0 print:hidden h-full">
        <Sidebar
          currentTab={currentTab}
          onTabChange={(tab) => setCurrentTab(tab)}
          currentUserRole={currentUserRole}
              onSelectUserRole={authenticatedRole ? undefined : handleSelectUserRole}
              onLogout={authenticatedRole ? onLogout : undefined}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          debtCount={debts.filter(d => d.status === 'debt').length}
          urgentTicketsCount={tickets.filter(t => t.urgency === 'urgent' && t.status !== 'resolved').length}
          nearExpiryAndLowStockCount={batches.filter(b => b.isNearExpiry || b.isLowStock || b.currentStock <= b.minThreshold).length}
          coldChainTemp={coldChainState.currentTemp}
          isColdAlarm={coldChainState.alarmActive || coldChainState.currentTemp > 8.0}
          misallocatedAssetsCount={assets.filter(a => a.isMisallocated).length}
          onOpenLegalDocs={() => setIsLegalDocsOpen(true)}
          onOpenAuditTrail={() => setIsAuditTrailOpen(true)}
          onOpenUserGuide={() => setIsUserGuideOpen(true)}
          onOpenPrintableForms={() => handleOpenPrintForm('TT20_AMPOULE_DESTRUCTION')}
          onOpenMedicationSafety={() => handleOpenMedicationSafety()}
        />
      </div>

      {/* 4. Main Workspace: Sleek Top Header + Central Clinical Dashboard */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0 bg-slate-100/70 print:hidden w-full">
        <main className="flex-1 flex flex-col overflow-hidden relative pt-0 md:pt-0">
          <section className="w-full h-full flex flex-col overflow-hidden">
            <Dashboard
              currentTab={currentTab}
              onTabChange={(tab) => setCurrentTab(tab)}
              currentUserRole={currentUserRole}
              debts={debts}
              onSettleDebt={handleSettleDebt}
              onSimulateMorningReminder={handleSimulateMorningReminder}
              onToggleAmpouleReturn={handleToggleAmpouleReturn}
              onAddNewDebt={handleAddNewDebt}
              tickets={tickets}
              onUpdateTicketStatus={handleUpdateTicketStatus}
              onAddNewTicket={handleAddNewTicket}
              batches={batches}
              onDispatchBatch={handleDispatchBatch}
              coldChainState={coldChainState}
              onTriggerOutage={handleTriggerOutage}
              onRestorePower={handleRestorePower}
              assets={assets}
              onConfirmTransfer={handleConfirmTransfer}
              onRequestLiquidation={handleRequestLiquidation}
              onSimulateQrScan={handleSimulateQrScan}
              isAudioMuted={isAudioMuted}
              onDestroyAmpoules={handleDestroyAmpoules}
              onRestockBatches={handleRestockBatches}
              onReleaseQuarantine={handleReleaseVaccineQuarantine}
              onOpenAuditTrail={() => setIsAuditTrailOpen(true)}
              onOpenPrintForm={handleOpenPrintForm}
              onOpenMedicationSafety={handleOpenMedicationSafety}
            />
          </section>
        </main>
      </div>

      {/* 5B. Modern Mobile Bottom Navigation Bar (md:hidden) - Role-Aware & 100% RBAC Dynamic */}
      <MobileBottomNav
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        currentUserRole={currentUserRole}
        debtCount={debts.filter(d => d.status === 'debt').length}
        urgentTicketsCount={tickets.filter(t => t.urgency === 'urgent' && t.status !== 'resolved').length}
        lowStockCount={batches.filter(b => b.isLowStock || b.currentStock <= b.minThreshold).length}
        coldChainTemp={coldChainState.currentTemp}
        isColdAlarm={coldChainState.alarmActive || coldChainState.currentTemp > 8.0}
        misallocatedAssetsCount={assets.filter(a => a.isMisallocated).length}
      />
      {/* Mobile navigation is opened from the sidebar dock below. */}
      <button
        type="button"
        onClick={() => setIsCopilotOpen((prev) => !prev)}
        aria-label="Trợ lý AI lâm sàng"
        title="Trợ lý AI lâm sàng (⌘K / Ctrl+K)"
        className={`group fixed bottom-20 right-4 md:bottom-5 md:right-5 z-40 flex h-12 items-center gap-2 rounded-full bg-slate-900 px-3.5 text-white shadow-lg transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${isCopilotOpen ? 'translate-y-16 opacity-0 pointer-events-none' : ''}`}
      >
        <Bot className="h-5 w-5 text-teal-300" />
        <span className="max-w-0 overflow-hidden whitespace-nowrap text-sm font-medium opacity-0 transition-all duration-200 group-hover:max-w-28 group-hover:opacity-100 group-focus-visible:max-w-28 group-focus-visible:opacity-100">Trợ lý AI</span>
      </button>

      {/* 6. AI Assistant Pop-up / Fullscreen on Mobile */}
      {isCopilotOpen && (
        <div
          ref={chatPanelRef}
          onPointerDown={handleChatPointerDown}
          onPointerMove={handleChatPointerMove}
          onPointerUp={() => {
            if (pendingChatPosition.current) setChatPosition(pendingChatPosition.current);
            pendingChatPosition.current = null;
            setIsDraggingChat(false);
          }}
          onPointerCancel={() => {
            if (pendingChatPosition.current) setChatPosition(pendingChatPosition.current);
            pendingChatPosition.current = null;
            setIsDraggingChat(false);
          }}
          className={`fixed z-50 flex flex-col bg-white shadow-2xl overflow-hidden print:hidden ${
            isCopilotExpanded
              ? 'inset-0 h-dvh w-screen max-w-none rounded-none border-0 shadow-none'
              : 'w-[calc(100vw-32px)] sm:w-[560px] md:w-[620px] lg:w-[660px] max-w-[calc(100vw-32px)] h-[min(680px,calc(100dvh-100px))] sm:h-[min(680px,calc(100dvh-32px))] max-h-[calc(100dvh-32px)] rounded-xl border border-slate-300 ring-1 ring-slate-900/10'
          } ${!isCopilotExpanded && !chatPosition ? 'right-4 bottom-20 sm:bottom-5 sm:right-5' : ''} ${isDraggingChat ? 'cursor-grabbing' : ''}`}
          style={!isCopilotExpanded && chatPosition ? { left: chatPosition.x, top: chatPosition.y, right: 'auto', bottom: 'auto' } : undefined}
        >
          <ChatWindow
            messages={chatMessages}
            suggestionChips={[]}
            onSendMessage={handleSendMessage}
            isProcessing={isProcessing}
            isAudioMuted={isAudioMuted}
            onSelectTab={(tab) => {
              setCurrentTab(tab);
              if (typeof window !== 'undefined' && window.innerWidth < 768) {
                setIsCopilotOpen(false);
              }
            }}
            currentUserRole={currentUserRole}
            onClose={() => setIsCopilotOpen(false)}
            isFullScreen={isCopilotExpanded}
            onToggleFullScreen={() => {
              setIsCopilotExpanded((prev) => !prev);
              setChatPosition(null);
              pendingChatPosition.current = null;
            }}
            pendingDebtsCount={debts.filter(d => d.status === 'debt').length}
            pendingAmpoulesCount={debts.filter(d => d.itemType === 'Thuốc gây nghiện' && !d.ampouleReturned).length}
            urgentTicketsCount={tickets.filter(t => t.urgency === 'urgent' && t.status !== 'resolved').length}
            lowStockCount={batches.filter(b => b.isLowStock || b.currentStock <= b.minThreshold).length}
            onExecuteCardAction={handleExecuteCardAction}
            onClearMessages={() => setChatMessages(INITIAL_CHAT_MESSAGES)}
            onOpenAuditTrail={() => setIsAuditTrailOpen(true)}
            onOpenLegalDocs={() => setIsLegalDocsOpen(true)}
            onOpenUserGuide={() => setIsUserGuideOpen(true)}
          />
        </div>
      )}

      {/* 3-7. Non-printable Modals & Floating Overlays */}
      <div className="print:hidden">
        <Suspense fallback={null}>
        <TelegramToast
          isOpen={showTelegramToast}
          onClose={() => setShowTelegramToast(false)}
          debtCount={debts.filter(d => d.status === 'debt').length}
        />

        <LegalDocsModal
          isOpen={isLegalDocsOpen}
          onClose={() => setIsLegalDocsOpen(false)}
        />

        <UserGuideModal
          isOpen={isUserGuideOpen}
          onClose={() => setIsUserGuideOpen(false)}
        />

        <ClinicalAuthModal
          isOpen={Boolean(authRequest)}
          request={authRequest}
          currentUserRole={currentUserRole}
          onSwitchRole={handleSelectUserRole}
          onClose={() => setAuthRequest(null)}
          isAudioMuted={isAudioMuted}
        />

        <AuditTrailModal
          isOpen={isAuditTrailOpen}
          onClose={() => setIsAuditTrailOpen(false)}
          records={auditRecords}
        />

        <MedicationSafetyModal
          isOpen={isMedicationSafetyOpen}
          onClose={() => setIsMedicationSafetyOpen(false)}
          initialMedicationId={safetyModalMedId}
          initialMedicationName={safetyModalMedName}
        />

        {/* Modal Chi Tiết Hồ Sơ Bệnh Nhân Toàn Cục */}
        <PatientDetailModal
          isOpen={!!selectedPatientForGlobalModal}
          onClose={() => setSelectedPatientForGlobalModal(null)}
          patientIdOrName={selectedPatientForGlobalModal || ''}
        />
        </Suspense>
      </div>

      {/* 8. Printable Medical Documents Modal (Option A: Bộ Y Tế & Bộ Tài Chính) */}
      <Suspense fallback={null}>
      <PrintableFormModal
        isOpen={isPrintableFormOpen}
        onClose={() => setIsPrintableFormOpen(false)}
        initialFormType={printableInitialType}
        selectedDebtRecord={selectedDebtForPrint}
        selectedEquipmentTicket={selectedTicketForPrint}
        selectedAssetRecord={selectedAssetForPrint}
        debts={debts}
        tickets={tickets}
        batches={batches}
        assets={assets}
        coldChainState={coldChainState}
        currentUserRole={currentUserRole}
      />
      </Suspense>
    </div>
  );
}
