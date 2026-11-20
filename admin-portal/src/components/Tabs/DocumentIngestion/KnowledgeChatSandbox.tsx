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
  Layers
} from 'lucide-react';
import {
  auditDocumentCleanliness,
  chatTestKnowledgeStream
} from '../../../services/adminApi';
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
  onOpenPdf: (doc: KnowledgeDocumentItem) => void;
  onConfirmIngested?: () => void;
}

export const KnowledgeChatSandbox: React.FC<KnowledgeChatSandboxProps> = ({
  selectedDoc,
  uploadedFile,
  allDocs,
  onOpenPdf,
  onConfirmIngested
}) => {
  // Config state
  const [userRole, setUserRole] = useState<'doctor' | 'pharmacist'>('doctor');
  const [testScope, setTestScope] = useState<'scoped' | 'integrated'>('scoped');
  const [activeDocId, setActiveDocId] = useState<string>('');

  // Cleanliness Audit state
  const [auditLoading, setAuditLoading] = useState<boolean>(false);
  const [auditResult, setAuditResult] = useState<CleanlinessAuditResponse | null>(null);
  const [auditError, setAuditError] = useState<string>('');

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [hasVerifiedAnswer, setHasVerifiedAnswer] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync activeDocId with selectedDoc
  useEffect(() => {
    if (selectedDoc) {
      setActiveDocId(selectedDoc.id);
    } else if (allDocs.length > 0 && !activeDocId) {
      setActiveDocId(allDocs[0].id);
    }
  }, [selectedDoc, allDocs, activeDocId]);

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

      if (finalResp.rag_grounded && finalResp.citations.length > 0) {
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

  const currentDocItem = allDocs.find((d) => d.id === activeDocId) || selectedDoc;

  return (
    <div className="bg-white rounded-lg border border-slate-200/90 flex flex-col h-[700px] overflow-hidden">
      {/* 1. Header Toolbar */}
      <div className="p-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2.5 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-teal-50 text-teal-700 border border-teal-200/60 flex items-center justify-center shrink-0">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                Khung Thử Nghiệm Chatbot Lâm Sàng
              </h3>
              <span className="text-2xs font-mono px-1.5 py-0.5 rounded-sm bg-slate-100 text-slate-600 border border-slate-200">
                Logic App Bác Sĩ
              </span>
            </div>
            <p className="text-2xs text-slate-500">
              Kiểm tra trực tiếp độ hoàn chỉnh, trích dẫn số trang và khả năng tổng hợp với API Key thật
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* Role selector */}
          <select
            value={userRole}
            onChange={(e) => setUserRole(e.target.value as 'doctor' | 'pharmacist')}
            className="text-2xs font-medium px-2 py-1 bg-white border border-slate-200 rounded-md text-slate-700 outline-hidden"
          >
            <option value="doctor">Vai trò: Bác sĩ điều trị</option>
            <option value="pharmacist">Vai trò: Dược sĩ lâm sàng</option>
          </select>

          {/* Test Scope Toggle */}
          <div className="flex rounded-md border border-slate-200 bg-white p-0.5 text-2xs font-medium">
            <button
              type="button"
              onClick={() => setTestScope('scoped')}
              className={`px-2 py-0.5 rounded cursor-pointer transition ${
                testScope === 'scoped' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Chỉ tra cứu trong văn bản được chọn"
            >
              Chỉ tài liệu này
            </button>
            <button
              type="button"
              onClick={() => setTestScope('integrated')}
              className={`px-2 py-0.5 rounded cursor-pointer transition ${
                testScope === 'integrated' ? 'bg-teal-700 text-white' : 'text-slate-600 hover:text-slate-900'
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
                setHasVerifiedAnswer(false);
              }}
              className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
              title="Xóa phiên thử nghiệm"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Target Document Picker & Cleanliness Healthcheck Bar */}
      <div className="p-3 bg-white border-b border-slate-100 space-y-2.5">
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-slate-600 min-w-0 flex-1">
            <FileText className="w-3.5 h-3.5 text-teal-600 shrink-0" />
            <span className="font-semibold text-slate-700 shrink-0">Tài liệu test:</span>
            {uploadedFile ? (
              <span className="truncate font-mono text-teal-800 text-2xs bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                [Tệp mới] {uploadedFile.name} ({(uploadedFile.size / 1024).toFixed(0)} KB)
              </span>
            ) : (
              <select
                value={activeDocId}
                onChange={(e) => setActiveDocId(e.target.value)}
                className="text-2xs px-2 py-1 bg-white border border-slate-200 rounded-md text-slate-800 truncate flex-1 max-w-sm"
              >
                {allDocs.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.title} ({doc.filename})
                  </option>
                ))}
              </select>
            )}
          </div>

          <button
            type="button"
            onClick={runAudit}
            disabled={auditLoading}
            className="text-2xs font-medium text-slate-700 hover:text-teal-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2 py-1 rounded cursor-pointer transition shrink-0 flex items-center gap-1"
          >
            <Activity className={`w-3 h-3 ${auditLoading ? 'animate-spin text-teal-600' : ''}`} />
            <span>{auditLoading ? 'Đang quét...' : 'Kiểm định độ sạch AI'}</span>
          </button>
        </div>

        {/* Cleanliness Audit Score & Details */}
        {auditResult && (
          <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200/80 text-xs space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded ${
                    auditResult.status === 'clean'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : auditResult.status === 'warning'
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-rose-100 text-rose-800 border border-rose-300'
                  }`}
                >
                  Độ sạch: {auditResult.cleanliness_score}/100
                </span>
                <span className="text-2xs text-slate-500 font-mono">
                  {auditResult.total_pages} trang · {(auditResult.extracted_chars / 1000).toFixed(1)}k ký tự · {auditResult.avg_chars_per_page} kt/trang
                </span>
              </div>
              <span className="text-2xs text-slate-600">
                {auditResult.status === 'clean' ? '✅ Văn bản sạch, đầy đủ text layer' : '⚠️ Cần lưu ý một số trang scan'}
              </span>
            </div>

            {/* Issues if any */}
            {auditResult.issues && auditResult.issues.length > 0 && (
              <div className="text-2xs text-slate-600 space-y-0.5">
                {auditResult.issues.map((iss, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    <span className="text-slate-400">•</span>
                    <span>{iss}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Golden Questions Chips */}
            {auditResult.golden_questions && auditResult.golden_questions.length > 0 && (
              <div className="pt-1 border-t border-slate-200/60 space-y-1">
                <div className="text-2xs font-semibold text-slate-500 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  <span>Câu hỏi kiểm chứng vàng (Golden Questions do Gemini tạo từ tài liệu):</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {auditResult.golden_questions.map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSendMessage(q)}
                      disabled={isSending}
                      className="text-2xs font-medium text-slate-700 bg-white hover:bg-teal-50 hover:text-teal-800 hover:border-teal-300 border border-slate-200 px-2 py-1 rounded-md text-left transition cursor-pointer max-w-full truncate disabled:opacity-50"
                      title={q}
                    >
                      {idx + 1}. {q}
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
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3.5 bg-slate-50/30">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-2">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div className="text-xs font-semibold text-slate-700">Chưa có câu hỏi kiểm thử nào</div>
            <p className="text-2xs text-slate-500 max-w-sm">
              Nhấp vào một trong các <strong>Câu hỏi kiểm chứng vàng</strong> ở trên hoặc nhập câu hỏi lâm sàng bất kỳ bên dưới để kiểm tra Chatbot.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'bot' && (
                <div className="w-6 h-6 rounded bg-teal-50 text-teal-700 border border-teal-200/60 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-lg p-3 text-xs leading-relaxed space-y-2 ${
                  msg.sender === 'user'
                    ? 'bg-slate-900 text-white font-medium'
                    : 'bg-white border border-slate-200/90 text-slate-800 shadow-2xs'
                }`}
              >
                {/* Message text */}
                <div className="whitespace-pre-wrap font-sans text-xs">
                  {msg.text || (msg.isStreaming ? 'Đang suy luận và trích xuất căn cứ y khoa...' : '')}
                  {msg.isStreaming && (
                    <span className="inline-block w-1.5 h-3.5 bg-teal-600 ml-1 animate-pulse align-middle" />
                  )}
                </div>

                {/* Grounded Citations Box */}
                {msg.sender === 'bot' && msg.citations && msg.citations.length > 0 && (
                  <div className="mt-2.5 pt-2.5 border-t border-slate-100 space-y-1.5">
                    <div className="flex items-center justify-between text-2xs font-semibold text-slate-500">
                      <span className="flex items-center gap-1">
                        <BookOpen className="w-3 h-3 text-teal-600" />
                        <span>Căn cứ &amp; Trích dẫn số trang ({msg.citations.length}):</span>
                      </span>
                      {msg.legalBasis && (
                        <span className="font-mono text-teal-800 bg-teal-50 px-1 py-0.5 rounded border border-teal-200/60">
                          {msg.legalBasis}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-1.5">
                      {msg.citations.map((c, idx) => (
                        <div
                          key={idx}
                          className="p-2 rounded bg-slate-50 border border-slate-200/70 text-2xs space-y-0.5 hover:border-slate-300 transition"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-slate-900 truncate">
                              {c.page_or_section} · {c.title}
                            </span>
                            {currentDocItem && (
                              <button
                                type="button"
                                onClick={() => onOpenPdf(currentDocItem)}
                                className="text-teal-700 hover:text-teal-900 flex items-center gap-0.5 font-medium shrink-0 cursor-pointer"
                              >
                                <span>Xem PDF</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                          <p className="text-slate-600 line-clamp-2 italic font-serif">
                            "{c.snippet}"
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Model & Meta footer */}
                {msg.sender === 'bot' && !msg.isStreaming && (
                  <div className="pt-1 flex items-center justify-between text-3xs font-mono text-slate-400 border-t border-slate-50">
                    <span>{msg.modelName || 'gemini-flash'} ({msg.provider || 'gemini'})</span>
                    <span>{msg.timestamp}</span>
                  </div>
                )}
              </div>

              {msg.sender === 'user' && (
                <div className="w-6 h-6 rounded bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 4. Verification Milestone Banner */}
      {hasVerifiedAnswer && (
        <div className="px-3 py-1.5 bg-emerald-50 border-t border-emerald-200 text-emerald-900 flex items-center justify-between text-2xs">
          <div className="flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Đã xác thực câu trả lời có trích dẫn chuẩn số trang. Tri thức sẵn sàng áp dụng.</span>
          </div>
          {onConfirmIngested && (
            <button
              type="button"
              onClick={onConfirmIngested}
              className="px-2 py-0.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded font-semibold cursor-pointer transition text-2xs"
            >
              Xác nhận Đưa vào CSDL
            </button>
          )}
        </div>
      )}

      {/* 5. Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="p-2.5 bg-white border-t border-slate-200/90 flex items-center gap-2"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Nhập câu hỏi để test chatbot (VD: Điều kiện chỉ định, liều dùng, căn cứ pháp lý...)"
          disabled={isSending}
          className="flex-1 text-xs px-3 py-2 rounded-md border border-slate-200 focus:border-slate-800 outline-hidden bg-slate-50/50 focus:bg-white"
        />
        <button
          type="submit"
          disabled={isSending || !inputText.trim()}
          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition shrink-0"
        >
          {isSending ? (
            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
          <span>Gửi</span>
        </button>
      </form>
    </div>
  );
};
