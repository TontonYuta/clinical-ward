/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Mic,
  Image as ImageIcon,
  Bot,
  User,
  CheckCircle2,
  Paperclip,
  X,
  ClipboardList,
  ArrowRight,
  ShieldCheck,
  Lock,
  Pill,
  AlertTriangle,
  Calendar,
  Package,
  Thermometer,
  FileText,
  RotateCcw,
  Sparkles,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { ChatMessage, QuickSuggestionChip, UserRole, AgentActionCard } from '../../types/clinical';
import { USER_PROFILES } from '../../data/initialData';
import { VoiceModal } from '../Modals/VoiceModal';
import { ImageModal } from '../Modals/ImageModal';
import { clinicalAudio } from '../../utils/audio';

interface ChatWindowProps {
  messages: ChatMessage[];
  suggestionChips: QuickSuggestionChip[];
  onSendMessage: (text: string, attachment?: any) => void;
  isProcessing: boolean;
  isAudioMuted: boolean;
  onSelectTab?: (tab: 'debt' | 'equipment' | 'fefo' | 'coldchain' | 'asset_audit') => void;
  currentUserRole?: UserRole;
  onClose?: () => void;
  pendingDebtsCount?: number;
  pendingAmpoulesCount?: number;
  urgentTicketsCount?: number;
  lowStockCount?: number;
  onExecuteCardAction?: (messageId: string, actionType: string, cardData: any) => void;
  onClearMessages?: () => void;
  onOpenAuditTrail?: () => void;
  onOpenLegalDocs?: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  messages,
  suggestionChips,
  onSendMessage,
  isProcessing,
  isAudioMuted,
  onSelectTab,
  currentUserRole = 'nurse',
  onClose,
  pendingDebtsCount = 0,
  pendingAmpoulesCount = 0,
  urgentTicketsCount = 0,
  lowStockCount = 0,
  onExecuteCardAction,
  onClearMessages,
  onOpenAuditTrail,
  onOpenLegalDocs,
}) => {
  const [inputText, setInputText] = useState('');
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isImageOpen, setIsImageOpen] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isProcessing) return;

    if (!isAudioMuted) clinicalAudio.playTelegramChime();
    onSendMessage(inputText);
    setInputText('');
  };

  const handleChipClick = (chipOrText: string | QuickSuggestionChip) => {
    if (!isAudioMuted) clinicalAudio.playTelegramChime();
    const prompt = typeof chipOrText === 'string' ? chipOrText : chipOrText.fullPrompt;
    onSendMessage(prompt);
  };

  const handleVoiceTranscript = (text: string, sendImmediately?: boolean) => {
    if (sendImmediately) {
      onSendMessage(text);
    } else {
      setInputText(text);
    }
  };

  const handleImageSend = (title: string, prompt: string) => {
    if (!isAudioMuted) clinicalAudio.playTelegramChime();
    onSendMessage(prompt, {
      type: 'image',
      title,
      description: 'Ảnh đính kèm'
    });
  };

  // Robust inline markdown formatter (supports **bold**, `code`, *italic*, _italic_, [link](url))
  const formatInlineMarkdown = (text: string, isDark: boolean = false): React.ReactNode => {
    if (!text) return null;

    const tokens = text.split(/(\*\*\*[\s\S]+?\*\*\*|\*\*[\s\S]+?\*\*|`[^`\n]+`|\[[^\]]+\]\([^\)]+\)|\*[^*\n]+?\*|_[^_\n]+?_)/g);

    return tokens.map((part, i) => {
      if (!part) return null;

      // 1. Bold + Italic: ***text***
      if (part.startsWith('***') && part.endsWith('***') && part.length >= 6) {
        return (
          <strong key={i} className={`font-bold italic ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {part.slice(3, -3)}
          </strong>
        );
      }

      // 2. Bold: **text**
      if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
        return (
          <strong key={i} className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {part.slice(2, -2)}
          </strong>
        );
      }

      // 3. Inline Code: `text`
      if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
        return (
          <code
            key={i}
            className={`px-1.5 py-0.5 rounded font-mono text-[11px] font-semibold border ${
              isDark
                ? 'bg-slate-800 text-teal-300 border-slate-700'
                : 'bg-slate-100 text-teal-800 border-slate-200'
            }`}
          >
            {part.slice(1, -1)}
          </code>
        );
      }

      // 4. Markdown Link: [text](url)
      const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        return (
          <a
            key={i}
            href={linkMatch[2]}
            target="_blank"
            rel="noreferrer"
            className={`underline font-semibold transition ${isDark ? 'text-teal-300 hover:text-teal-200' : 'text-teal-700 hover:text-teal-900'}`}
          >
            {linkMatch[1]}
          </a>
        );
      }

      // 5. Italic: *text* or _text_
      if (
        ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) &&
        part.length >= 2 &&
        !part.startsWith('**')
      ) {
        return (
          <em key={i} className={`italic ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            {part.slice(1, -1)}
          </em>
        );
      }

      return part;
    });
  };

  const renderFormattedText = (text: string, isDark: boolean = false) => {
    if (!text) return null;

    const rawLines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < rawLines.length) {
      const line = rawLines[i];

      // 1. Grouped Alert Callouts: > [!WARNING], > [!NOTE], > [!IMPORTANT], > [!TIP]
      if (line.trim().startsWith('> [!')) {
        const isWarning = line.includes('[!WARNING]') || line.includes('[!CAUTION]');
        const isImportant = line.includes('[!IMPORTANT]');
        const isTip = line.includes('[!TIP]');

        let alertTitle = 'LƯU Ý LÂM SÀNG';
        if (isWarning) alertTitle = 'CẢNH BÁO PHÁP LÝ (TT 20/2017 & TT 22/2011)';
        else if (isImportant) alertTitle = 'QUY ĐỊNH BẮT BUỘC';
        else if (isTip) alertTitle = 'KHUYẾN CÁO THỰC HÀNH';

        // Gather all following lines that start with '>'
        const bodyLines: string[] = [];
        let j = i + 1;
        while (j < rawLines.length && rawLines[j].trim().startsWith('>')) {
          bodyLines.push(rawLines[j].trim().replace(/^>\s*/, ''));
          j++;
        }
        i = j; // Advance past this alert block

        elements.push(
          <div
            key={`alert-${i}`}
            className={`my-2 p-2.5 rounded-lg border text-[11px] space-y-1 ${
              isWarning
                ? 'bg-amber-50/90 border-amber-300/80 text-amber-950'
                : 'bg-teal-50/90 border-teal-300/80 text-teal-950'
            }`}
          >
            <div
              className={`flex items-center gap-1.5 font-bold text-[10px] uppercase tracking-wider ${
                isWarning ? 'text-amber-800' : 'text-teal-800'
              }`}
            >
              {isWarning ? (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              )}
              <span>{alertTitle}</span>
            </div>
            {bodyLines.length > 0 && (
              <div className={`leading-relaxed text-[11px] ${isWarning ? 'text-amber-900' : 'text-teal-900'}`}>
                {bodyLines.map((bLine, bIdx) => (
                  <div key={bIdx} className="my-0.5">
                    {formatInlineMarkdown(bLine, false)}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
        continue;
      }

      // 2. Generic Blockquote: > text
      if (line.trim().startsWith('>')) {
        const quoteContent = line.trim().replace(/^>\s*/, '');
        elements.push(
          <div
            key={`quote-${i}`}
            className="my-1.5 pl-3 py-1 border-l-2 border-teal-600/70 bg-teal-50/40 rounded-r text-[11px] text-slate-700 italic"
          >
            {formatInlineMarkdown(quoteContent, isDark)}
          </div>
        );
        i++;
        continue;
      }

      // 3. Empty line spacer
      if (line.trim() === '') {
        elements.push(<div key={`spacer-${i}`} className="h-1.5" />);
        i++;
        continue;
      }

      // 4. Bullet lines or numbered list lines
      const isBullet = line.trim().startsWith('•') || line.trim().startsWith('-') || /^\d+\.\s/.test(line.trim());
      elements.push(
        <div
          key={`line-${i}`}
          className={isBullet ? 'pl-2 my-0.5 leading-relaxed' : 'my-0.5 leading-relaxed'}
        >
          {formatInlineMarkdown(line, isDark)}
        </div>
      );
      i++;
    }

    return elements;
  };

  // Render Interactive Action Card
  const renderActionCard = (msg: ChatMessage) => {
    const card = msg.card;
    if (!card) return null;

    const isExecuted = card.status === 'executed';

    return (
      <div className="mt-2.5 rounded-xl border border-slate-200/90 bg-slate-50/90 overflow-hidden shadow-xs">
        {/* Card Header */}
        <div className="px-3 py-2 bg-slate-100/90 border-b border-slate-200/80 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {card.cardType === 'shift_handover_report' && <ClipboardList className="w-3.5 h-3.5 text-blue-700" />}
            {card.cardType === 'borrow_confirm' && <Pill className="w-3.5 h-3.5 text-emerald-700" />}
            {card.cardType === 'incident_confirm' && <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />}
            {card.cardType === 'fefo_report' && <Calendar className="w-3.5 h-3.5 text-blue-600" />}
            {card.cardType === 'low_stock_report' && <Package className="w-3.5 h-3.5 text-amber-600" />}
            {card.cardType === 'coldchain_status' && <Thermometer className="w-3.5 h-3.5 text-cyan-600" />}
            {card.cardType === 'audit_integrity' && <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />}
            {card.cardType === 'legal_guide' && <FileText className="w-3.5 h-3.5 text-purple-600" />}
            <span className="text-[11px] font-bold text-slate-800 uppercase tracking-tight">{formatInlineMarkdown(card.title)}</span>
          </div>

          {isExecuted ? (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Đã thực thi
            </span>
          ) : (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-600 font-mono">
              Agent Card
            </span>
          )}
        </div>

        {/* Card Body Content */}
        <div className="p-3 text-[11px] text-slate-700 space-y-2">
          {/* 0. Shift Handover Report Card */}
          {card.cardType === 'shift_handover_report' && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="p-2 rounded bg-white border border-slate-200">
                  <span className="text-slate-500 block">Số lượt mượn đêm qua:</span>
                  <span className="text-sm font-bold text-slate-900 font-mono">{card.data.total_debts} lượt</span>
                </div>
                <div className={`p-2 rounded border ${card.data.pending_ampoules_count > 0 ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
                  <span className="block text-[10px] opacity-80">Nợ vỏ Morphin chưa nộp:</span>
                  <span className="text-sm font-bold font-mono">{card.data.pending_ampoules_count} vỏ</span>
                </div>
              </div>

              {card.data.pending_list && card.data.pending_list.length > 0 && (
                <div className="p-2 rounded bg-rose-50/90 border border-rose-200 text-[10px] space-y-1">
                  <span className="font-bold text-rose-800 block flex items-center gap-1">
                    <Lock className="w-3 h-3 text-rose-600" />
                    Vi phạm thu hồi vỏ ống (Điều 15 TT 20/2017):
                  </span>
                  {card.data.pending_list.slice(0, 3).map((it: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-rose-700 text-[9.5px]">
                      <span className="truncate max-w-[170px]">• {it.patient} ({it.room})</span>
                      <span className="font-bold">{it.quantity}</span>
                    </div>
                  ))}
                </div>
              )}

              {card.data.replenishment && card.data.replenishment.length > 0 && (
                <div className="p-2 rounded bg-white border border-slate-200 text-[10px] space-y-1">
                  <span className="font-bold text-slate-700 block">Cần Kho Dược cấp bù sáng nay:</span>
                  <div className="flex flex-wrap gap-1">
                    {card.data.replenishment.map((r: any, idx: number) => (
                      <span key={idx} className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-800 font-mono text-[9px]">
                        {r.name}: <b>{r.needed}</b>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 1. Borrow Confirm Card */}
          {card.cardType === 'borrow_confirm' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Thuốc/Vật tư:</span>
                <span className="font-bold text-slate-900">{formatInlineMarkdown(card.data.item_name)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Số lượng:</span>
                <span className="font-bold text-slate-900 font-mono">{card.data.quantity_str || `${card.data.quantity} đơn vị`}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Bệnh nhân:</span>
                <span className="font-semibold text-slate-900">{formatInlineMarkdown(card.data.patient_name)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Vị trí cấp cứu:</span>
                <span className="font-medium text-slate-800">{card.data.patient_room}</span>
              </div>
              {card.data.clinical_reason && (
                <div className="text-slate-600">
                  <span className="text-slate-500">Chỉ định: </span>
                  <span className="font-semibold text-slate-800">{formatInlineMarkdown(card.data.clinical_reason)}</span>
                </div>
              )}
              {card.data.is_narcotic && (
                <div className="p-1.5 rounded bg-rose-50 border border-rose-200 text-rose-800 text-[10px] font-semibold flex items-center gap-1.5">
                  <Lock className="w-3 h-3 text-rose-600 shrink-0" />
                  <span>Khoá nợ TT 20/2017: Bắt buộc thu hồi vỏ ống sau khi tiêm</span>
                </div>
              )}
            </div>
          )}

          {/* 2. Incident Confirm Card */}
          {card.cardType === 'incident_confirm' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Thiết bị:</span>
                <span className="font-bold text-slate-900">{formatInlineMarkdown(card.data.device_name)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Rủi ro (NĐ 98):</span>
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${card.data.risk_class === 'D' ? 'bg-rose-100 text-rose-800 border border-rose-300' : 'bg-amber-100 text-amber-800'}`}>
                  Loại {card.data.risk_class} (Ưu tiên {card.data.urgency === 'urgent' ? 'P1 Khẩn cấp' : 'P2'})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Vị trí sự cố:</span>
                <span className="font-medium text-slate-800">{card.data.location}</span>
              </div>
              <div className="text-slate-600">
                <span className="text-slate-500">Mô tả lỗi: </span>
                <span className="font-semibold text-slate-800">{formatInlineMarkdown(card.data.accessory_issue)}</span>
              </div>
            </div>
          )}

          {/* 3. FEFO Report Mini-Table */}
          {card.cardType === 'fefo_report' && card.data.batches && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Danh sách lô cận hạn &lt; 60 ngày:</p>
              <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                {card.data.batches.slice(0, 5).map((b: any, idx: number) => (
                  <div key={idx} className="p-1.5 rounded bg-white border border-slate-200 flex items-center justify-between text-[10px]">
                    <div className="truncate max-w-[190px]">
                      <div className="font-bold text-slate-900 truncate">{formatInlineMarkdown(b.name)}</div>
                      <div className="text-slate-400 font-mono">Lô: {b.batch} • Hạn: {b.expiry}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                        Còn {b.days_left} ngày
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. Low Stock Report */}
          {card.cardType === 'low_stock_report' && card.data.items && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Mặt hàng chạm ngưỡng Min cần bù:</p>
              <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                {card.data.items.slice(0, 4).map((it: any, idx: number) => (
                  <div key={idx} className="p-1.5 rounded bg-white border border-slate-200 flex items-center justify-between text-[10px]">
                    <span className="font-semibold text-slate-800 truncate max-w-[180px]">{formatInlineMarkdown(it.name)}</span>
                    <span className="font-mono text-amber-800 font-bold bg-amber-50 px-1 rounded">
                      +{it.needed} {it.unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. Cold Chain Diagnostic Card */}
          {card.cardType === 'coldchain_status' && (
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="p-2 rounded bg-white border border-slate-200">
                <span className="text-slate-500 block">Nhiệt độ hiện tại:</span>
                <span className="text-sm font-bold text-teal-800">{card.data.temperature}°C</span>
              </div>
              <div className="p-2 rounded bg-white border border-slate-200">
                <span className="text-slate-500 block">Chỉ số MKT:</span>
                <span className="text-sm font-bold text-slate-800">{card.data.mkt}°C</span>
              </div>
            </div>
          )}

          {/* 6. Audit Integrity Card */}
          {card.cardType === 'audit_integrity' && (
            <div className="p-2 rounded bg-white border border-slate-200 text-[10px] space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Chuỗi băm HMAC-SHA256 hợp lệ 100%</span>
              </div>
              <div className="text-slate-500">Khối khởi tạo: <code className="font-mono text-[9px] bg-slate-100 px-1 rounded text-slate-700">{card.data.genesis}</code></div>
            </div>
          )}

          {/* 7. Legal Guide Card */}
          {card.cardType === 'legal_guide' && (
            <div className="p-2 rounded bg-white border border-slate-200 text-[10px] text-slate-700">
              <div className="font-bold text-purple-900 mb-0.5">{card.data.doc_title}</div>
              <div className="line-clamp-3 text-slate-600 leading-snug">{formatInlineMarkdown(card.data.content)}</div>
            </div>
          )}
        </div>

        {/* Card Action Buttons */}
        <div className="px-3 py-2 bg-white border-t border-slate-200/90 flex items-center justify-between gap-2">
          {card.primaryActionLabel && !isExecuted && (
            <button
              onClick={() => {
                if (card.primaryActionType && onExecuteCardAction) {
                  onExecuteCardAction(msg.id, card.primaryActionType, card.data);
                } else if (card.targetTab && onSelectTab) {
                  onSelectTab(card.targetTab);
                }
              }}
              className="flex-1 py-1.5 px-3 rounded-lg bg-teal-800 hover:bg-teal-900 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-300" />
              <span>{card.primaryActionLabel}</span>
            </button>
          )}

          {card.targetTab && onSelectTab && (
            <button
              onClick={() => onSelectTab(card.targetTab!)}
              className="py-1.5 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition flex items-center gap-1 cursor-pointer shrink-0"
              title="Chuyển đến phân hệ tương ứng"
            >
              <span>Xem bảng</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/70 relative overflow-hidden">
      {/* 1. Header (Clean 42px) */}
      <div className="h-10 px-3.5 bg-white border-b border-slate-200/90 flex items-center justify-between shrink-0 shadow-2xs">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-teal-800 flex items-center justify-center text-white shadow-2xs">
            <Bot className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-900">Trợ Lý Agent Lâm Sàng</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Agent Live REST API" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {onClearMessages && (
            <button
              onClick={onClearMessages}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              title="Làm mới phiên hội thoại"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              title="Thu nhỏ Trợ lý AI"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Messages Stream */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
        {messages.map((msg) => {
          const isAgent = msg.sender === 'agent';
          const isSystem = msg.sender === 'system';
          const isUser = msg.sender === 'user';
          const isDarkBubble = isUser || isSystem;

          return (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-white text-xs shadow-2xs ${
                  isSystem
                    ? 'bg-teal-900 text-teal-300 border border-teal-500/40'
                    : isAgent
                    ? 'bg-teal-800'
                    : 'bg-slate-800'
                }`}
              >
                {isSystem ? (
                  <ShieldCheck className="w-4 h-4 text-emerald-300" />
                ) : isAgent ? (
                  <Bot className="w-4 h-4" />
                ) : (
                  <User className="w-4 h-4" />
                )}
              </div>

              <div
                className={`max-w-[90%] rounded-xl p-3 text-xs leading-relaxed shadow-2xs ${
                  isSystem
                    ? 'bg-slate-900 text-slate-100 border border-teal-500/30'
                    : isAgent
                    ? 'bg-white border border-slate-200 text-slate-850'
                    : 'bg-slate-900 text-white'
                }`}
              >
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="mb-2 p-1.5 rounded-md bg-black/10 text-[11px] flex items-center gap-1.5 font-medium">
                    <Paperclip className="w-3.5 h-3.5 shrink-0 text-teal-400" />
                    <span className="truncate">{msg.attachments[0].title}</span>
                  </div>
                )}

                <div className="space-y-1">{renderFormattedText(msg.text, isDarkBubble)}</div>

                {/* Render Interactive Action Card if attached */}
                {renderActionCard(msg)}

                {/* Contextual Suggested Chips right below message */}
                {msg.suggestedChips && msg.suggestedChips.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap gap-1">
                    {msg.suggestedChips.map((chipText, cIdx) => (
                      <button
                        key={cIdx}
                        onClick={() => handleChipClick(chipText)}
                        className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-900 border border-slate-200 transition cursor-pointer"
                      >
                        {chipText}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Bảng Giao Ban Ca Trực (Shift Briefing Empty State) */}
        {messages.length <= 1 && (
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <ClipboardList className="w-4 h-4 text-teal-700" />
                <span className="text-xs font-bold text-slate-900">Bảng Giao Ban Ca Trực</span>
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Ưu tiên phiên làm việc
              </span>
            </div>

            <div className="space-y-2">
              {currentUserRole === 'nurse' && (
                <>
                  <div
                    onClick={() => handleChipClick('Mượn 2 ống Morphin sulfat buồng cấp cứu 3')}
                    className="p-2.5 rounded-lg bg-slate-50 hover:bg-emerald-50/60 border border-slate-200 hover:border-emerald-300 transition cursor-pointer flex items-start justify-between group"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        <span className="text-xs font-bold text-slate-900">Mượn khẩn thuốc cấp cứu</span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 font-mono">
                          {pendingDebtsCount} phiếu nợ
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                        Ghi nợ thuốc ca đêm theo Điều 10 TT 22/2011/TT-BYT.
                      </p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-700 shrink-0 mt-0.5 transition" />
                  </div>

                  <div
                    onClick={() => handleChipClick('Báo hỏng máy thở PB840 phòng mổ 2 bị xì khí')}
                    className="p-2.5 rounded-lg bg-slate-50 hover:bg-rose-50/60 border border-slate-200 hover:border-rose-300 transition cursor-pointer flex items-start justify-between group"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                        <span className="text-xs font-bold text-slate-900">Báo hỏng máy thở phòng mổ</span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 text-rose-800 font-mono">
                          Loại D
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                        Tự động điều phối dây thở dự phòng theo Điều 34 NĐ 98/2021.
                      </p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-rose-700 shrink-0 mt-0.5 transition" />
                  </div>
                </>
              )}

              {currentUserRole === 'pharmacist' && (
                <>
                  <div
                    onClick={() => handleChipClick('Cho tôi xem danh sách thuốc cận hạn dưới 60 ngày theo FEFO')}
                    className="p-2.5 rounded-lg bg-slate-50 hover:bg-purple-50/60 border border-slate-200 hover:border-purple-300 transition cursor-pointer flex items-start justify-between group"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                        <span className="text-xs font-bold text-slate-900">Tra cứu hạn dùng FEFO</span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-purple-100 text-purple-800 font-mono">
                          {lowStockCount} lô
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                        Xuất kho lô cận hạn trước theo Thông tư 36/2018/TT-BYT GSP.
                      </p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-purple-700 shrink-0 mt-0.5 transition" />
                  </div>

                  <div
                    onClick={() => handleChipClick('Kiểm tra nhiệt độ tủ lạnh vắc xin và chỉ số MKT')}
                    className="p-2.5 rounded-lg bg-slate-50 hover:bg-blue-50/60 border border-slate-200 hover:border-blue-300 transition cursor-pointer flex items-start justify-between group"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                        <span className="text-xs font-bold text-slate-900">Dây chuyền lạnh GSP</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                        Giám sát chuỗi lạnh vắc xin 2°C - 8°C và quy trình ứng phó mất điện.
                      </p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-700 shrink-0 mt-0.5 transition" />
                  </div>
                </>
              )}

              {currentUserRole === 'biomedical_engineer' && (
                <>
                  <div
                    onClick={() => handleChipClick('Kiểm tra danh sách thiết bị y tế đang hỏng')}
                    className="p-2.5 rounded-lg bg-slate-50 hover:bg-rose-50/60 border border-slate-200 hover:border-rose-300 transition cursor-pointer flex items-start justify-between group"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                        <span className="text-xs font-bold text-slate-900">Tiếp nhận sửa máy khẩn</span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 text-rose-800 font-mono">
                          {urgentTicketsCount} ca
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                        Ưu tiên sửa chữa & dán tem kiểm định đo lường theo NĐ 98/2021.
                      </p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-rose-700 shrink-0 mt-0.5 transition" />
                  </div>

                  <div
                    onClick={() => handleChipClick('Kiểm kê tài sản 31/12 bằng mã QR')}
                    className="p-2.5 rounded-lg bg-slate-50 hover:bg-teal-50/60 border border-slate-200 hover:border-teal-300 transition cursor-pointer flex items-start justify-between group"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
                        <span className="text-xs font-bold text-slate-900">Quét mã QR kiểm kê</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                        Đối chiếu số serial, vị trí buồng bệnh thực tế và tỷ lệ hao mòn tài sản.
                      </p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-teal-700 shrink-0 mt-0.5 transition" />
                  </div>
                </>
              )}

              {currentUserRole === 'director' && (
                <>
                  <div
                    onClick={() => handleChipClick('Kiểm tra tính toàn vẹn sổ kiểm toán chuỗi băm HMAC-SHA256')}
                    className="p-2.5 rounded-lg bg-slate-50 hover:bg-amber-50/60 border border-slate-200 hover:border-amber-300 transition cursor-pointer flex items-start justify-between group"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                        <span className="text-xs font-bold text-slate-900">Giám sát pháp lý toàn viện</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                        Tuân thủ TT 22, TT 20 thuốc gây nghiện, NĐ 98 thiết bị y tế & NĐ 151 tài sản công.
                      </p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-700 shrink-0 mt-0.5 transition" />
                  </div>

                  <div
                    onClick={() => handleChipClick('Mặt hàng nào đang chạm ngưỡng cạn kho cần duyệt dự trù Mẫu 01?')}
                    className="p-2.5 rounded-lg bg-slate-50 hover:bg-rose-50/60 border border-slate-200 hover:border-rose-300 transition cursor-pointer flex items-start justify-between group"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                        <span className="text-xs font-bold text-slate-900">Dự trù cơ số & thanh lý</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                        Ký phê duyệt tờ trình thanh lý trang thiết bị hỏng nát ngưng dùng trên 12 tháng.
                      </p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-rose-700 shrink-0 mt-0.5 transition" />
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="flex items-center gap-2 text-xs text-slate-500 pl-9 font-medium animate-pulse">
            <span className="w-2 h-2 rounded-full bg-teal-600 animate-ping"></span>
            <span>Trợ lý Agent đang phân tích ngữ cảnh lâm sàng...</span>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* 3. Sleek Suggestion Chips Bar */}
      {suggestionChips && suggestionChips.length > 0 && (
        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200/80 flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
          {suggestionChips.map((chip) => (
            <button
              key={chip.id}
              onClick={() => handleChipClick(chip)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white hover:bg-slate-100 text-[11px] font-medium text-slate-700 whitespace-nowrap transition cursor-pointer shrink-0 border border-slate-200 shadow-2xs hover:border-slate-300"
            >
              <span>{chip.label}</span>
              {chip.badge && (
                <span className="text-[9px] font-mono text-slate-500 font-semibold bg-slate-100 px-1 rounded">
                  {chip.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* 4. Input Area */}
      <div className="p-3 bg-white border-t border-slate-200 shrink-0">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Nhập yêu cầu lâm sàng (VD: Lấy 2 lọ Morphin...)"
              className="w-full pl-3.5 pr-20 h-10 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:border-slate-800 focus:bg-white text-slate-900 transition shadow-2xs font-medium"
              disabled={isProcessing}
            />

            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsVoiceOpen(true)}
                title="Giọng nói lâm sàng"
                className="p-1.5 rounded-md hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition cursor-pointer"
              >
                <Mic className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsImageOpen(true)}
                title="Đính kèm ảnh hiện trường sự cố"
                className="p-1.5 rounded-md hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition cursor-pointer"
              >
                <ImageIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={!inputText.trim() || isProcessing}
            className="h-10 w-10 rounded-lg bg-teal-800 text-white hover:bg-teal-900 disabled:opacity-40 transition shrink-0 flex items-center justify-center shadow-2xs cursor-pointer"
            title="Gửi lệnh"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Modals */}
      <VoiceModal
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        onSelectTranscript={handleVoiceTranscript}
        isAudioMuted={isAudioMuted}
      />

      <ImageModal
        isOpen={isImageOpen}
        onClose={() => setIsImageOpen(false)}
        onSendImageWithText={handleImageSend}
      />
    </div>
  );
};
