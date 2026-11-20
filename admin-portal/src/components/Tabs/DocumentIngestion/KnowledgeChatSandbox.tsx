import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Sparkles,
  Bot,
  User,
  ShieldCheck,
  FileText,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  ExternalLink,
  BookOpen,
  HelpCircle,
  Activity,
  Layers,
  Maximize2,
  Minimize2,
  Lock,
  Unlock,
  Check,
  ChevronRight
} from 'lucide-react';
import {
  auditDocumentCleanliness,
  chatTestKnowledgeStream,
  updateKnowledgeDocumentStatus
} from '../../../services/adminApi';
import { ClinicalMarkdown } from './ClinicalMarkdown';
import type {
  KnowledgeDocumentItem,
  CleanlinessAuditResponse,
  KnowledgeChatCitation
} from '../../../types/admin';

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  isStreaming?: boolean;
  citations?: KnowledgeChatCitation[];
  legalBasis?: string;
  suggestedChips?: string[];
  provider?: string;
  modelName?: string;
}

interface KnowledgeChatSandboxProps {
  selectedDoc: KnowledgeDocumentItem | null;
  uploadedFile: File | null;
  allDocs: KnowledgeDocumentItem[];
  onOpenPdf: (doc: KnowledgeDocumentItem, page?: number) => void;
  onStatusChange?: (docId: string, newStatus: 'staged' | 'active' | 'superseded') => void;
}

export const KnowledgeChatSandbox: React.FC<KnowledgeChatSandboxProps> = ({
  selectedDoc,
  uploadedFile,
  allDocs,
  onOpenPdf,
  onStatusChange
}) => {
  // Config state
  const [userRole, setUserRole] = useState<'doctor' | 'pharmacist'>('doctor');
  const [testScope, setTestScope] = useState<'scoped' | 'integrated'>('scoped');
  const [activeDocId, setActiveDocId] = useState<string>('');
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);

  // Cleanliness Audit state
  const [auditLoading, setAuditLoading] = useState<boolean>(false);
  const [auditResult, setAuditResult] = useState<CleanlinessAuditResponse | null>(null);
  const [auditError, setAuditError] = useState<string>('');

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [hasVerifiedAnswer, setHasVerifiedAnswer] = useState<boolean>(false);
  const [isActivating, setIsActivating] = useState<boolean>(false);
  const [activationSuccess, setActivationSuccess] = useState<string>('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync activeDocId with selectedDoc
  useEffect(() => {
    if (selectedDoc) {
      setActiveDocId(selectedDoc.id);
      setHasVerifiedAnswer(Boolean(selectedDoc.verified));
    } else if (allDocs.length > 0 && !activeDocId) {
      setActiveDocId(allDocs[0].id);
      setHasVerifiedAnswer(Boolean(allDocs[0].verified));
    }
  }, [selectedDoc, allDocs, activeDocId]);

  // Handle ESC key to exit full screen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullScreen) {
        setIsFullScreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullScreen]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Run cleanliness audit
  const runAudit = async () => {
    setAuditLoading(true);
    setAuditError('');
    try {
      let res: CleanlinessAuditResponse;
      if (uploadedFile) {
        res = await auditDocumentCleanliness(uploadedFile, undefined);
      } else if (activeDocId) {
        res = await auditDocumentCleanliness(undefined, activeDocId);
      } else {
        throw new Error('Vui lòng chọn một tài liệu hoặc tải lên tệp PDF để kiểm định.');
      }
      setAuditResult(res);
    } catch (err: unknown) {
      setAuditError(err instanceof Error ? err.message : 'Lỗi kiểm định tài liệu.');
    } finally {
      setAuditLoading(false);
    }
  };

  // Automatically trigger audit when selectedDoc or uploadedFile changes
  useEffect(() => {
    if (uploadedFile || activeDocId) {
      runAudit();
    }
  }, [uploadedFile, activeDocId]);

  // Handle send message
  const handleSendMessage = async (queryToSend?: string) => {
    const text = (queryToSend ?? inputText).trim();
    if (!text || isSending) return;

    setInputText('');
    setActivationSuccess('');
    const userMsgId = `user-${Date.now()}`;
    const botMsgId = `bot-${Date.now()}`;
    const nowStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text,
      timestamp: nowStr,
    };

    const initialBotMsg: ChatMessage = {
      id: botMsgId,
      sender: 'bot',
      text: '',
      timestamp: nowStr,
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, initialBotMsg]);
    setIsSending(true);

    const docFilter = testScope === 'scoped' ? activeDocId : undefined;
    const roleName = userRole === 'doctor' ? 'BS. Quản Trị Viên' : 'DS. Quản Trị Viên';

    try {
      const finalResp = await chatTestKnowledgeStream(
        text,
        docFilter,
        userRole,
        roleName,
        (_token, currentFull) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === botMsgId ? { ...m, text: currentFull } : m))
          );
        }
      );

      setMessages((prev) =>
        prev.map((m) =>
          m.id === botMsgId
            ? {
                ...m,
                text: finalResp.reply_text,
                isStreaming: false,
                citations: finalResp.citations,
                legalBasis: finalResp.legal_basis,
                suggestedChips: finalResp.suggested_chips,
                provider: finalResp.provider,
                modelName: finalResp.model_name,
              }
            : m
        )
      );

      // Nếu có trích dẫn nguồn số trang và câu trả lời hợp lệ -> Đánh dấu đã kiểm thử thành công
      if (finalResp.rag_grounded && finalResp.citations && finalResp.citations.length > 0) {
        setHasVerifiedAnswer(true);
      }
    } catch (err: unknown) {
      const errText = err instanceof Error ? err.message : 'Lỗi kết nối Copilot engine.';
      setMessages((prev) =>
        prev.map((m) =>
          m.id === botMsgId
            ? {
                ...m,
                text: `⚠️ **Không thể hoàn tất kiểm thử Chatbot:** ${errText}\nVui lòng kiểm tra lại kết nối backend hoặc API Key trong Key Vault.`,
                isStreaming: false,
              }
            : m
        )
      );
    } finally {
      setIsSending(false);
    }
  };

  // Handle Activate to Production DB
  const handleActivateToProduction = async () => {
    if (!activeDocId) return;
    if (!hasVerifiedAnswer) {
      alert('Chưa thể kích hoạt: Tài liệu cần được kiểm thử ít nhất 1 câu hỏi thành công có trích dẫn số trang.');
      return;
    }

    setIsActivating(true);
    try {
      await updateKnowledgeDocumentStatus(activeDocId, 'active', true);
      setActivationSuccess('Đã kích hoạt tài liệu thành công vào CSDL chính thức của Bệnh viện!');
      onStatusChange?.(activeDocId, 'active');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Lỗi khi kích hoạt tài liệu.');
    } finally {
      setIsActivating(false);
    }
  };

  const currentDocItem = allDocs.find((d) => d.id === activeDocId) || selectedDoc;
  const isDocActive = currentDocItem?.status === 'active';
  const isDocStaged = currentDocItem?.status === 'staged' || !currentDocItem?.status;

  const sandboxContent = (
    <div className={`bg-white flex flex-col ${isFullScreen ? 'h-full w-full' : 'h-[740px] rounded-lg border border-slate-200/90 overflow-hidden'}`}>
      {/* 1. Header Toolbar */}
      <div className="p-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2.5 bg-slate-50/70">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-teal-50 text-teal-800 border border-teal-200/80 flex items-center justify-center shrink-0">
            <Bot className="w-4.5 h-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">
                Khung Thử Nghiệm Chatbot Lâm Sàng
              </h3>
              <span className="text-2xs font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
                100% Logic App Bác Sĩ
              </span>
            </div>
            <p className="text-2xs text-slate-500">
              Kiểm tra trực tiếp độ hoàn chỉnh, trích dẫn số trang và an toàn CDSS với API Key thật
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* Role selector */}
          <select
            value={userRole}
            onChange={(e) => setUserRole(e.target.value as 'doctor' | 'pharmacist')}
            className="text-2xs font-semibold px-2 py-1 bg-white border border-slate-200 rounded-md text-slate-700 outline-hidden"
          >
            <option value="doctor">Vai trò: Bác sĩ điều trị</option>
            <option value="pharmacist">Vai trò: Dược sĩ lâm sàng</option>
          </select>

          {/* Test Scope Toggle */}
          <div className="flex rounded-md border border-slate-200 bg-white p-0.5 text-2xs font-medium">
            <button
              type="button"
              onClick={() => setTestScope('scoped')}
              className={`px-2 py-1 rounded cursor-pointer transition ${
                testScope === 'scoped' ? 'bg-slate-900 text-white font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Chỉ tra cứu trong văn bản được chọn"
            >
              Chỉ tài liệu này
            </button>
            <button
              type="button"
              onClick={() => setTestScope('integrated')}
              className={`px-2 py-1 rounded cursor-pointer transition ${
                testScope === 'integrated' ? 'bg-teal-700 text-white font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Tra cứu tích hợp toàn bộ kho tri thức bệnh viện"
            >
              Toàn viện (Integrated)
            </button>
          </div>

          {/* Clear messages */}
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setMessages([]);
                setHasVerifiedAnswer(Boolean(currentDocItem?.verified));
                setActivationSuccess('');
              }}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md cursor-pointer transition"
              title="Xóa phiên thử nghiệm"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Maximize / Minimize Full-Screen Button */}
          <button
            type="button"
            onClick={() => setIsFullScreen((prev) => !prev)}
            className="p-1.5 rounded-md border border-slate-200 hover:bg-slate-100 text-slate-700 transition cursor-pointer flex items-center gap-1 text-2xs font-medium"
            title={isFullScreen ? 'Thu nhỏ cửa sổ' : 'Mở toàn màn hình để kiểm tra chi tiết'}
          >
            {isFullScreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-slate-600" />
                <span className="hidden sm:inline">Thu nhỏ</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-slate-600" />
                <span className="hidden sm:inline">Mở Full Form</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Target Document Picker & Cleanliness Healthcheck Bar */}
      <div className="p-3 bg-white border-b border-slate-100 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <FileText className="w-4 h-4 text-teal-700 shrink-0" />
            <span className="font-semibold text-slate-700 shrink-0">Văn bản kiểm thử:</span>
            {uploadedFile ? (
              <span className="truncate font-mono text-teal-900 text-2xs bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                [Tệp mới] {uploadedFile.name} ({(uploadedFile.size / 1024).toFixed(0)} KB)
              </span>
            ) : (
              <select
                value={activeDocId}
                onChange={(e) => setActiveDocId(e.target.value)}
                className="text-2xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-md text-slate-800 truncate flex-1 max-w-md font-medium"
              >
                {allDocs.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    [{doc.status === 'active' ? 'ĐANG DÙNG' : doc.status === 'superseded' ? 'HẾT HIỆU LỰC' : 'CHỜ DUYỆT'}] {doc.title} ({doc.filename})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Status indicator badge */}
            <span
              className={`px-2 py-0.5 rounded text-2xs font-semibold border flex items-center gap-1 ${
                isDocActive
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              {isDocActive ? <Check className="w-3 h-3 text-emerald-600" /> : <Lock className="w-3 h-3 text-amber-600" />}
              <span>{isDocActive ? 'Đang áp dụng toàn viện' : 'Chờ kiểm duyệt (Staged)'}</span>
            </span>

            <button
              type="button"
              onClick={runAudit}
              disabled={auditLoading}
              className="text-2xs font-semibold text-slate-700 hover:text-teal-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2.5 py-1 rounded cursor-pointer transition flex items-center gap-1"
            >
              <Activity className={`w-3.5 h-3.5 ${auditLoading ? 'animate-spin text-teal-600' : ''}`} />
              <span>{auditLoading ? 'Đang quét...' : 'Kiểm định độ sạch AI'}</span>
            </button>
          </div>
        </div>

        {/* Cleanliness Audit Score & Details */}
        {auditResult && (
          <div className="p-3 rounded-lg bg-slate-50/80 border border-slate-200/90 text-xs space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded border ${
                    auditResult.status === 'clean'
                      ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                      : auditResult.status === 'warning'
                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                      : 'bg-rose-100 text-rose-900 border-rose-300'
                  }`}
                >
                  Độ sạch: {auditResult.cleanliness_score}/100
                </span>
                <span className="text-2xs text-slate-600 font-mono">
                  {auditResult.total_pages} trang · {(auditResult.extracted_chars / 1000).toFixed(1)}k ký tự · {auditResult.avg_chars_per_page} kt/trang
                </span>
              </div>
              <span className="text-2xs font-medium text-slate-700">
                {auditResult.status === 'clean' ? '✅ Văn bản sạch, đầy đủ text layer' : '⚠️ Cần lưu ý một số trang scan'}
              </span>
            </div>

            {/* Golden Questions Chips */}
            {auditResult.golden_questions && auditResult.golden_questions.length > 0 && (
              <div className="pt-2 border-t border-slate-200/60 space-y-1.5">
                <div className="text-2xs font-semibold text-slate-600 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Câu hỏi kiểm chứng vàng (Nhấp để Chatbot trả lời ngay với API Key thật):</span>
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  {auditResult.golden_questions.map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSendMessage(q)}
                      disabled={isSending}
                      className="text-2xs font-medium text-slate-800 bg-white hover:bg-teal-50 hover:text-teal-900 hover:border-teal-300 border border-slate-200 px-2.5 py-1.5 rounded-md text-left transition cursor-pointer flex items-center justify-between group disabled:opacity-50"
                    >
                      <span className="truncate pr-2">{idx + 1}. {q}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-teal-600 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {auditError && (
          <div className="p-2 rounded bg-rose-50 border border-rose-200 text-rose-800 text-2xs flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span>{auditError}</span>
          </div>
        )}
      </div>

      {/* 3. Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-4 bg-slate-50/40">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-2.5">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
              <HelpCircle className="w-6 h-6" />
            </div>
            <div className="text-xs sm:text-sm font-bold text-slate-700">Chưa có câu hỏi kiểm thử nào</div>
            <p className="text-2xs sm:text-xs text-slate-500 max-w-md leading-relaxed">
              Nhấp vào một trong các <strong>Câu hỏi kiểm chứng vàng</strong> ở trên hoặc nhập câu hỏi bên dưới để kiểm tra Chatbot.
              <br />
              <span className="text-amber-800 font-medium">
                * Quy chuẩn an toàn: Tài liệu phải hoàn thành ít nhất 1 câu hỏi kiểm thử thành công trước khi được kích hoạt vào CSDL chính thức.
              </span>
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'bot' && (
                <div className="w-7 h-7 rounded-md bg-teal-50 text-teal-800 border border-teal-200/80 flex items-center justify-center shrink-0 mt-1">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[88%] rounded-xl p-3.5 text-xs space-y-2.5 ${
                  msg.sender === 'user'
                    ? 'bg-slate-900 text-white font-medium shadow-2xs'
                    : 'bg-white border border-slate-200/90 text-slate-900 shadow-xs'
                }`}
              >
                {/* Message text with ClinicalMarkdown renderer */}
                {msg.sender === 'user' ? (
                  <div className="whitespace-pre-wrap">{msg.text}</div>
                ) : (
                  <div>
                    {msg.text ? (
                      <ClinicalMarkdown content={msg.text} />
                    ) : (
                      msg.isStreaming && (
                        <div className="text-slate-500 italic flex items-center gap-2">
                          <div className="w-3 h-3 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                          <span>Đang truy vấn RRF và trích xuất căn cứ y khoa...</span>
                        </div>
                      )
                    )}
                  </div>
                )}

                {/* Grounded Citations Box */}
                {msg.sender === 'bot' && msg.citations && msg.citations.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                    <div className="flex items-center justify-between text-2xs font-bold text-slate-600">
                      <span className="flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-teal-700" />
                        <span>Căn cứ pháp lý &amp; Trích dẫn số trang ({msg.citations.length}):</span>
                      </span>
                      {msg.legalBasis && (
                        <span className="font-mono text-teal-900 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                          {msg.legalBasis}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      {msg.citations.map((c, idx) => {
                        const pageMatch = c.page_or_section.match(/(\d+)/);
                        const pageNum = pageMatch ? parseInt(pageMatch[1], 10) : undefined;
                        return (
                          <div
                            key={idx}
                            className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-2xs space-y-1 hover:border-slate-300 transition"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-900 truncate">
                                {c.page_or_section} · {c.title}
                              </span>
                              {currentDocItem && (
                                <button
                                  type="button"
                                  onClick={() => onOpenPdf(currentDocItem, pageNum)}
                                  className="text-teal-700 hover:text-teal-900 flex items-center gap-1 font-semibold shrink-0 cursor-pointer bg-white px-2 py-0.5 rounded border border-slate-200 hover:border-teal-300 transition"
                                >
                                  <span>Xem {c.page_or_section}</span>
                                  <ExternalLink className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                            <p className="text-slate-600 line-clamp-2 italic font-serif">
                              "{c.snippet}"
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Model & Meta footer */}
                {msg.sender === 'bot' && !msg.isStreaming && (
                  <div className="pt-1.5 flex items-center justify-between text-3xs font-mono text-slate-400 border-t border-slate-50">
                    <span>{msg.modelName || 'gemini-3.5-flash-lite'} ({msg.provider || 'gemini'})</span>
                    <span>{msg.timestamp}</span>
                  </div>
                )}
              </div>

              {msg.sender === 'user' && (
                <div className="w-7 h-7 rounded-md bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 mt-1">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 4. Mandatory Verification Gate Banner */}
      <div className="px-3.5 py-2 border-t border-slate-200 bg-slate-50/90 flex flex-wrap items-center justify-between gap-2.5 text-xs">
        <div className="flex items-center gap-2">
          {hasVerifiedAnswer ? (
            <div className="flex items-center gap-1.5 text-emerald-800 font-semibold text-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Đã kiểm thử Chatbot thành công (có số trang trích dẫn). Sẵn sàng kích hoạt.</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-amber-800 font-semibold text-2xs">
              <Lock className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Chưa thể kích hoạt: Cần thực hiện ít nhất 1 câu hỏi kiểm thử trước khi nạp CSDL chính thức.</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {activationSuccess && (
            <span className="text-2xs text-emerald-700 font-semibold">
              {activationSuccess}
            </span>
          )}

          {isDocStaged && (
            <button
              type="button"
              onClick={handleActivateToProduction}
              disabled={!hasVerifiedAnswer || isActivating}
              className={`px-3 py-1.5 rounded-md font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-2xs ${
                hasVerifiedAnswer && !isActivating
                  ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
              }`}
              title={hasVerifiedAnswer ? 'Kích hoạt tài liệu vào CSDL chính thức của bệnh viện' : 'Phải kiểm thử trước khi kích hoạt'}
            >
              {isActivating ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5" />
              )}
              <span>Kích Hoạt Vào CSDL Chính Thức</span>
            </button>
          )}

          {isDocActive && (
            <span className="px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 text-2xs font-bold border border-emerald-300 flex items-center gap-1">
              <Check className="w-3.5 h-3.5 text-emerald-700" />
              <span>Đã Kích Hoạt Trong CSDL</span>
            </span>
          )}
        </div>
      </div>

      {/* 5. Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="p-3 bg-white border-t border-slate-200 flex items-center gap-2"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Nhập câu hỏi lâm sàng để test Chatbot (VD: Điều kiện chỉ định, liều dùng, căn cứ pháp lý...)"
          disabled={isSending}
          className="flex-1 text-xs px-3.5 py-2.5 rounded-lg border border-slate-200 focus:border-slate-800 outline-hidden bg-slate-50/50 focus:bg-white"
        />
        <button
          type="submit"
          disabled={isSending || !inputText.trim()}
          className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition shrink-0"
        >
          {isSending ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          <span>Gửi</span>
        </button>
      </form>
    </div>
  );

  if (isFullScreen) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150">
        <div className="w-full max-w-6xl h-[94vh] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden border border-slate-300">
          {sandboxContent}
        </div>
      </div>
    );
  }

  return sandboxContent;
};
