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
      {/* 1. Unified Clinical Command Ribbon */}
      <div className="bg-white p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl border border-slate-200/80 shadow-2xs shrink-0 space-y-2">
        {/* Row 1: Title, Legal Basis, Key Stat Badges, Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-wrap sm:flex-nowrap">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 whitespace-nowrap">
              Sự Cố &amp; Kiểm Định Thiết Bị
            </h2>
            <span className="text-xs font-mono text-slate-500 border-l border-slate-200 pl-2 hidden md:inline">
              NĐ 98/2021 &amp; NĐ 07/2023
            </span>
            {/* Subtle inline summary */}
            <div className="flex items-center gap-1.5 text-xs text-slate-600 sm:border-l sm:border-slate-200 sm:pl-2">
              <span className="text-slate-600 font-mono text-xs font-medium">{tickets.length} máy</span>
              {urgentCount > 0 && (
                <span className="inline-flex items-center gap-1 font-medium text-rose-800 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200/80 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                  {urgentCount} khẩn cấp
                </span>
              )}
              {inProgressCount > 0 && (
                <span className="inline-flex items-center gap-1 font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/80 text-xs">
                  {inProgressCount} đang sửa
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 flex-wrap sm:flex-nowrap">
            <button
              onClick={() => onOpenPrintForm?.('EQUIPMENT_HANDOVER_INSPECT')}
              className="inline-flex items-center gap-1 h-8 px-2 sm:px-2.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 hover:border-slate-400 font-semibold text-xs sm:text-sm transition shadow-2xs cursor-pointer active:scale-98"
              title="In Biên bản kiểm định an toàn điện & thử tải lâm sàng TBYT (Nghị định 98/2021/NĐ-CP & NĐ 07/2023/NĐ-CP)"
            >
              <Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-700" />
              <span className="hidden sm:inline">In Biên Bản NĐ 98</span>
              <span className="sm:hidden">In NĐ 98</span>
            </button>

            <button
              onClick={() => setIsIncidentModalOpen(true)}
              className="inline-flex items-center gap-1.5 h-8 px-2.5 sm:px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-semibold transition shadow-2xs cursor-pointer active:scale-98"
              title="Lập phiếu báo hỏng / sự cố thiết bị y tế (Nghị định 98/2021/NĐ-CP)"
            >
              <PlusCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">+ Báo Hỏng Thiết Bị</span>
              <span className="sm:hidden">+ Báo Hỏng</span>
            </button>
          </div>
        </div>

        {/* Row 2: Search Input & Status Filter Pills */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-slate-100">
          <div className="relative w-full sm:max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm máy thở, sốc tim, số serial..."
              className="w-full pl-8 pr-3 py-1.5 text-xs sm:text-sm bg-slate-50/60 border border-slate-200 rounded-lg focus:outline-hidden focus:border-teal-500 focus:bg-white text-slate-800 placeholder-slate-400 shadow-2xs transition"
            />
          </div>

          <div className="flex items-center gap-1 text-xs bg-slate-100/80 p-0.5 rounded-lg overflow-x-auto max-w-full scrollbar-none whitespace-nowrap">
            <button
              onClick={() => setSelectedUrgency('all')}
              className={`px-2.5 py-1 rounded-md text-xs sm:text-sm font-medium transition cursor-pointer shrink-0 ${
                selectedUrgency === 'all' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tất cả ({tickets.length})
            </button>
            <button
              onClick={() => setSelectedUrgency('urgent')}
              className={`px-2.5 py-1 rounded-md text-xs sm:text-sm font-medium transition cursor-pointer shrink-0 ${
                selectedUrgency === 'urgent' ? 'bg-white text-rose-800 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Khẩn cấp ({urgentCount})
            </button>
            <button
              onClick={() => setSelectedUrgency('in_progress')}
              className={`px-2.5 py-1 rounded-md text-xs sm:text-sm font-medium transition cursor-pointer shrink-0 ${
                selectedUrgency === 'in_progress' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Đang sửa ({inProgressCount})
            </button>
            <button
              onClick={() => setSelectedUrgency('resolved')}
              className={`px-2.5 py-1 rounded-md text-xs sm:text-sm font-medium transition cursor-pointer shrink-0 ${
                selectedUrgency === 'resolved' ? 'bg-white text-emerald-800 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Đã xong ({resolvedCount})
            </button>
          </div>
        </div>
      </div>

      {/* 2. Isolated Scrollable List (No-Scroll Viewport Ergonomics) */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-3">
        {filteredTickets.map((ticket) => {
          const isUrgent = ticket.urgency === 'urgent';
          const isResolved = ticket.status === 'resolved';

          return (
            <div
              key={ticket.id}
              className={`bg-white rounded-2xl border p-4 hover:border-slate-300 transition shadow-xs space-y-3 ${
                isUrgent && !isResolved ? 'border-rose-200 bg-rose-50/20' : 'border-slate-200/80'
              }`}
            >
              {/* Header: Code + Risk Class + Urgency */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200/60">
                    {ticket.code}
                  </span>
                  <span
                    className={`px-2.5 py-1 rounded-md text-xs font-bold border ${
                      ticket.riskClass === 'D'
                        ? 'bg-rose-50 text-rose-700 border-rose-200/80'
                        : 'bg-amber-50 text-amber-700 border-amber-200/80'
                    }`}
                  >
                    Loại {ticket.riskClass}
                  </span>
                </div>
                <div>
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${
                      isUrgent && !isResolved
                        ? 'bg-rose-50 text-rose-700 border-rose-200/80'
                        : isResolved
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200/80'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {isUrgent && !isResolved ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                        Khẩn cấp P1 (Sự sống)
                      </>
                    ) : isResolved ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        Đã nghiệm thu
                      </>
                    ) : (
                      'Đang xử lý kỹ thuật'
                    )}
                  </span>
                </div>
              </div>

              {/* Device Title & Issue Box */}
              <div>
                <h3 className="text-base font-bold text-slate-900 leading-snug">
                  {ticket.deviceName}
                </h3>
                <div className="mt-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200/70 text-xs sm:text-sm text-slate-800 font-medium flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>{ticket.accessoryIssue}</span>
                </div>
              </div>

              {/* Meta information */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs sm:text-sm text-slate-600 pt-2.5 border-t border-slate-100">
                <div>
                  <span className="text-slate-500 text-xs">Vị trí:</span>{' '}
                  <strong className="text-slate-900 font-semibold">{ticket.location}</strong>
                </div>
                <div>
                  <span className="text-slate-500 text-xs">Kỹ sư:</span>{' '}
                  <strong className="text-slate-900 font-semibold">{ticket.assignedEngineer}</strong>
                </div>
                <div>
                  <span className="text-slate-500 text-xs">Hạn kiểm định:</span>{' '}
                  <strong className="text-slate-900 font-semibold">{ticket.nextInspectionDue}</strong>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => onOpenPrintForm?.('EQUIPMENT_HANDOVER_INSPECT', ticket)}
                  className="flex-1 sm:flex-initial py-2 px-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  title="In Biên bản kiểm định an toàn điện & thử tải thiết bị này (NĐ 98/2021)"
                >
                  <Printer className="w-4 h-4 text-teal-700" />
                  <span>In Biên Bản (NĐ 98)</span>
                </button>

                {!isResolved ? (
                  <button
                    onClick={() => handleOpenHandover(ticket)}
                    className={`flex-2 sm:flex-initial py-2 px-4 rounded-xl text-xs sm:text-sm font-bold transition shadow-xs cursor-pointer active:scale-98 flex items-center justify-center gap-1.5 ${
                      currentUserRole === 'biomedical_engineer' || currentUserRole === 'director'
                        ? 'bg-teal-700 hover:bg-teal-800 text-white'
                        : 'bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-900 border border-slate-300'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Nghiệm thu thử tải &amp; Bàn giao</span>
                  </button>
                ) : (
                  <div className="flex-2 sm:flex-initial py-2 px-4 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs sm:text-sm font-bold text-center">
                    ✓ Đã bàn giao buồng bệnh
                  </div>
                )}
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

