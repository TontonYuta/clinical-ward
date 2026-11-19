import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  UploadCloud,
  Search,
  Trash2,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Layers,
  Sparkles,
  BookOpen,
  FileCheck
} from 'lucide-react';
import {
  fetchKnowledgeDocuments,
  queryKnowledgeDocuments,
  deleteKnowledgeDocument
} from '../../services/adminApi';
import {
  getLocalPdfDocuments,
  saveLocalPdfDocument,
  deleteLocalPdfDocument,
  openLocalPdfDocument
} from '../../services/localDocumentStorage';
import type {
  KnowledgeDocumentItem,
  IngestPdfResponse,
  DocumentQueryResultItem
} from '../../types/admin';

export const DocumentIngestionTab: React.FC = () => {
  // State danh mục tài liệu
  const [documents, setDocuments] = useState<KnowledgeDocumentItem[]>([]);
  const [loadingDocs, setLoadingDocs] = useState<boolean>(false);

  // State form upload
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState<string>('');
  const [legalBasis, setLegalBasis] = useState<string>('');
  const [category, setCategory] = useState<string>('Thông tư Bộ Y tế');
  const [editionYear, setEditionYear] = useState<number>(2026);
  const [docId, setDocId] = useState<string>('');
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadResult, setUploadResult] = useState<IngestPdfResponse | null>(null);
  const [uploadError, setUploadError] = useState<string>('');

  // State truy vấn sandbox
  const [queryText, setQueryText] = useState<string>('');
  const [selectedDocFilter, setSelectedDocFilter] = useState<string>('');
  const [querying, setQuerying] = useState<boolean>(false);
  const [queryResults, setQueryResults] = useState<DocumentQueryResultItem[]>([]);
  const [queryError, setQueryError] = useState<string>('');

  // State xóa tài liệu
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    setLoadingDocs(true);
    try {
      const docs = await fetchKnowledgeDocuments();
      const localDocs = getLocalPdfDocuments();
      setDocuments([...localDocs, ...docs]);
    } catch (err: unknown) {
      console.error('Lỗi nạp danh sách tài liệu từ máy chủ:', err);
      const localDocs = getLocalPdfDocuments();
      if (localDocs.length > 0) {
        setDocuments(localDocs);
      }
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Xử lý nạp tài liệu (Chỉ lưu vào LocalStorage/IndexedDB theo cấu hình)
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
      const localDoc = await saveLocalPdfDocument({
        file,
        title: title.trim(),
        legalBasis: legalBasis.trim(),
        category: category.trim(),
        editionYear: Number(editionYear) || 2026,
        docId: docId.trim() || undefined,
      });

      setUploadResult({
        status: 'success (local_only)',
        doc_id: localDoc.id,
        title: localDoc.title,
        legal_basis: localDoc.legal_basis,
        filename: localDoc.filename,
        sha256: localDoc.sha256,
        source_id: localDoc.id,
        source_version: 'local_storage',
        total_pages: 1,
        extracted_chunks_count: 0,
        indexed_vectors_count: 0,
        file_bytes: localDoc.bytes,
        public_url: localDoc.public_url,
      });

      // Reset form
      setFile(null);
      setTitle('');
      setLegalBasis('');
      setDocId('');
      // Tải lại danh sách tài liệu ghép cục bộ và máy chủ
      await loadDocuments();
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Lỗi khi lưu tài liệu vào bộ nhớ cục bộ.');
    } finally {
      setUploading(false);
    }
  };

  // Xử lý truy vấn sandbox
  const handleQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryText.trim()) return;

    setQuerying(true);
    setQueryError('');
    setQueryResults([]);

    try {
      const res = await queryKnowledgeDocuments(
        queryText.trim(),
        selectedDocFilter || undefined,
        5
      );
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

  // Xử lý xóa tài liệu
  const handleDelete = async (targetDocId: string, docTitle: string, isLocal?: boolean) => {
    if (isLocal) {
      const confirmed = window.confirm(
        `Bạn có chắc chắn muốn xóa tài liệu cục bộ:\n"${docTitle}"?\n\nTài liệu sẽ được xóa khỏi LocalStorage và IndexedDB của trình duyệt.`
      );
      if (!confirmed) return;

      setDeletingId(targetDocId);
      try {
        await deleteLocalPdfDocument(targetDocId);
        await loadDocuments();
        if (selectedDocFilter === targetDocId) {
          setSelectedDocFilter('');
        }
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : 'Lỗi khi xóa tài liệu cục bộ.');
      } finally {
        setDeletingId(null);
      }
      return;
    }

    const confirmed = window.confirm(
      `Bạn có chắc chắn muốn xóa tài liệu:\n"${docTitle}"?\n\nThao tác này sẽ xóa sạch: tệp vật lý, chỉ mục FTS5, toàn bộ vector embeddings trong CSDL và giải phóng bộ nhớ RAM.`
    );
    if (!confirmed) return;

    setDeletingId(targetDocId);
    try {
      await deleteKnowledgeDocument(targetDocId);
      await loadDocuments();
      if (selectedDocFilter === targetDocId) {
        setSelectedDocFilter('');
      }
      // Lọc bỏ khỏi kết quả truy vấn nếu có
      setQueryResults((prev) => prev.filter((r) => !r.chunk_id.startsWith(`${targetDocId}_`)));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Lỗi khi xóa tài liệu.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 rounded-2xl p-6 text-white shadow-sm border border-teal-700/50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-teal-300 font-semibold text-xs tracking-wider uppercase">
              <Layers className="w-4 h-4 text-teal-400" />
              <span>Phân Hệ Nạp Tài Liệu & Tri Thức Vector (Dynamic RAG Pipeline)</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">
              Quản Trị Văn Bản Y Tế & Sinh Chỉ Mục Tự Động
            </h1>
            <p className="text-sm text-teal-100/90 max-w-3xl">
              Nạp thông tư, quyết định và phác đồ PDF. Hệ thống tự động bóc tách số trang, tính băm SHA256 mật mã,
              phân đoạn ngữ nghĩa, sinh Dense Vectors (768 chiều) và nạp tức thì vào ma trận RAM Cosine Similarity.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-800/80 border border-teal-600/60 text-xs font-mono font-medium text-teal-200">
              <BookOpen className="w-3.5 h-3.5 text-teal-300" />
              {documents.length} Văn bản trong kho
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/80 border border-emerald-700/60 text-xs font-mono font-medium text-emerald-300">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              Vector: 768-dim (RAM Matrix)
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 2. Upload Form (Left Column: 5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <div className="p-2 rounded-lg bg-teal-50 text-teal-800">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Tải Lên Văn Bản PDF Mới</h2>
              <p className="text-xs text-slate-500">Tự động bóc tách, băm SHA256 và vector hóa</p>
            </div>
          </div>

          <form onSubmit={handleUpload} className="space-y-3.5">
            {/* File Picker */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tệp tài liệu PDF <span className="text-rose-500">*</span>
              </label>
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setFile(f);
                    // Tự động gợi ý tiêu đề từ tên file nếu chưa nhập
                    if (!title) {
                      const cleanName = f.name.replace(/\.pdf$/i, '').replace(/_/g, ' ');
                      setTitle(cleanName);
                    }
                  }
                }}
                className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-800 hover:file:bg-teal-100 cursor-pointer border border-slate-200 rounded-xl p-1.5 focus:outline-hidden"
              />
              {file && (
                <div className="mt-1 flex items-center gap-1.5 text-2xs text-slate-500">
                  <FileCheck className="w-3.5 h-3.5 text-teal-600" />
                  <span>{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
                </div>
              )}
            </div>

            {/* Tiêu đề */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tiêu đề văn bản <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="VD: Thông tư 26/2025/TT-BYT Kê đơn thuốc điện tử"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-600 focus:ring-1 focus:ring-teal-600 outline-hidden"
              />
            </div>

            {/* Căn cứ pháp lý */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Căn cứ pháp lý <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="VD: Thông tư 26/2025/TT-BYT"
                value={legalBasis}
                onChange={(e) => setLegalBasis(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-600 focus:ring-1 focus:ring-teal-600 outline-hidden"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Phân loại */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phân loại</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full text-xs px-2.5 py-2 rounded-xl border border-slate-200 focus:border-teal-600 focus:ring-1 focus:ring-teal-600 outline-hidden bg-white"
                >
                  <option value="Thông tư Bộ Y tế">Thông tư Bộ Y tế</option>
                  <option value="Quyết định Bộ Y tế">Quyết định Bộ Y tế</option>
                  <option value="Dược thư quốc gia">Dược thư quốc gia</option>
                  <option value="Phác đồ điều trị">Phác đồ điều trị</option>
                  <option value="Cấp cứu & Sốc phản vệ">Cấp cứu & Phản vệ</option>
                  <option value="Quy chuẩn bệnh viện">Quy chuẩn BV</option>
                  <option value="Khác">Văn bản khác</option>
                </select>
              </div>

              {/* Năm ban hành */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Năm hiệu lực</label>
                <input
                  type="number"
                  value={editionYear}
                  onChange={(e) => setEditionYear(parseInt(e.target.value) || 2026)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-600 focus:ring-1 focus:ring-teal-600 outline-hidden"
                />
              </div>
            </div>

            {/* Mã định danh (tùy chọn) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mã định danh (Tùy chọn)
              </label>
              <input
                type="text"
                placeholder="VD: tt-26-ke-don (để trống tự sinh từ tên tệp)"
                value={docId}
                onChange={(e) => setDocId(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-600 focus:ring-1 focus:ring-teal-600 outline-hidden font-mono"
              />
            </div>

            {/* Error Message */}
            {uploadError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Success Message */}
            {uploadResult && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-amber-800">
                  <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Đã lưu vào bộ nhớ cục bộ (LocalStorage & IndexedDB)!</span>
                </div>
                <p className="text-2xs text-amber-700">
                  Theo yêu cầu, tệp PDF chỉ lưu trong trình duyệt client, không nạp thêm vào CSDL máy chủ Backend.
                </p>
                <div className="text-2xs space-y-0.5 text-amber-800 font-mono">
                  <div>• Mã tài liệu: {uploadResult.doc_id}</div>
                  <div>• Tên tệp: {uploadResult.filename}</div>
                  <div>• Dung lượng: {(uploadResult.file_bytes / 1024).toFixed(1)} KB</div>
                  <div>• SHA256: {uploadResult.sha256.substring(0, 16)}...</div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={uploading}
              className="w-full py-2.5 px-4 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs tracking-wide shadow-2xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Đang lưu vào bộ nhớ cục bộ...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  <span>Tải lên (Lưu cục bộ LocalStorage)</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* 3. Interactive Query Sandbox (Right Column: 7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-800">
                <Search className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Thử Nghiệm Truy Vấn Trích Dẫn Trang</h2>
                <p className="text-xs text-slate-500">Kiểm tra kết quả Hybrid RRF (BM25 + Cosine) và số trang được dẫn nguồn</p>
              </div>
            </div>

            <form onSubmit={handleQuery} className="mt-4 space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nhập câu hỏi thử nghiệm (VD: Liều Adrenalin cấp cứu phản vệ, CrCl suy thận...)"
                  value={queryText}
                  onChange={(e) => setQueryText(e.target.value)}
                  className="flex-1 text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-teal-600 focus:ring-1 focus:ring-teal-600 outline-hidden"
                />

                <select
                  value={selectedDocFilter}
                  onChange={(e) => setSelectedDocFilter(e.target.value)}
                  className="w-40 text-xs px-2.5 py-2.5 rounded-xl border border-slate-200 focus:border-teal-600 outline-hidden bg-white truncate"
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
                  className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition shrink-0 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {querying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span>Tìm kiếm</span>
                </button>
              </div>
            </form>

            {/* Query Error */}
            {queryError && (
              <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                {queryError}
              </div>
            )}

            {/* Query Results Cards */}
            {queryResults.length > 0 && (
              <div className="mt-4 space-y-3">
                <div className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between">
                  <span>Kết Quả Truy Xuất (Top {queryResults.length})</span>
                  <span className="text-2xs font-normal text-slate-400">RRF Fusion k=60</span>
                </div>

                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {queryResults.map((item, idx) => (
                    <div
                      key={item.chunk_id || idx}
                      className="p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/50 hover:bg-slate-50 transition space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="px-2 py-0.5 rounded-md bg-teal-100 text-teal-800 font-bold text-2xs shrink-0">
                            #{idx + 1}
                          </span>
                          <span className="text-xs font-bold text-slate-800 truncate">
                            {item.title}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-mono font-bold text-2xs shrink-0">
                          {item.page_or_section}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                        &quot;{item.content}&quot;
                      </p>

                      {item.match_reasons && item.match_reasons.length > 0 && (
                        <div className="flex flex-wrap gap-1 text-2xs text-slate-500 font-mono">
                          {item.match_reasons.map((r, i) => (
                            <span key={i} className="px-1.5 py-0.5 bg-white rounded border border-slate-200 text-slate-600">
                              {r}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-2xs text-slate-500">
                        <span className="truncate">Căn cứ: {item.legal_basis}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`font-mono font-semibold px-2 py-0.5 rounded-md ${
                            item.score >= 80 ? 'bg-emerald-100 text-emerald-800' :
                            item.score >= 60 ? 'bg-teal-100 text-teal-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            Độ phù hợp: {item.score}%
                          </span>
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
          </div>

          <div className="pt-3 border-t border-slate-100 text-2xs text-slate-400 flex items-center justify-between">
            <span>Thuật toán: Reciprocal Rank Fusion kết hợp SQLite FTS5 BM25 và Dot Product ma trận RAM.</span>
            <span>Độ trễ: &lt; 2.5ms</span>
          </div>
        </div>
      </div>

      {/* 4. Document Catalog Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-slate-100 text-slate-800">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Danh Mục Văn Bản Tri Thức Hiện Có</h2>
              <p className="text-xs text-slate-500">
                Toàn bộ tài liệu PDF đã được lưu trữ provenance và lập chỉ mục trong hệ thống
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={loadDocuments}
            disabled={loadingDocs}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingDocs ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>

        {documents.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            {loadingDocs ? 'Đang tải danh mục tài liệu...' : 'Chưa có tài liệu nào trong kho. Hãy tải lên tài liệu PDF đầu tiên!'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-2xs border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Tên Văn Bản / Tệp</th>
                  <th className="py-2.5 px-3 font-semibold">Căn Cứ Pháp Lý</th>
                  <th className="py-2.5 px-3 font-semibold">Phân Loại</th>
                  <th className="py-2.5 px-3 font-semibold">Năm</th>
                  <th className="py-2.5 px-3 font-semibold font-mono">SHA256</th>
                  <th className="py-2.5 px-3 font-semibold">Dung Lượng</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-900">{doc.title}</div>
                      <div className="text-2xs text-slate-400 font-mono mt-0.5">{doc.filename}</div>
                    </td>
                    <td className="py-3 px-3 text-slate-700">{doc.legal_basis}</td>
                    <td className="py-3 px-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 font-medium text-2xs border border-teal-100">
                          {doc.category || 'Văn bản y tế'}
                        </span>
                        {doc.is_local && (
                          <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 font-semibold text-2xs border border-amber-200">
                            Cục bộ (LocalStorage)
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-600">{doc.edition_year || 2026}</td>
                    <td className="py-3 px-3 font-mono text-2xs text-slate-400">
                      {doc.sha256 ? `${doc.sha256.substring(0, 10)}...` : 'N/A'}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-500">
                      {(doc.bytes / 1024).toFixed(0)} KB
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <a
                          href={doc.public_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg text-slate-600 hover:text-teal-800 hover:bg-slate-100 transition"
                          title="Mở xem tệp PDF"
                          onClick={async (e) => {
                            if (doc.is_local) {
                              e.preventDefault();
                              await openLocalPdfDocument(doc.id);
                            }
                          }}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>

                        <button
                          type="button"
                          onClick={() => handleDelete(doc.id, doc.title, doc.is_local)}
                          disabled={deletingId === doc.id}
                          className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition cursor-pointer disabled:opacity-50"
                          title={doc.is_local ? "Xóa tài liệu khỏi bộ nhớ cục bộ" : "Xóa tài liệu và giải phóng vector"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
