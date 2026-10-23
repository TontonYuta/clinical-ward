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
    <div className="h-full flex flex-col overflow-hidden space-y-2.5 w-full">
      {/* 1. Unified Minimalist Command Ribbon */}
      <div className="bg-white p-2.5 sm:px-4 sm:py-2.5 rounded-2xl border border-slate-200/90 shadow-2xs shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Search Input & Status Filter Pills */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0 flex-wrap sm:flex-nowrap">
          <div className="relative w-full sm:w-64 shrink-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm máy thở, sốc tim, serial..."
              className="w-full pl-9 pr-3.5 py-2 text-sm bg-slate-50/80 border border-slate-200 rounded-xl focus:outline-hidden focus:border-teal-600 focus:bg-white text-slate-900 placeholder-slate-400 transition"
            />
          </div>

          <div className="flex items-center gap-1.5 text-sm bg-slate-100/90 p-1 rounded-xl overflow-x-auto max-w-full scrollbar-none whitespace-nowrap">
            <button
              onClick={() => setSelectedUrgency('all')}
              className={`px-3 py-1.5 rounded-lg text-sm transition cursor-pointer shrink-0 ${
                selectedUrgency === 'all' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              Tất cả ({tickets.length})
            </button>
            <button
              onClick={() => setSelectedUrgency('urgent')}
              className={`px-3 py-1.5 rounded-lg text-sm transition cursor-pointer shrink-0 ${
                selectedUrgency === 'urgent' ? 'bg-white text-rose-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              Khẩn cấp ({urgentCount})
            </button>
            <button
              onClick={() => setSelectedUrgency('in_progress')}
              className={`px-3 py-1.5 rounded-lg text-sm transition cursor-pointer shrink-0 ${
                selectedUrgency === 'in_progress' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              Đang sửa ({inProgressCount})
            </button>
            <button
              onClick={() => setSelectedUrgency('resolved')}
              className={`px-3 py-1.5 rounded-lg text-sm transition cursor-pointer shrink-0 ${
                selectedUrgency === 'resolved' ? 'bg-white text-emerald-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              Đã xong ({resolvedCount})
            </button>
          </div>
        </div>

        {/* Right: Primary Action + Secondary Controls */}
        <div className="flex items-center gap-2 shrink-0 justify-end">
          <button
            onClick={() => onOpenPrintForm?.('EQUIPMENT_HANDOVER_INSPECT')}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-sm font-semibold transition shadow-2xs cursor-pointer"
            title="In Biên bản kiểm định an toàn điện & thử tải thiết bị (NĐ 98)"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span className="hidden sm:inline">In biên bản</span>
          </button>

          <button
            onClick={() => setIsIncidentModalOpen(true)}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-sm font-bold transition shadow-2xs cursor-pointer active:scale-98"
            title="Lập phiếu báo hỏng / sự cố thiết bị y tế (NĐ 98)"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Báo Hỏng</span>
          </button>
        </div>
      </div>

      {/* 2A. Mobile Card-Based List (md:hidden) - Modern, touch-friendly, no horizontal cut-off */}
      <div className="md:hidden flex-1 min-h-0 overflow-y-auto pr-0.5 space-y-2.5 pb-8">
        {filteredTickets.map((ticket) => {
          const isUrgent = ticket.urgency === 'urgent';
          const isResolved = ticket.status === 'resolved';

          return (
            <div
              key={ticket.id}
              className={`bg-white rounded-xl border p-3 hover:border-slate-300 transition shadow-2xs space-y-2.5 ${
                isUrgent && !isResolved ? 'border-rose-200 bg-rose-50/20' : 'border-slate-200/80'
              }`}
            >
              {/* Header: Code + Risk Class + Urgency */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/60">
                    {ticket.code}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-bold border ${
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
                    className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border ${
                      isUrgent && !isResolved
                        ? 'bg-rose-50 text-rose-700 border-rose-200/80'
                        : isResolved
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200/80'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {isUrgent && !isResolved ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        Khẩn cấp P1
                      </>
                    ) : isResolved ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        Đã nghiệm thu
                      </>
                    ) : (
                      'Đang xử lý'
                    )}
                  </span>
                </div>
              </div>

              {/* Device Title & Issue Box */}
              <div>
                <h3 className="text-sm font-bold text-slate-900 leading-snug">
                  {ticket.deviceName}
                </h3>
                <div className="mt-1.5 p-2 bg-slate-50 rounded-lg border border-slate-200/70 text-xs text-slate-800 font-medium flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <span>{ticket.accessoryIssue}</span>
                </div>
              </div>

              {/* Meta information */}
              <div className="grid grid-cols-2 gap-1.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
                <div>
                  <span className="text-slate-400">Vị trí:</span>{' '}
                  <strong className="text-slate-900">{ticket.location}</strong>
                </div>
                <div>
                  <span className="text-slate-400">Hạn KĐ:</span>{' '}
                  <strong className="text-slate-900 font-mono">{ticket.nextInspectionDue}</strong>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1.5 border-t border-slate-100">
                <button
                  onClick={() => onOpenPrintForm?.('EQUIPMENT_HANDOVER_INSPECT', ticket)}
                  className="flex-1 py-1.5 px-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1 transition cursor-pointer"
                  title="In Biên bản kiểm định an toàn điện & thử tải thiết bị này (NĐ 98/2021)"
                >
                  <Printer className="w-3.5 h-3.5 text-teal-700" />
                  <span>In NĐ 98</span>
                </button>

                {!isResolved ? (
                  <button
                    onClick={() => handleOpenHandover(ticket)}
                    className={`flex-2 py-1.5 px-3 rounded-lg text-xs font-bold transition shadow-xs cursor-pointer active:scale-98 flex items-center justify-center gap-1 ${
                      currentUserRole === 'biomedical_engineer' || currentUserRole === 'director'
                        ? 'bg-teal-700 hover:bg-teal-800 text-white'
                        : 'bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-900 border border-slate-300'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Nghiệm thu &amp; Bàn giao</span>
                  </button>
                ) : (
                  <div className="flex-2 py-1.5 px-3 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold text-center">
                    ✓ Đã bàn giao
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 2B. Desktop High-Density Table (hidden md:flex) - Sticky Thead, Zero Redundant Scroll */}
      <div className="hidden md:flex flex-1 min-h-0 bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-2xs flex-col">
        <div className="flex-1 min-h-0 overflow-auto pb-24">
          <table className="w-full text-left text-sm min-w-[960px]">
            <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-xs border-b border-slate-200/90 shadow-2xs">
              <tr className="text-slate-700 font-bold text-xs uppercase tracking-wider">
                <th className="py-3.5 px-4 whitespace-nowrap">Mã &amp; Cấp độ</th>
                <th className="py-3.5 px-3.5 whitespace-nowrap">Thiết bị &amp; Model</th>
                <th className="py-3.5 px-3.5 whitespace-nowrap">Sự cố ghi nhận (NĐ 98)</th>
                <th className="py-3.5 px-3.5 whitespace-nowrap">Vị trí khoa phòng</th>
                <th className="py-3.5 px-3 whitespace-nowrap">Hạn kiểm định</th>
                <th className="py-3.5 px-3 text-center whitespace-nowrap">Trạng thái</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTickets.map((ticket) => {
                const isUrgent = ticket.urgency === 'urgent';
                const isResolved = ticket.status === 'resolved';
                return (
                  <tr key={ticket.id} className="hover:bg-slate-50/80 transition">
                    {/* Code & Risk Class */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="font-mono font-bold text-slate-800 text-xs bg-slate-100 px-2 py-0.5 rounded border border-slate-200/70 block w-fit">
                        {ticket.code}
                      </span>
                      <span
                        className={`inline-block mt-1 px-2 py-0.5 rounded-md text-xs font-bold border ${
                          ticket.riskClass === 'D'
                            ? 'bg-rose-50 text-rose-800 border-rose-300'
                            : 'bg-amber-50 text-amber-800 border-amber-300'
                        }`}
                      >
                        Loại {ticket.riskClass}
                      </span>
                    </td>

                    {/* Device & Model */}
                    <td className="py-3.5 px-3.5">
                      <span className="font-bold text-slate-950 block text-[15px] leading-snug">{ticket.deviceName}</span>
                      <span className="text-xs text-slate-600 font-medium block mt-0.5">SN: {ticket.serialNumber} · {ticket.deviceModel}</span>
                    </td>

                    {/* Issue */}
                    <td className="py-3.5 px-3.5 max-w-xs">
                      <span className="text-sm text-slate-950 font-semibold line-clamp-1" title={ticket.accessoryIssue}>
                        {ticket.accessoryIssue}
                      </span>
                      <span className="text-xs text-slate-600 font-medium block mt-0.5">KS: {ticket.assignedEngineer}</span>
                    </td>

                    {/* Location */}
                    <td className="py-3.5 px-3.5 whitespace-nowrap">
                      <span className="font-semibold text-slate-800 text-sm block">📍 {ticket.location}</span>
                    </td>

                    {/* Inspection */}
                    <td className="py-3.5 px-3 whitespace-nowrap font-mono text-xs text-slate-800">
                      <span className="font-bold text-slate-900 block">{ticket.nextInspectionDue}</span>
                      <span className="text-xs text-slate-600 font-sans mt-0.5 block">Viện TBYT NIEMET</span>
                    </td>

                    {/* Urgency & Status */}
                    <td className="py-3.5 px-3 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                          isUrgent && !isResolved
                            ? 'bg-rose-50 text-rose-800 border-rose-300'
                            : isResolved
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {isUrgent && !isResolved ? (
                          <>
                            <span className="w-2 h-2 rounded-full bg-rose-600" />
                            Khẩn cấp
                          </>
                        ) : isResolved ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            Đã bàn giao
                          </>
                        ) : (
                          'Đang xử lý'
                        )}
                      </span>
                    </td>

                    {/* Actions - Redundancy Removed */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onOpenPrintForm?.('EQUIPMENT_HANDOVER_INSPECT', ticket)}
                          className="h-8.5 px-3 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                          title="In Biên bản kỹ thuật NĐ 98"
                        >
                          <Printer className="w-4 h-4 text-teal-700" />
                          <span className="hidden xl:inline">In NĐ 98</span>
                        </button>

                        {!isResolved && (
                          <button
                            onClick={() => handleOpenHandover(ticket)}
                            className={`h-8.5 px-3.5 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer active:scale-98 flex items-center gap-1.5 ${
                              currentUserRole === 'biomedical_engineer' || currentUserRole === 'director'
                                ? 'bg-teal-700 hover:bg-teal-800 text-white'
                                : 'bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-900 border border-slate-300'
                            }`}
                          >
                            <ShieldCheck className="w-4 h-4" />
                            <span>Bàn giao</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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

