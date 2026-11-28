import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileText,
  UploadCloud,
  Search,
  Trash2,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Layers,
  FileCheck,
  Bot,
  Plus,
  X,
  Sparkles,
  Power,
  Archive,
} from 'lucide-react';
import {
  fetchKnowledgeDocuments,
  inspectKnowledgePdf,
  uploadKnowledgePdf,
  queryKnowledgeDocuments,
  deleteKnowledgeDocument,
  updateKnowledgeDocumentStatus,
} from '../../services/adminApi';
import { openLocalPdfDocument } from '../../services/localDocumentStorage';
import { KnowledgeChatSandbox } from './DocumentIngestion/KnowledgeChatSandbox';
import type {
  KnowledgeDocumentItem,
  IngestPdfResponse,
  PdfInspectResponse,
  DocumentQueryResultItem,
} from '../../types/admin';

type KnowledgeSubTab = 'catalog' | 'upload' | 'sandbox';

export const DocumentIngestionTab: React.FC = () => {
  const [subTab, setSubTab] = useState<KnowledgeSubTab>('catalog');

  // State danh mục tài liệu
  const [documents, setDocuments] = useState<KnowledgeDocumentItem[]>([]);
  const [loadingDocs, setLoadingDocs] = useState<boolean>(false);
  const [catalogSearch, setCatalogSearch] = useState<string>('');
  const [catalogStatusFilter, setCatalogStatusFilter] = useState<'all' | 'active' | 'staged'>('all');

  // State form upload + Pre-upload auto-inspect
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState<string>('');
  const [legalBasis, setLegalBasis] = useState<string>('');
  const [category, setCategory] = useState<string>('Thông tư Bộ Y tế');
  const [editionYear, setEditionYear] = useState<number>(2026);
  const [docId, setDocId] = useState<string>('');
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadResult, setUploadResult] = useState<IngestPdfResponse | null>(null);
  const [uploadError, setUploadError] = useState<string>('');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [inspecting, setInspecting] = useState<boolean>(false);
  const [inspectData, setInspectData] = useState<PdfInspectResponse | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // State truy vấn sandbox & Chatbot test
  const [queryText, setQueryText] = useState<string>('');
  const [selectedDocFilter, setSelectedDocFilter] = useState<string>('');
  const [querying, setQuerying] = useState<boolean>(false);
  const [queryResults, setQueryResults] = useState<DocumentQueryResultItem[]>([]);
  const [queryError, setQueryError] = useState<string>('');
  const [selectedDocForTest, setSelectedDocForTest] = useState<KnowledgeDocumentItem | null>(null);
  const [sandboxMode, setSandboxMode] = useState<'chatbot' | 'chunks'>('chatbot');

  // State xóa tài liệu
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    setLoadingDocs(true);
    try {
      try {
        localStorage.removeItem('clinical_local_pdf_docs');
      } catch {}
      const docs = await fetchKnowledgeDocuments();
      setDocuments(() => {
        const merged = [...docs];
        if (selectedDocForTest && !merged.some((d) => d.id === selectedDocForTest.id)) {
          merged.unshift(selectedDocForTest);
        }
        return merged;
      });
    } catch (err: unknown) {
      console.error('Lỗi nạp danh sách tài liệu từ máy chủ:', err);
    } finally {
      setLoadingDocs(false);
    }
  }, [selectedDocForTest]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const docStats = useMemo(() => {
    let active = 0;
    let staged = 0;
    documents.forEach((d) => {
      if (d.status === 'active') active++;
      else if (d.status !== 'superseded') staged++;
    });
    return { total: documents.length, active, staged };
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      if (catalogStatusFilter === 'active' && doc.status !== 'active') return false;
      if (catalogStatusFilter === 'staged' && doc.status === 'active') return false;
      if (catalogSearch.trim()) {
        const q = catalogSearch.toLowerCase().trim();
        return (
          (doc.title || '').toLowerCase().includes(q) ||
          (doc.filename || '').toLowerCase().includes(q) ||
          (doc.legal_basis || '').toLowerCase().includes(q) ||
          (doc.category || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [documents, catalogStatusFilter, catalogSearch]);

  const notify = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const handleSelectFile = async (selectedFile: File | null) => {
    if (!selectedFile) return;
    if (!selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setUploadError('Chỉ chấp nhận tệp định dạng .pdf.');
      return;
    }
    setFile(selectedFile);
    setUploadError('');
    setUploadResult(null);
    setInspectData(null);

    const fallbackName = selectedFile.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim();
    if (!title) setTitle(fallbackName);

    setInspecting(true);
    try {
      const inspected = await inspectKnowledgePdf(selectedFile);
      setInspectData(inspected);
      if (inspected.suggested_title) setTitle(inspected.suggested_title);
      if (inspected.suggested_legal_basis) setLegalBasis(inspected.suggested_legal_basis);
      if (inspected.suggested_category) setCategory(inspected.suggested_category);
      if (inspected.suggested_year) setEditionYear(inspected.suggested_year);
    } catch {
      // Fallback nhẹ nếu chưa đăng nhập hoặc offline: giữ tên tệp gợi ý sẵn
      if (!legalBasis) setLegalBasis(fallbackName);
    } finally {
      setInspecting(false);
    }
  };

  const handleQuickStatusChange = async (
    doc: KnowledgeDocumentItem,
    nextStatus: 'active' | 'superseded' | 'staged'
  ) => {
    setStatusUpdatingId(doc.id);
    try {
      await updateKnowledgeDocumentStatus(doc.id, nextStatus, nextStatus === 'active' ? true : undefined);
      await loadDocuments();
      if (nextStatus === 'active') {
        notify(`Đã kích hoạt "${doc.title}" — Chatbot đã đồng bộ tri thức mới & làm mới bộ nhớ đệm.`);
      } else if (nextStatus === 'superseded') {
        notify(`Đã tạm ẩn "${doc.title}" khỏi kết quả tra cứu của Cổng Bác sĩ.`);
      } else {
        notify(`Đã chuyển "${doc.title}" về trạng thái Chờ kiểm duyệt.`);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Không thể cập nhật trạng thái tài liệu.');
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setUploadError('Vui lòng chọn một tệp PDF.');
      return;
    }
    if (!title.trim() || !legalBasis.trim()) {
      setUploadError('Vui lòng nhập đầy đủ tiêu đề và căn cứ pháp lý.');
      return;
    }

    setUploading(true);
    setUploadError('');
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title.trim());
      formData.append('legal_basis', legalBasis.trim());
      formData.append('category', category.trim());
      formData.append('edition_year', String(editionYear));
      if (docId.trim()) {
        formData.append('doc_id', docId.trim());
      }
      const res = await uploadKnowledgePdf(formData);
      setUploadResult(res);

      if (res && res.doc_id) {
        const newDocItem: KnowledgeDocumentItem = {
          id: res.doc_id,
          title: res.title || title.trim(),
          legal_basis: res.legal_basis || legalBasis.trim(),
          category: category.trim(),
          edition_year: Number(editionYear) || 2026,
          filename: res.filename,
          public_url: res.public_url,
          sha256: res.sha256,
          bytes: res.file_bytes,
          status: 'staged',
          verified: false,
        };
        setSelectedDocForTest(newDocItem);
        setDocuments((prev) => [newDocItem, ...prev.filter((d) => d.id !== newDocItem.id)]);
        setSandboxMode('chatbot');
        setSubTab('sandbox');
        notify(`Đã nạp thành công "${newDocItem.title}" (${res.extracted_chunks_count} đoạn · ${res.indexed_vectors_count} vectors). Hãy kiểm thử trên Sandbox trước khi kích hoạt.`);
      }

      setFile(null);
      setInspectData(null);
      await loadDocuments();
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Lỗi khi xử lý nạp tài liệu.');
    } finally {
      setUploading(false);
    }
  };

  const handleQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryText.trim()) return;

    setQuerying(true);
    setQueryError('');
    setQueryResults([]);

    try {
      const res = await queryKnowledgeDocuments(queryText.trim(), selectedDocFilter || undefined, 5);
      setQueryResults(res.results || []);
      if (!res.results || res.results.length === 0) {
        setQueryError('Không tìm thấy trích dẫn phù hợp trong tài liệu đã chọn.');
      }
    } catch (err: unknown) {
      setQueryError(err instanceof Error ? err.message : 'Lỗi khi truy vấn tài liệu.');
    } finally {
      setQuerying(false);
    }
  };

  const handleDelete = async (targetDocId: string, docTitle: string) => {
    const confirmed = window.confirm(
      `Bạn có chắc chắn muốn xóa tài liệu:\n"${docTitle}"?\n\nTài liệu sẽ bị xóa khỏi chỉ mục tìm kiếm và kho văn bản bệnh viện.`
    );
    if (!confirmed) return;

    setDeletingId(targetDocId);
    try {
      await deleteKnowledgeDocument(targetDocId);
      await loadDocuments();
      if (selectedDocFilter === targetDocId) setSelectedDocFilter('');
      if (selectedDocForTest?.id === targetDocId) setSelectedDocForTest(null);
      setQueryResults((prev) => prev.filter((r) => !r.chunk_id.startsWith(`${targetDocId}_`)));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Lỗi khi xóa tài liệu.');
    } finally {
      setDeletingId(null);
    }
  };

  const openDocumentInSandbox = (doc: KnowledgeDocumentItem) => {
    setSelectedDocForTest(doc);
    setSandboxMode('chatbot');
    setSubTab('sandbox');
  };

  const renderStatusBadge = (doc: KnowledgeDocumentItem) => {
    if (doc.status === 'active') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-2xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/70 whitespace-nowrap">
          <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
          Đang áp dụng
        </span>
      );
    }
    if (doc.status === 'superseded') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-2xs font-medium bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap">
          Hết hiệu lực
        </span>
      );
    }
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-md text-2xs font-semibold border whitespace-nowrap ${
          doc.verified
            ? 'bg-teal-50 text-teal-800 border-teal-200'
            : 'bg-amber-50 text-amber-800 border-amber-200'
        }`}
        title={doc.verified ? 'Đã kiểm thử thành công, sẵn sàng kích hoạt' : 'Chưa kiểm thử Chatbot'}
      >
        {doc.verified ? 'Chờ kích hoạt' : 'Chờ duyệt'}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {toastMsg && (
        <div className="fixed top-16 right-6 z-50 px-4 py-3 bg-teal-900 text-white rounded-xl shadow-lg border border-teal-700/80 flex items-center gap-2.5 text-xs font-medium max-w-md animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Sub-tab Underline Switcher (Main App airy scale) */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setSubTab('catalog')}
            className={`px-3.5 py-2.5 text-sm font-medium transition-colors cursor-pointer inline-flex items-center gap-2 whitespace-nowrap border-b-2 -mb-px ${
              subTab === 'catalog'
                ? 'border-teal-700 text-teal-800 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Kho văn bản PDF</span>
            <span className="text-2xs font-mono px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600">
              {docStats.total}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('upload')}
            className={`px-3.5 py-2.5 text-sm font-medium transition-colors cursor-pointer inline-flex items-center gap-2 whitespace-nowrap border-b-2 -mb-px ${
              subTab === 'upload'
                ? 'border-teal-700 text-teal-800 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            <span>Nạp tài liệu mới</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('sandbox')}
            className={`px-3.5 py-2.5 text-sm font-medium transition-colors cursor-pointer inline-flex items-center gap-2 whitespace-nowrap border-b-2 -mb-px ${
              subTab === 'sandbox'
                ? 'border-teal-700 text-teal-800 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span>Sandbox kiểm thử AI</span>
          </button>
        </div>

        <div className="hidden md:flex items-center gap-3 pb-2 text-2xs font-mono text-slate-500 shrink-0">
          <span>
            Áp dụng: <strong className="text-emerald-700">{docStats.active}</strong>
          </span>
          <span className="text-slate-300">·</span>
          <span>
            Chờ duyệt: <strong className="text-amber-700">{docStats.staged}</strong>
          </span>
        </div>
      </div>

      {/* TAB 1: KHO VĂN BẢN PDF (Full-width clean catalog) */}
      {subTab === 'catalog' && (
        <section className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden flex flex-col">
          {/* Header & Primary Action */}
          <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 tracking-tight">
                Danh mục văn bản tri thức &amp; Quy chế y tế
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Toàn bộ tài liệu PDF đã lập chỉ mục FTS5 và Vector cho hệ thống trợ lý lâm sàng
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={loadDocuments}
                disabled={loadingDocs}
                className="h-9 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium inline-flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingDocs ? 'animate-spin' : ''}`} />
                <span>Làm mới</span>
              </button>
              <button
                type="button"
                onClick={() => setSubTab('upload')}
                className="h-9 px-3.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium inline-flex items-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Nạp PDF mới</span>
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="px-5 sm:px-6 py-3 bg-slate-50/70 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-2.5">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Tìm tên văn bản, số thông tư, tệp PDF..."
                className="w-full h-9 pl-9 pr-8 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-600 transition"
              />
              {catalogSearch && (
                <button
                  type="button"
                  onClick={() => setCatalogSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                  aria-label="Xóa tìm kiếm"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 text-2xs">
              {(
                [
                  ['all', `Tất cả (${docStats.total})`],
                  ['active', `Đang áp dụng (${docStats.active})`],
                  ['staged', `Chờ duyệt (${docStats.staged})`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCatalogStatusFilter(key)}
                  className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer whitespace-nowrap ${
                    catalogStatusFilter === key
                      ? 'bg-teal-50 text-teal-800 font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Desktop Full-Width Table (zero vertical badge squishing, zero clipping) */}
          {filteredDocuments.length === 0 ? (
            <div className="py-12 px-4 text-center text-slate-500 text-xs">
              {loadingDocs
                ? 'Đang tải danh mục tài liệu...'
                : catalogSearch
                ? 'Không tìm thấy tài liệu khớp từ khóa.'
                : 'Chưa có tài liệu nào trong kho. Nhấn "Nạp PDF mới" để thêm tài liệu đầu tiên.'}
            </div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse table-fixed">
                  <thead className="bg-slate-50/70 text-slate-500 uppercase tracking-wider text-2xs border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 pl-4 sm:pl-5 pr-3 font-semibold w-[34%]">Tên văn bản / Tệp PDF</th>
                      <th className="py-2.5 px-2.5 font-semibold w-[13%] whitespace-nowrap">Trạng thái</th>
                      <th className="py-2.5 px-2.5 font-semibold w-[19%] whitespace-nowrap">Căn cứ / Phân loại</th>
                      <th className="py-2.5 px-2 font-semibold w-[6%] text-right whitespace-nowrap">Năm</th>
                      <th className="py-2.5 px-2 font-semibold w-[9%] text-right whitespace-nowrap">Dung lượng</th>
                      <th className="py-2.5 pl-2 pr-4 sm:pr-5 font-semibold w-[19%] text-right whitespace-nowrap">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredDocuments.map((doc) => (
                      <tr key={doc.id} className="hover:bg-teal-50/40 transition-colors">
                        <td className="py-3 pl-4 sm:pl-5 pr-3">
                          <div className="font-semibold text-slate-900 leading-snug truncate" title={doc.title}>
                            {doc.title}
                          </div>
                          <div className="text-2xs text-slate-500 font-mono mt-0.5 truncate" title={doc.filename}>
                            {doc.filename}
                            {doc.total_pages ? ` · ${doc.total_pages} trang` : ''}
                            {doc.chunks_count ? ` · ${doc.chunks_count} đoạn` : ''}
                            {doc.sha256 ? ` · ${doc.sha256.substring(0, 8)}` : ''}
                          </div>
                        </td>
                        <td className="py-3 px-2.5 whitespace-nowrap">{renderStatusBadge(doc)}</td>
                        <td className="py-3 px-2.5">
                          <div className="text-xs text-slate-700 truncate" title={doc.legal_basis}>
                            {doc.legal_basis || '—'}
                          </div>
                          <div className="text-2xs text-slate-500 truncate mt-0.5">
                            {doc.category || 'Văn bản y tế'}
                            {doc.is_local ? ' · Cục bộ' : ''}
                          </div>
                        </td>
                        <td className="py-3 px-2 text-right font-mono text-slate-600 tabular-nums whitespace-nowrap">
                          {doc.edition_year || 2026}
                        </td>
                        <td className="py-3 px-2 text-right font-mono text-slate-500 tabular-nums whitespace-nowrap">
                          {doc.bytes ? `${(doc.bytes / 1024).toFixed(0)} KB` : '—'}
                        </td>
                        <td className="py-3 pl-2 pr-4 sm:pr-5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            {doc.status === 'staged' && doc.verified && (
                              <button
                                type="button"
                                onClick={() => handleQuickStatusChange(doc, 'active')}
                                disabled={statusUpdatingId === doc.id}
                                className="h-7 px-2.5 rounded-md text-white bg-teal-700 hover:bg-teal-800 text-2xs font-semibold transition cursor-pointer inline-flex items-center gap-1 disabled:opacity-50"
                                title="Kích hoạt vào kho tri thức Chatbot toàn viện"
                              >
                                <Power className="w-3 h-3" />
                                <span>Kích hoạt</span>
                              </button>
                            )}

                            {doc.status === 'superseded' && (
                              <button
                                type="button"
                                onClick={() => handleQuickStatusChange(doc, 'active')}
                                disabled={statusUpdatingId === doc.id}
                                className="h-7 px-2.5 rounded-md text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-2xs font-semibold transition cursor-pointer inline-flex items-center gap-1 disabled:opacity-50"
                                title="Khôi phục hiệu lực vào Chatbot toàn viện"
                              >
                                <Power className="w-3 h-3" />
                                <span>Áp dụng lại</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => openDocumentInSandbox(doc)}
                              className="h-7 px-2.5 rounded-md text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200/80 text-2xs font-semibold transition cursor-pointer inline-flex items-center gap-1"
                              title="Mở trong Sandbox kiểm thử Chatbot"
                            >
                              <Bot className="w-3 h-3 text-teal-700" />
                              <span>Kiểm thử</span>
                            </button>

                            {doc.status === 'active' && (
                              <button
                                type="button"
                                onClick={() => handleQuickStatusChange(doc, 'superseded')}
                                disabled={statusUpdatingId === doc.id}
                                className="h-7 w-7 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-amber-700 hover:bg-amber-50 transition cursor-pointer disabled:opacity-50"
                                title="Tạm ẩn (Hết hiệu lực) khỏi Chatbot mà vẫn giữ lịch sử"
                                aria-label="Tạm ẩn tài liệu"
                              >
                                <Archive className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <a
                              href={doc.public_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="h-7 w-7 inline-flex items-center justify-center rounded-md text-slate-500 hover:text-teal-800 hover:bg-slate-100 transition"
                              title="Mở xem tệp PDF"
                              aria-label="Mở xem tệp PDF"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>

                            <button
                              type="button"
                              onClick={() => handleDelete(doc.id, doc.title)}
                              disabled={deletingId === doc.id}
                              className="h-7 w-7 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-rose-700 hover:bg-rose-50 transition cursor-pointer disabled:opacity-50"
                              title="Xóa tài liệu và giải phóng chỉ mục"
                              aria-label="Xóa tài liệu"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List */}
              <div className="md:hidden divide-y divide-slate-100">
                {filteredDocuments.map((doc) => (
                  <div key={doc.id} className="p-3.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-900 leading-snug">{doc.title}</div>
                        <div className="text-2xs font-mono text-slate-500 truncate mt-0.5">{doc.filename}</div>
                      </div>
                      {renderStatusBadge(doc)}
                    </div>
                    <div className="flex items-center justify-between text-2xs text-slate-500">
                      <span className="truncate pr-2">{doc.legal_basis || doc.category}</span>
                      <span className="font-mono shrink-0">
                        {doc.edition_year || 2026} · {doc.bytes ? `${(doc.bytes / 1024).toFixed(0)} KB` : '—'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      {doc.status === 'staged' && doc.verified && (
                        <button
                          type="button"
                          onClick={() => handleQuickStatusChange(doc, 'active')}
                          disabled={statusUpdatingId === doc.id}
                          className="h-7 px-2.5 rounded-md text-white bg-teal-700 hover:bg-teal-800 text-2xs font-semibold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <Power className="w-3 h-3" />
                          Kích hoạt
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openDocumentInSandbox(doc)}
                        className="h-7 px-2.5 rounded-md text-teal-800 bg-teal-50 border border-teal-200/80 text-2xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Bot className="w-3 h-3" />
                        Kiểm thử AI
                      </button>
                      <a
                        href={doc.public_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-7 px-2.5 rounded-md text-slate-700 bg-slate-50 border border-slate-200 text-2xs font-medium inline-flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Xem PDF
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDelete(doc.id, doc.title)}
                        disabled={deletingId === doc.id}
                        className="ml-auto h-7 w-7 inline-flex items-center justify-center rounded-md text-rose-500 hover:bg-rose-50 cursor-pointer"
                        aria-label="Xóa tài liệu"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {/* TAB 2: NẠP TÀI LIỆU PDF MỚI (Full-width 2-column airy layout, zero dead space) */}
      {subTab === 'upload' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          {/* Left 8/12: Form nạp tài liệu PDF */}
          <section className="xl:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="px-5 sm:px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2 tracking-tight">
                <UploadCloud className="w-4 h-4 text-teal-700" />
                <span>Nạp tài liệu PDF vào Khung thử nghiệm (Staged)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Văn bản nạp lên sẽ được trích xuất số trang, lập chỉ mục tìm kiếm và chuyển sang trạng thái{' '}
                <strong className="text-slate-700">Chờ kiểm duyệt</strong> để kiểm thử trên Sandbox trước khi áp dụng toàn viện.
              </p>
            </div>

            <form onSubmit={handleUpload} className="p-5 sm:p-6 space-y-5">
              {/* Drag & Drop PDF Dropzone + Instant Auto-Inspect */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Tệp tài liệu PDF <span className="text-rose-500">*</span>
                </label>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const dropped = e.dataTransfer.files?.[0] || null;
                    void handleSelectFile(dropped);
                  }}
                  className={`relative rounded-2xl border-2 border-dashed p-6 text-center transition ${
                    isDragging
                      ? 'border-teal-600 bg-teal-50/70'
                      : file
                      ? 'border-teal-300 bg-teal-50/30'
                      : 'border-slate-300 hover:border-teal-500 bg-slate-50/60'
                  }`}
                >
                  <input
                    id="pdf-upload-input"
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      void handleSelectFile(f);
                    }}
                    className="sr-only"
                  />
                  <label htmlFor="pdf-upload-input" className="cursor-pointer flex flex-col items-center gap-2">
                    <span className="w-11 h-11 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center text-teal-700">
                      {inspecting ? (
                        <RefreshCw className="w-5 h-5 animate-spin" />
                      ) : file ? (
                        <FileCheck className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <UploadCloud className="w-5 h-5" />
                      )}
                    </span>
                    {file ? (
                      <>
                        <div className="text-sm font-semibold text-slate-900 break-all">{file.name}</div>
                        <div className="text-xs text-slate-500 font-mono">
                          {(file.size / 1024).toFixed(1)} KB · Nhấn để đổi tệp PDF khác hoặc kéo thả vào đây
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-sm font-semibold text-slate-900">
                          Kéo thả tệp PDF vào đây, hoặc <span className="text-teal-700 underline underline-offset-2">chọn từ máy tính</span>
                        </div>
                        <div className="text-xs text-slate-500">
                          Hỗ trợ PDF văn bản chuẩn &amp; PDF scan (tự động OCR tối đa 10 trang) · Tối đa 50 MB
                        </div>
                      </>
                    )}
                  </label>
                </div>

                {/* Instant Pre-Upload Health & Auto-Metadata Inspection Banner */}
                {inspecting && (
                  <div className="mt-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 text-teal-700 animate-spin shrink-0" />
                    <span>Đang quét cấu trúc PDF, kiểm tra trùng lặp SHA256 và tự điền thông tin văn bản...</span>
                  </div>
                )}

                {inspectData && !inspecting && (
                  <div className="mt-3 p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-semibold text-slate-800">
                        <Sparkles className="w-4 h-4 text-teal-700 shrink-0" />
                        <span>Kết quả kiểm tra nhanh trước khi nạp</span>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-semibold border ${
                          inspectData.cleanliness_score >= 80
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : inspectData.cleanliness_score >= 50
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        Độ sạch: {inspectData.cleanliness_score}/100
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-600 font-mono text-2xs">
                      <span>Số trang: <strong className="text-slate-900">{inspectData.total_pages}</strong></span>
                      <span>Mật độ chữ: <strong className="text-slate-900">{inspectData.avg_chars_per_page}</strong> ký tự/trang</span>
                      <span>SHA256: <strong className="text-slate-900">{inspectData.sha256.slice(0, 12)}</strong></span>
                    </div>

                    {inspectData.needs_ocr && (
                      <div className="flex items-start gap-2 text-amber-800 bg-amber-50 border border-amber-200/80 rounded-lg px-3 py-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <span>
                          Phát hiện <strong>{inspectData.empty_pages} trang ảnh scan</strong> chưa có lớp chữ — hệ thống sẽ tự động chạy Vision OCR khi nạp.
                        </span>
                      </div>
                    )}

                    {inspectData.is_duplicate && (
                      <div className="flex items-start gap-2 text-rose-800 bg-rose-50 border border-rose-200/80 rounded-lg px-3 py-2">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <span>
                          Tệp PDF này trùng SHA256 với tài liệu đang có: <strong>{inspectData.duplicate_title || inspectData.duplicate_doc_id}</strong>. Nếu tiếp tục nạp sẽ cập nhật lại chỉ mục.
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {uploadResult && !file && (
                  <div className="mt-2.5 p-3 bg-teal-50 border border-teal-200/90 rounded-xl text-teal-900 text-xs flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                      <span className="truncate">
                        Đã nạp thành công: <strong>{uploadResult.filename}</strong>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setUploadResult(null);
                        setInspectData(null);
                        setTitle('');
                        setLegalBasis('');
                        setDocId('');
                      }}
                      className="text-xs text-teal-700 hover:text-teal-900 font-semibold underline shrink-0 cursor-pointer"
                    >
                      Nạp tệp khác
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Tiêu đề văn bản <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Thông tư 26/2025/TT-BYT Kê đơn thuốc điện tử"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full h-9 text-xs px-3 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:border-teal-600 focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Căn cứ pháp lý <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Thông tư 26/2025/TT-BYT"
                    value={legalBasis}
                    onChange={(e) => setLegalBasis(e.target.value)}
                    className="w-full h-9 text-xs px-3 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:border-teal-600 focus:outline-none transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Phân loại</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full h-9 text-xs px-3 rounded-xl border border-slate-200 focus:border-teal-600 focus:outline-none bg-white cursor-pointer"
                  >
                    <option value="Thông tư Bộ Y tế">Thông tư Bộ Y tế</option>
                    <option value="Quyết định Bộ Y tế">Quyết định Bộ Y tế</option>
                    <option value="Dược thư quốc gia">Dược thư quốc gia</option>
                    <option value="Phác đồ điều trị">Phác đồ điều trị</option>
                    <option value="Cấp cứu & Sốc phản vệ">Cấp cứu &amp; Phản vệ</option>
                    <option value="Quy chuẩn bệnh viện">Quy chuẩn BV</option>
                    <option value="Khác">Văn bản khác</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Năm hiệu lực</label>
                  <input
                    type="number"
                    value={editionYear}
                    onChange={(e) => setEditionYear(parseInt(e.target.value) || 2026)}
                    className="w-full h-9 text-xs px-3 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:border-teal-600 focus:outline-none font-mono transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Mã định danh (tùy chọn)
                  </label>
                  <input
                    type="text"
                    placeholder="Tự sinh từ tên tệp"
                    value={docId}
                    onChange={(e) => setDocId(e.target.value)}
                    className="w-full h-9 text-xs px-3 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:border-teal-600 focus:outline-none font-mono transition"
                  />
                </div>
              </div>

              {uploadError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{uploadError}</span>
                </div>
              )}

              {uploadResult && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Nạp và lập chỉ mục thành công!</span>
                  </div>
                  <div className="text-2xs text-emerald-800 font-mono">
                    Mã: {uploadResult.doc_id} · {uploadResult.total_pages} trang · {uploadResult.extracted_chunks_count} đoạn ·{' '}
                    {uploadResult.indexed_vectors_count} vectors
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSubTab('catalog')}
                  className="h-9 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition cursor-pointer"
                >
                  Quay lại danh mục
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="h-9 px-4 rounded-xl text-white font-semibold text-xs transition inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-teal-700 hover:bg-teal-800 active:scale-[0.98]"
                >
                  {uploading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang bóc tách &amp; lập chỉ mục...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Tải lên &amp; Mở Sandbox kiểm thử</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>

          {/* Right 4/12: Quy trình kiểm duyệt & Tiêu chuẩn PDF */}
          <aside className="xl:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 sm:p-6 space-y-5">
            <div>
              <h3 className="text-base font-semibold text-slate-900 tracking-tight">
                Quy trình kiểm duyệt tri thức AI
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Mọi văn bản mới đều đi qua 3 bước cô lập trước khi hiển thị cho bác sĩ điều trị.
              </p>
            </div>

            <ol className="space-y-4">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-teal-50 border border-teal-200 text-teal-800 font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <div>
                  <div className="text-xs font-semibold text-slate-900">Nạp &amp; Lập chỉ mục (Staged)</div>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    Hệ thống tự tách trang, tạo vector tìm kiếm và giữ ở vùng chờ kiểm duyệt (chưa ảnh hưởng Cổng Bác sĩ).
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-sky-50 border border-sky-200 text-sky-800 font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <div>
                  <div className="text-xs font-semibold text-slate-900">Hỏi đáp đối chứng trên Sandbox</div>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    Kiểm tra độ chính xác trích dẫn số trang và câu trả lời của AI trực tiếp với văn bản gốc.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <div>
                  <div className="text-xs font-semibold text-slate-900">Phát hành toàn viện (Published)</div>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    Duyệt phát hành từ Kho văn bản để kích hoạt tra cứu chính thức trên ứng dụng Clinical Ward.
                  </p>
                </div>
              </li>
            </ol>

            <div className="pt-4 border-t border-slate-100 text-xs text-slate-500 space-y-1.5">
              <div className="font-semibold text-slate-700">Lưu ý định dạng khuyến nghị</div>
              <p className="leading-relaxed">
                Ưu tiên tệp PDF có lớp văn bản chuẩn (searchable PDF), đặt rõ số hiệu Thông tư / Quyết định để AI trích dẫn chính xác căn cứ pháp lý.
              </p>
            </div>
          </aside>
        </div>
      )}

      {/* TAB 3: SANDBOX KIỂM THỬ AI (Full-width workspace, zero overlap) */}
      {subTab === 'sandbox' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setSandboxMode('chatbot')}
                className={`px-3 py-1.5 rounded-md font-medium text-xs inline-flex items-center gap-1.5 transition cursor-pointer ${
                  sandboxMode === 'chatbot'
                    ? 'bg-teal-700 text-white font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Bot className="w-3.5 h-3.5" />
                <span>Chatbot lâm sàng (Trích dẫn trang)</span>
              </button>

              <button
                type="button"
                onClick={() => setSandboxMode('chunks')}
                className={`px-3 py-1.5 rounded-md font-medium text-xs inline-flex items-center gap-1.5 transition cursor-pointer ${
                  sandboxMode === 'chunks'
                    ? 'bg-teal-700 text-white font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Soi đoạn trích xuất (RRF / BM25)</span>
              </button>
            </div>
          </div>

          {sandboxMode === 'chatbot' ? (
            <KnowledgeChatSandbox
              selectedDoc={selectedDocForTest}
              uploadedFile={file}
              allDocs={documents}
              onOpenPdf={async (doc, page) => {
                if (doc.is_local) {
                  await openLocalPdfDocument(doc.id);
                } else {
                  const targetUrl = page ? `${doc.public_url}#page=${page}` : doc.public_url;
                  window.open(targetUrl, '_blank');
                }
              }}
              onStatusChange={async () => {
                await loadDocuments();
              }}
            />
          ) : (
            <section className="bg-white rounded-xl border border-slate-200/90 p-4 sm:p-5 space-y-4">
              <div className="pb-3 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-900">
                  Kiểm tra truy xuất đoạn văn bản (Hybrid RRF: BM25 + Vector)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Đối chiếu chính xác đoạn nguồn và số trang được truy xuất trước khi đưa vào tổng hợp AI
                </p>
              </div>

              <form onSubmit={handleQuery} className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="Nhập câu hỏi kiểm thử (VD: Liều Adrenalin cấp cứu phản vệ, CrCl suy thận...)"
                  value={queryText}
                  onChange={(e) => setQueryText(e.target.value)}
                  className="flex-1 h-9 text-xs px-3 rounded-lg border border-slate-200 focus:border-teal-600 focus:outline-none"
                />

                <select
                  value={selectedDocFilter}
                  onChange={(e) => setSelectedDocFilter(e.target.value)}
                  className="sm:w-64 h-9 text-xs px-2.5 rounded-lg border border-slate-200 focus:border-teal-600 focus:outline-none bg-white truncate"
                >
                  <option value="">Tất cả tài liệu</option>
                  {documents.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title}
                    </option>
                  ))}
                </select>

                <button
                  type="submit"
                  disabled={querying || !queryText.trim()}
                  className="h-9 px-4 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs transition shrink-0 inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {querying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  <span>Truy vấn</span>
                </button>
              </form>

              {queryError && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                  {queryError}
                </div>
              )}

              {queryResults.length > 0 && (
                <div className="space-y-2.5">
                  <div className="text-2xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                    <span>Kết quả truy xuất (Top {queryResults.length})</span>
                    <span className="font-mono font-normal">RRF Fusion k=60</span>
                  </div>

                  <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                    {queryResults.map((item, idx) => (
                      <div
                        key={item.chunk_id || idx}
                        className="p-3.5 rounded-lg border border-slate-200/90 bg-slate-50/60 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono text-2xs text-slate-500 font-semibold shrink-0">
                              #{idx + 1}
                            </span>
                            <span className="text-xs font-semibold text-slate-900 truncate">{item.title}</span>
                          </div>
                          <span className="font-mono text-2xs text-slate-500 shrink-0">{item.page_or_section}</span>
                        </div>

                        <p className="text-xs text-slate-700 line-clamp-3 leading-relaxed">
                          &quot;{item.content}&quot;
                        </p>

                        <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/70 text-2xs text-slate-500">
                          <span className="truncate">Căn cứ: {item.legal_basis}</span>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="font-mono font-medium text-slate-700">Độ khớp: {item.score}%</span>
                            <a
                              href={`/api/v1/pdf/${encodeURIComponent(item.source_doc)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-teal-700 hover:text-teal-900 font-semibold"
                            >
                              <span>Xem PDF</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
};
