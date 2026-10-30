/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Phân hệ Báo Hỏng & Sửa Chữa Thiết Bị Y Tế (NĐ 98/2021 & NĐ 04/2025/NĐ-CP)
 */

import React, { useState, useMemo, useEffect } from 'react';
import { EquipmentTicket, IncidentStatus, UserRole } from '../../../types/clinical';
import { EquipmentHandoverModal } from '../../Modals/EquipmentHandoverModal';
import { ManualIncidentModal } from '../../Modals/ManualIncidentModal';
import { PrintableFormType } from '../../Modals/PrintableFormModal';
import { EquipmentHeaderRibbon } from './Equipment/EquipmentHeaderRibbon';
import { EquipmentTicketCard } from './Equipment/EquipmentTicketCard';
import { EquipmentTicketRow } from './Equipment/EquipmentTicketRow';

interface EquipmentIncidentTabProps {
  tickets: EquipmentTicket[];
  onUpdateTicketStatus: (id: string, newStatus: IncidentStatus) => void;
  onOpenPrintForm?: (formType: PrintableFormType, ticket?: EquipmentTicket) => void;
  onAddNewTicket: (ticket: EquipmentTicket) => void;
  isAudioMuted: boolean;
  currentUserRole?: UserRole;
}

export const EquipmentIncidentTab: React.FC<EquipmentIncidentTabProps> = ({
  tickets,
  onUpdateTicketStatus,
  onOpenPrintForm,
  onAddNewTicket,
  isAudioMuted,
  currentUserRole = 'biomedical_engineer',
}) => {
  const [selectedUrgency, setSelectedUrgency] = useState<string>(() => (typeof window !== 'undefined' ? sessionStorage.getItem('equip_urgency') || 'all' : 'all'));
  const [searchQuery, setSearchQuery] = useState(() => (typeof window !== 'undefined' ? sessionStorage.getItem('equip_search') || '' : ''));
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false);
  const [isHandoverModalOpen, setIsHandoverModalOpen] = useState(false);
  const [selectedTicketForHandover, setSelectedTicketForHandover] = useState<EquipmentTicket | null>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem('equip_urgency', selectedUrgency);
      sessionStorage.setItem('equip_search', searchQuery);
    } catch {}
  }, [selectedUrgency, searchQuery]);

  const urgentCount = useMemo(() => tickets.filter((t) => t.urgency === 'urgent' && t.status !== 'resolved').length, [tickets]);
  const inProgressCount = useMemo(() => tickets.filter((t) => t.status === 'in_progress').length, [tickets]);
  const resolvedCount = useMemo(() => tickets.filter((t) => t.status === 'resolved').length, [tickets]);

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      let matchesUrgency = true;
      if (selectedUrgency === 'urgent') matchesUrgency = ticket.urgency === 'urgent' && ticket.status !== 'resolved';
      if (selectedUrgency === 'in_progress') matchesUrgency = ticket.status === 'in_progress';
      if (selectedUrgency === 'resolved') matchesUrgency = ticket.status === 'resolved';

      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery.trim() ||
        ticket.deviceName.toLowerCase().includes(q) ||
        ticket.code.toLowerCase().includes(q) ||
        ticket.serialNumber.toLowerCase().includes(q) ||
        ticket.location.toLowerCase().includes(q) ||
        ticket.accessoryIssue.toLowerCase().includes(q);

      return matchesUrgency && matchesSearch;
    });
  }, [tickets, selectedUrgency, searchQuery]);

  const handleOpenHandover = (ticket: EquipmentTicket) => {
    setSelectedTicketForHandover(ticket);
    setIsHandoverModalOpen(true);
  };

  const handleConfirmHandover = (ticketId: string) => {
    onUpdateTicketStatus(ticketId, 'resolved');
  };

  return (
    <div className="flex flex-col h-full overflow-hidden gap-1.5 w-full">
      <EquipmentHeaderRibbon
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedUrgency={selectedUrgency}
        setSelectedUrgency={setSelectedUrgency}
        totalCount={tickets.length}
        urgentCount={urgentCount}
        inProgressCount={inProgressCount}
        resolvedCount={resolvedCount}
        onOpenPrintForm={(type) => onOpenPrintForm?.(type)}
        onOpenIncidentModal={() => setIsIncidentModalOpen(true)}
      />

      {/* Mobile View: Danh sách phẳng hành chính */}
      <div className="md:hidden flex-1 min-h-0 overflow-y-auto px-1 pb-8">
        {filteredTickets.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-slate-500 text-xs">
            Không tìm thấy sự cố thiết bị nào phù hợp với bộ lọc hiện tại.
          </div>
        ) : (
          filteredTickets.map((ticket, idx) => (
            <EquipmentTicketCard
              key={ticket.id}
              index={idx}
              ticket={ticket}
              onOpenHandover={handleOpenHandover}
              onOpenPrintForm={onOpenPrintForm}
              currentUserRole={currentUserRole}
            />
          ))
        )}
      </div>

      {/* Desktop View: Bảng sự cố thiết bị hành chính */}
      <div className="hidden md:flex flex-1 min-h-0 bg-white border-y border-slate-200 overflow-hidden flex-col">
        <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto w-full">
          <table className="w-full min-w-[1680px] table-fixed text-left text-sm border-collapse">
            <colgroup>
              <col style={{ width: '70px' }} />
              <col style={{ width: '190px' }} />
              <col className="w-[28%]" style={{ minWidth: '320px' }} />
              <col className="w-[24%]" style={{ minWidth: '280px' }} />
              <col style={{ width: '240px' }} />
              <col style={{ width: '260px' }} />
              <col style={{ width: '160px' }} />
              <col style={{ width: '200px' }} />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr className="font-semibold text-sm tracking-normal">
                <th className="py-3 px-3 text-center border-r border-slate-200">STT</th>
                <th className="py-3 px-3.5 border-r border-slate-200">Mã sự cố</th>
                <th className="py-3 px-3.5 border-r border-slate-200">Thiết bị y tế</th>
                <th className="py-3 px-3.5 border-r border-slate-200">Hư hỏng &amp; Kỹ sư</th>
                <th className="py-3 px-3.5 border-r border-slate-200">Vị trí máy</th>
                <th className="py-3 px-3.5 text-center border-r border-slate-200">Hạn kiểm định</th>
                <th className="py-3 px-3.5 text-center border-r border-slate-200">Trạng thái</th>
                <th className="py-3 px-3.5 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500 font-medium text-sm">
                    Không tìm thấy sự cố khớp với tiêu chí tra cứu.
                  </td>
                </tr>
              ) : (
                filteredTickets.map((ticket, idx) => (
                  <EquipmentTicketRow
                    key={ticket.id}
                    index={idx}
                    ticket={ticket}
                    onOpenHandover={handleOpenHandover}
                    onOpenPrintForm={onOpenPrintForm}
                    currentUserRole={currentUserRole}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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

      <ManualIncidentModal
        isOpen={isIncidentModalOpen}
        onClose={() => setIsIncidentModalOpen(false)}
        onConfirmIncident={(ticketData) =>
          onAddNewTicket &&
          onAddNewTicket({
            ...ticketData,
            id: `ticket-${Date.now()}`,
            code: `SC-2026-${String(tickets.length + 43).padStart(3, '0')}`,
            reportTime: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
            status: 'pending',
          })
        }
        isAudioMuted={isAudioMuted}
      />
    </div>
  );
};
