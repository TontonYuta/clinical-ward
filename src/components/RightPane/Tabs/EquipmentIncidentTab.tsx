/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Search, Check, AlertTriangle, Wrench, Clock, ShieldCheck, PlusCircle, Printer } from 'lucide-react';
import { EquipmentTicket, IncidentStatus, UserRole } from '../../../types/clinical';
import { clinicalAudio } from '../../../utils/audio';
import { EquipmentHandoverModal } from '../../Modals/EquipmentHandoverModal';
import { ManualIncidentModal } from '../../Modals/ManualIncidentModal';
import { PrintableFormType } from '../../Modals/PrintableFormModal';

interface EquipmentIncidentTabProps {
  tickets: EquipmentTicket[];
  onUpdateTicketStatus: (id: string, newStatus: IncidentStatus) => void;
  onAddNewTicket: (ticket: EquipmentTicket) => void;
  onOpenPrintForm?: (formType: PrintableFormType, ticket?: EquipmentTicket) => void;
  isAudioMuted: boolean;
  currentUserRole?: UserRole;
}

export const EquipmentIncidentTab: React.FC<EquipmentIncidentTabProps> = ({
  tickets,
  onUpdateTicketStatus,
  onAddNewTicket,
  onOpenPrintForm,
  isAudioMuted,
  currentUserRole = 'biomedical_engineer'
}) => {
  const [selectedUrgency, setSelectedUrgency] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTicketForHandover, setSelectedTicketForHandover] = useState<EquipmentTicket | null>(null);
  const [isHandoverModalOpen, setIsHandoverModalOpen] = useState(false);
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false);

  const urgentCount = tickets.filter(t => t.urgency === 'urgent' && t.status !== 'resolved').length;
  const inProgressCount = tickets.filter(t => t.status === 'in_progress').length;
  const resolvedCount = tickets.filter(t => t.status === 'resolved').length;

  const filteredTickets = tickets.filter(t => {
    const matchesUrgency =
      selectedUrgency === 'all' ||
      (selectedUrgency === 'urgent' && t.urgency === 'urgent') ||
      (selectedUrgency === 'in_progress' && t.status === 'in_progress') ||
      (selectedUrgency === 'resolved' && t.status === 'resolved');

    const matchesSearch =
      t.deviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.accessoryIssue.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.assignedEngineer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.code.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesUrgency && matchesSearch;
  });


  const handleOpenHandover = (ticket: EquipmentTicket) => {
    setSelectedTicketForHandover(ticket);
    setIsHandoverModalOpen(true);
  };

  const handleConfirmHandover = (ticketId: string) => {
    onUpdateTicketStatus(ticketId, 'resolved');
  };

  return (
    <div className="h-full flex flex-col overflow-hidden space-y-2 w-full">
      {/* 1. Slim Integrated Executive Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200/90 shadow-2xs shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-wrap sm:flex-nowrap">
          <h2 className="text-xs sm:text-sm font-bold text-slate-900 whitespace-nowrap">
            Sự Cố &amp; Kiểm Định Thiết Bị
          </h2>
          <span className="text-[11px] font-mono text-slate-400 border-l border-slate-200 pl-2 hidden md:inline">
            Căn cứ: NĐ 98/2021 &amp; NĐ 07/2023
          </span>
          {/* Subtle inline summary */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600 sm:border-l sm:border-slate-200 sm:pl-2.5">
            <span className="text-slate-500 font-mono text-[11px]">{tickets.length} máy</span>
            <span className="text-slate-300">·</span>
            {urgentCount > 0 && (
              <span className="inline-flex items-center gap-1 font-medium text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 text-[10px] sm:text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                {urgentCount} khẩn cấp (Loại D)
              </span>
            )}
            {inProgressCount > 0 && (
              <span className="inline-flex items-center gap-1 font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-[10px] sm:text-[11px]">
                {inProgressCount} đang sửa
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-wrap sm:flex-nowrap">
          <button
            onClick={() => onOpenPrintForm?.('EQUIPMENT_HANDOVER_INSPECT')}
            className="inline-flex items-center gap-1 h-7 px-2 sm:px-2.5 rounded-md bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 hover:border-slate-400 font-semibold text-[11px] sm:text-xs transition shadow-2xs cursor-pointer active:scale-98"
            title="In Biên bản kiểm định an toàn điện & thử tải lâm sàng TBYT (Nghị định 98/2021/NĐ-CP & NĐ 07/2023/NĐ-CP)"
          >
            <Printer className="w-3.5 h-3.5 text-teal-700" />
            <span className="hidden sm:inline">In Biên Bản Kỹ Thuật (NĐ 98)</span>
            <span className="sm:hidden">In NĐ 98</span>
          </button>

          <button
            onClick={() => setIsIncidentModalOpen(true)}
            className="inline-flex items-center gap-1 h-7 px-2 sm:px-2.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-[11px] sm:text-xs font-semibold transition shadow-2xs cursor-pointer active:scale-98"
            title="Lập phiếu báo hỏng / sự cố thiết bị y tế (Nghị định 98/2021/NĐ-CP)"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">+ Báo Hỏng Thiết Bị</span>
            <span className="sm:hidden">+ Báo Hỏng</span>
          </button>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
        <div className="relative w-full sm:max-w-xs">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm máy thở, sốc tim, số serial..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-hidden focus:border-slate-400 text-slate-800 placeholder-slate-400"
          />
        </div>

        <div className="flex items-center gap-1 text-xs bg-slate-100 p-0.5 rounded-md overflow-x-auto max-w-full scrollbar-none whitespace-nowrap">
          <button
            onClick={() => setSelectedUrgency('all')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer shrink-0 ${
              selectedUrgency === 'all' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tất cả ({tickets.length})
          </button>
          <button
            onClick={() => setSelectedUrgency('urgent')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer shrink-0 ${
              selectedUrgency === 'urgent' ? 'bg-white text-rose-800 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Khẩn cấp ({urgentCount})
          </button>
          <button
            onClick={() => setSelectedUrgency('in_progress')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer shrink-0 ${
              selectedUrgency === 'in_progress' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Đang sửa ({inProgressCount})
          </button>
          <button
            onClick={() => setSelectedUrgency('resolved')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer shrink-0 ${
              selectedUrgency === 'resolved' ? 'bg-white text-emerald-800 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Đã xong ({resolvedCount})
          </button>
        </div>
      </div>

      {/* 2. Isolated Scrollable List (No-Scroll Viewport Ergonomics) */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2.5">
        {filteredTickets.map((ticket) => {
          const isUrgent = ticket.urgency === 'urgent';
          const isResolved = ticket.status === 'resolved';

          return (
            <div
              key={ticket.id}
              className={`bg-white rounded-lg border p-3.5 hover:border-slate-300 transition shadow-2xs ${
                isUrgent && !isResolved ? 'border-rose-200 bg-rose-50/10' : 'border-slate-200'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 mb-2">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-xs font-bold text-slate-600">
                      {ticket.code}
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className={`px-2 py-0.2 rounded text-[11px] font-bold ${
                      ticket.riskClass === 'D' ? 'bg-rose-100 text-rose-900 border border-rose-300' : 'bg-amber-100 text-amber-900 border border-amber-300'
                    }`}>
                      Loại {ticket.riskClass}
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className={`text-xs font-bold ${isUrgent ? 'text-rose-600 flex items-center gap-1' : 'text-slate-600'}`}>
                      {isUrgent && <AlertTriangle className="w-3.5 h-3.5" />}
                      {isUrgent ? 'Mức độ: Khẩn cấp' : 'Mức độ: Bình thường'}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900">
                    {ticket.deviceName}
                  </h3>
                  <p className="text-xs text-slate-800 font-medium mt-0.5">
                    {ticket.accessoryIssue}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 sm:shrink-0 sm:text-right mt-1 sm:mt-0 flex-wrap">
                  <button
                    onClick={() => onOpenPrintForm?.('EQUIPMENT_HANDOVER_INSPECT', ticket)}
                    className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold transition shadow-2xs cursor-pointer"
                    title="In Biên bản kiểm định an toàn điện & thử tải thiết bị này (NĐ 98/2021)"
                  >
                    <Printer className="w-3.5 h-3.5 text-teal-700" />
                    <span className="hidden sm:inline">In Biên Bản</span>
                  </button>

                  {!isResolved ? (
                    <button
                      onClick={() => handleOpenHandover(ticket)}
                      className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-bold transition shadow-2xs cursor-pointer active:scale-98 whitespace-nowrap ${
                        currentUserRole === 'biomedical_engineer' || currentUserRole === 'director'
                          ? 'bg-teal-700 hover:bg-teal-800 text-white'
                          : 'bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-900 border border-slate-300 hover:border-teal-400'
                      }`}
                      title={currentUserRole === 'biomedical_engineer' || currentUserRole === 'director'
                        ? "Mở biên bản kiểm định thử tải và bàn giao lâm sàng NĐ 98/2021"
                        : "Theo NĐ 98/2021, kỹ sư P.VTYT chịu trách nhiệm kiểm định an toàn điện. Bấm để mở biên bản bàn giao & ký chứng thực."}
                    >
                      <ShieldCheck className={`w-3.5 h-3.5 ${currentUserRole === 'biomedical_engineer' || currentUserRole === 'director' ? 'text-white' : 'text-teal-700'}`} />
                      <span>Nghiệm thu &amp; Bàn giao</span>
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-bold">
                      <Check className="w-3.5 h-3.5" />
                      Đã bàn giao buồng bệnh
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pt-2 border-t border-slate-100">
                <span>Vị trí: <strong className="text-slate-900">{ticket.location}</strong></span>
                <span>Kỹ sư phụ trách: <strong className="text-slate-900">{ticket.assignedEngineer}</strong></span>
                <span>Hạn tem kiểm định: <strong className="text-slate-900">{ticket.nextInspectionDue}</strong></span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Closed-Loop Handover Modal */}
      <EquipmentHandoverModal
        isOpen={isHandoverModalOpen}
        onClose={() => {
          setIsHandoverModalOpen(false);
          setSelectedTicketForHandover(null);
        }}
        ticket={selectedTicketForHandover}
        onConfirmResolved={handleConfirmHandover}
        onOpenPrintForm={onOpenPrintForm}
        isAudioMuted={isAudioMuted}
      />

      {/* 4. Manual Defect Reporting Modal (100% Standalone No-AI) */}
      <ManualIncidentModal
        isOpen={isIncidentModalOpen}
        onClose={() => setIsIncidentModalOpen(false)}
        onConfirmIncident={(ticketData) => onAddNewTicket && onAddNewTicket({
          ...ticketData,
          id: `ticket-${Date.now()}`,
          code: `SC-2026-${String(tickets.length + 43).padStart(3, '0')}`,
          reportTime: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          status: 'pending'
        })}
        isAudioMuted={isAudioMuted}
      />
    </div>
  );
};

