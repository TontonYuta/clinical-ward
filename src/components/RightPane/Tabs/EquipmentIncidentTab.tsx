/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Phân hệ Quản lý Sự cố & Kiểm định Thiết bị Y tế (NĐ 04/2025/NĐ-CP & NĐ 98/2021)
 */

import React, { useState, useMemo } from 'react';
import { EquipmentTicket, IncidentStatus, UserRole } from '../../../types/clinical';
import { EquipmentHandoverModal } from '../../Modals/EquipmentHandoverModal';
import { ManualIncidentModal } from '../../Modals/ManualIncidentModal';
import { PrintableFormType } from '../../Modals/PrintableFormModal';
import { EquipmentHeaderRibbon } from './Equipment/EquipmentHeaderRibbon';
import { EquipmentLegalBanner } from './Equipment/EquipmentLegalBanner';
import { EquipmentTicketCard } from './Equipment/EquipmentTicketCard';
import { EquipmentTicketRow } from './Equipment/EquipmentTicketRow';

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
  currentUserRole = 'biomedical_engineer',
}) => {
  const [selectedUrgency, setSelectedUrgency] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTicketForHandover, setSelectedTicketForHandover] = useState<EquipmentTicket | null>(null);
  const [isHandoverModalOpen, setIsHandoverModalOpen] = useState(false);
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false);

  const urgentCount = useMemo(
    () => tickets.filter((t) => t.urgency === 'urgent' && t.status !== 'resolved').length,
    [tickets]
  );
  const inProgressCount = useMemo(() => tickets.filter((t) => t.status === 'in_progress').length, [tickets]);
  const resolvedCount = useMemo(() => tickets.filter((t) => t.status === 'resolved').length, [tickets]);

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      const matchesUrgency =
        selectedUrgency === 'all' ||
        (selectedUrgency === 'urgent' && t.urgency === 'urgent') ||
        (selectedUrgency === 'in_progress' && t.status === 'in_progress') ||
        (selectedUrgency === 'resolved' && t.status === 'resolved');

      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery.trim() ||
        t.deviceName.toLowerCase().includes(q) ||
        t.accessoryIssue.toLowerCase().includes(q) ||
        t.location.toLowerCase().includes(q) ||
        t.assignedEngineer.toLowerCase().includes(q) ||
        t.code.toLowerCase().includes(q);

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
    <div className="h-full flex flex-col overflow-hidden space-y-2.5 w-full">
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

      <EquipmentLegalBanner />

      {/* Mobile Card List */}
      <div className="md:hidden flex-1 min-h-0 overflow-y-auto pr-0.5 space-y-2.5 pb-8">
        {filteredTickets.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 text-sm">
            Không tìm thấy sự cố thiết bị nào phù hợp.
          </div>
        ) : (
          filteredTickets.map((ticket) => (
            <EquipmentTicketCard
              key={ticket.id}
              ticket={ticket}
              onOpenHandover={handleOpenHandover}
              onOpenPrintForm={onOpenPrintForm}
              currentUserRole={currentUserRole}
            />
          ))
        )}
      </div>

      {/* Desktop High-Density Table */}
      <div className="hidden md:flex flex-1 min-h-0 bg-white rounded-xl border border-slate-300 overflow-hidden flex-col shadow-xs">
        <div className="flex-1 min-h-0 overflow-auto pb-24">
          <table className="w-full text-left text-sm min-w-[960px] border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-300 text-slate-700">
              <tr className="font-bold text-xs uppercase tracking-wider">
                <th className="py-3 px-4 whitespace-nowrap border-r border-slate-200">Mã &amp; Cấp độ</th>
                <th className="py-3 px-3.5 whitespace-nowrap border-r border-slate-200">Thiết bị &amp; Model</th>
                <th className="py-3 px-3.5 whitespace-nowrap border-r border-slate-200">Sự cố ghi nhận (NĐ 04/2025)</th>
                <th className="py-3 px-3.5 whitespace-nowrap border-r border-slate-200">Vị trí khoa phòng</th>
                <th className="py-3 px-3 whitespace-nowrap border-r border-slate-200">Hạn kiểm định</th>
                <th className="py-3 px-3 text-center whitespace-nowrap border-r border-slate-200">Trạng thái</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredTickets.map((ticket) => (
                <EquipmentTicketRow
                  key={ticket.id}
                  ticket={ticket}
                  onOpenHandover={handleOpenHandover}
                  onOpenPrintForm={onOpenPrintForm}
                  currentUserRole={currentUserRole}
                />
              ))}
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
