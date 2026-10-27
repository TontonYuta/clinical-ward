/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  ClipboardList,
  Pill,
  AlertTriangle,
  Calendar,
  Package,
  Thermometer,
  ShieldCheck,
  FileText,
  FileSpreadsheet,
  Wrench,
  CheckCircle2,
  Sparkles,
  ChevronRight,
  Stethoscope,
  Clock
} from 'lucide-react';
import { ChatMessage, DashboardTab } from '../../../types/clinical';
import { AgentActionCard } from '../../../types/chat';
import { formatInlineMarkdown } from '../ChatMarkdown';
import { CdssAlertBanner } from './CdssAlertBanner';
import { BorrowConfirmCard } from './BorrowConfirmCard';
import { IncidentConfirmCard } from './IncidentConfirmCard';
import { ShiftHandoverCard } from './ShiftHandoverCard';
import { FefoReportCard, LowStockReportCard } from './InventoryReportCards';
import { LegalGuideCard } from './LegalGuideCard';
import { MedicationSafetyDetailsCard } from './MedicationSafetyDetailsCard';
import { MedicationScheduleCard } from './MedicationScheduleCard';
import { CpoeOrderCard } from './CpoeOrderCard';
import { DebtSettleCard } from './DebtSettleCard';
import {
  ColdChainStatusCard,
  AuditIntegrityCard,
  OcrInvoiceCard,
  BiomedicalDiagnosticsCard
} from './DiagnosticsReportCards';

interface ActionCardDispatcherProps {
  msg?: ChatMessage;
  card?: AgentActionCard;
  messageId?: string;
  onExecuteCardAction?: (messageId: string, actionType: string, cardData: any) => void;
  onExecuteAction?: (messageId: string, actionType: string, cardData: any) => void;
  onSelectTab?: (tab: DashboardTab) => void;
  onOpenLegalDocs?: () => void;
}

export const ActionCardDispatcher: React.FC<ActionCardDispatcherProps> = ({
  msg,
  card: cardProp,
  messageId: messageIdProp,
  onExecuteCardAction,
  onExecuteAction,
  onSelectTab,
  onOpenLegalDocs
}) => {
  const card = cardProp || msg?.card;
  if (!card) return null;
  const messageId = messageIdProp || msg?.id || '';
  const executeFn = onExecuteAction || onExecuteCardAction;
  const isExecuted = card.status === 'executed';

  return (
    <div className="mt-2.5 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden shadow-2xs">
      <div className="px-3.5 py-2.5 bg-slate-100/90 border-b border-slate-200/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {card.cardType === 'shift_handover_report' && <ClipboardList className="w-4 h-4 text-blue-700" />}
          {card.cardType === 'borrow_confirm' && <Pill className="w-4 h-4 text-emerald-700" />}
          {card.cardType === 'incident_confirm' && <AlertTriangle className="w-4 h-4 text-rose-600" />}
          {card.cardType === 'fefo_report' && <Calendar className="w-4 h-4 text-blue-600" />}
          {card.cardType === 'low_stock_report' && <Package className="w-4 h-4 text-amber-600" />}
          {card.cardType === 'coldchain_status' && <Thermometer className="w-4 h-4 text-cyan-600" />}
          {card.cardType === 'audit_integrity' && <ShieldCheck className="w-4 h-4 text-teal-600" />}
          {card.cardType === 'legal_guide' && <FileText className="w-4 h-4 text-purple-600" />}
          {card.cardType === 'ocr_invoice_confirm' && <FileSpreadsheet className="w-4 h-4 text-indigo-700" />}
          {card.cardType === 'biomedical_diagnostics' && <Wrench className="w-4 h-4 text-orange-600" />}
          {card.cardType === 'medication_safety' && <Stethoscope className="w-4 h-4 text-teal-700" />}
          {card.cardType === 'medication_schedule' && <Clock className="w-4 h-4 text-teal-700" />}
          <span className="text-xs font-bold text-slate-800 uppercase tracking-tight">
            {formatInlineMarkdown(card.title)}
          </span>
        </div>
        {isExecuted ? (
          <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Đã thực thi
          </span>
        ) : (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-200/80 text-slate-600 font-mono">
            Agent Card
          </span>
        )}
      </div>

      <div className="p-3.5 text-xs text-slate-700 space-y-2.5">
        {card.cdssAlert && <CdssAlertBanner alert={card.cdssAlert} />}
        {card.cardType === 'shift_handover_report' && <ShiftHandoverCard data={card.data} />}
        {card.cardType === 'borrow_confirm' && <BorrowConfirmCard data={card.data} />}
        {card.cardType === 'incident_confirm' && <IncidentConfirmCard data={card.data} />}
        {card.cardType === 'fefo_report' && card.data.batches && <FefoReportCard batches={card.data.batches} />}
        {card.cardType === 'low_stock_report' && card.data.items && <LowStockReportCard items={card.data.items} />}
        {card.cardType === 'coldchain_status' && <ColdChainStatusCard data={card.data} />}
        {card.cardType === 'audit_integrity' && <AuditIntegrityCard data={card.data} />}
        {card.cardType === 'legal_guide' && <LegalGuideCard data={card.data} onOpenLegalDocs={onOpenLegalDocs} />}
        {card.cardType === 'ocr_invoice_confirm' && <OcrInvoiceCard data={card.data} />}
        {card.cardType === 'biomedical_diagnostics' && <BiomedicalDiagnosticsCard data={card.data} />}
        {card.cardType === 'medication_safety' && <MedicationSafetyDetailsCard data={card.data} />}
        {card.cardType === 'medication_schedule' && <MedicationScheduleCard data={card.data} onSelectTab={onSelectTab} />}
        {card.cardType === 'cpoe_prescription' && <CpoeOrderCard order={card.data} />}
        {card.cardType === 'debt_settle' && <DebtSettleCard data={card.data} />}
      </div>

      <div className="px-3.5 py-2.5 bg-white border-t border-slate-200/90 flex items-center justify-between gap-2.5">
        {card.primaryActionLabel && !isExecuted && (
          <button
            onClick={() => {
              if (card.primaryActionType && executeFn) {
                executeFn(messageId, card.primaryActionType, card.data);
              } else if (card.targetTab && onSelectTab) {
                onSelectTab(card.targetTab);
              }
            }}
            className="flex-1 h-8.5 px-3 rounded-lg bg-teal-800 hover:bg-teal-900 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
          >
            <Sparkles className="w-3.5 h-3.5 text-teal-300" />
            <span>{card.primaryActionLabel}</span>
          </button>
        )}
        {card.targetTab && onSelectTab && (
          <button
            onClick={() => onSelectTab(card.targetTab!)}
            className="h-8.5 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition flex items-center gap-1 cursor-pointer shrink-0 active:scale-98"
            title="Chuyển đến phân hệ tương ứng"
          >
            <span>Xem bảng</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
