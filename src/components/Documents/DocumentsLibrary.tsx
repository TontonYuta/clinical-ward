import React, { useEffect, useMemo, useState } from 'react';
import { FileText, Search, Upload, LoaderCircle, X, FileUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import { getKnowledgeDocumentsApi, uploadKnowledgeDocumentApi } from '../../services/api';
import type { KnowledgeDocument } from '../../types/documents';
import { filterKnowledgeDocuments, formatDocumentFileSize, isPdfFile } from './documentsLibraryModel';

export const DocumentsLibrary: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Tất cả');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const uploadDialogRef = React.useRef<HTMLDivElement>(null);

  const refreshDocuments = async () => {
    setLoading(true);
    setError('');
    try { setDocuments(await getKnowledgeDocumentsApi()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể tải danh mục tài liệu'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void refreshDocuments(); }, []);
  useEffect(() => {
    if (!isUploadOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isUploading) setIsUploadOpen(false);
    };
    window.addEventListener('keydown', handleEscape);
    uploadDialogRef.current?.focus();
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isUploadOpen, isUploading]);
  const categories = useMemo(() => ['Tất cả', ...Array.from(new Set(documents.map((doc) => doc.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'vi'))], [documents]);
  const visibleDocuments = useMemo(() => filterKnowledgeDocuments(documents, query, category), [documents, query, category]);
  const pdfUrl = (document: KnowledgeDocument) => {
    if (/^https?:\/\//i.test(document.public_url)) return document.public_url;
    const base = document.public_url.startsWith('/') ? document.public_url : `/${document.public_url}`;
    return `${window.location.origin}${base}`;
  };

  const acceptFile = (file?: File) => {
    if (!file) return;
    if (!isPdfFile(file)) {
      setSelectedFile(null);
      setUploadError('Tệp này không phải PDF. Hãy chọn tài liệu có định dạng .pdf.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setSelectedFile(file);
    setUploadError('');
    setUploadMessage('');
  };

  const handleUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile) { setUploadError('Chọn một tệp PDF trước khi tiếp tục.'); return; }
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const title = String(form.get('title') || '').trim();
    const legalBasis = String(form.get('legal_basis') || '').trim();
    const documentCategory = String(form.get('category') || '').trim();
    const year = Number(form.get('edition_year'));
    if (!title || !legalBasis || !documentCategory || !Number.isInteger(year)) { setUploadError('Vui lòng điền đầy đủ thông tin tài liệu.'); return; }
    setIsUploading(true); setUploadError(''); setUploadMessage('');
    try {
      await uploadKnowledgeDocumentApi({ file: selectedFile, title, legalBasis, category: documentCategory, editionYear: year });
      setUploadMessage('Tài liệu đã được lưu và lập chỉ mục cho chatbot.');
      setSelectedFile(null);
      formElement.reset();
      await refreshDocuments();
      setIsUploadOpen(false);
    } catch (cause) { setUploadError(cause instanceof Error ? cause.message : 'Không thể tải tài liệu lên.'); }
    finally { setIsUploading(false); }
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-slate-50" data-testid="documents-library">
      <div className="w-full p-2 sm:p-3 lg:p-4">
        <section className="min-h-full rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div><h2 className="font-semibold text-slate-900">Kho tài liệu</h2><p className="mt-1 text-xs text-slate-500">{documents.length} tài liệu</p></div>
              <div className="flex w-full gap-2 sm:w-auto">
                <label className="relative min-w-0 flex-1 sm:w-64"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input aria-label="Tìm tài liệu" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên, số hiệu…" className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" /></label>
                <select aria-label="Lọc loại tài liệu" value={category} onChange={(event) => setCategory(event.target.value)} className="max-w-36 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-700">{categories.map((item) => <option key={item}>{item}</option>)}</select>
                <button type="button" onClick={() => { setUploadError(''); setIsUploadOpen(true); }} aria-label="Thêm tài liệu PDF" title="Thêm tài liệu PDF" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100"><Upload className="h-4 w-4" /></button>
              </div>
            </div>
            {loading ? <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" /> Đang tải tài liệu…</div> : error ? <div role="alert" className="rounded-lg bg-rose-50 p-4 text-sm text-rose-800">{error}</div> : visibleDocuments.length === 0 ? <div className="rounded-lg border border-dashed border-slate-300 py-14 text-center text-sm text-slate-500">{documents.length ? 'Không tìm thấy tài liệu phù hợp.' : 'Chưa có tài liệu trong thư viện.'}</div> : (
              <ul data-testid="document-card-grid" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{visibleDocuments.map((document) => (
                <li key={document.id} className="min-w-0">
                  <a data-testid="document-card-link" href={pdfUrl(document)} target="_blank" rel="noreferrer" aria-label={`Mở tài liệu PDF: ${document.title}`} className="block h-full min-h-36 rounded-xl border border-slate-200 p-5 text-left transition hover:border-teal-400 hover:bg-teal-50/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 sm:p-6">
                  <div className="flex items-start gap-4"><div className="rounded-xl bg-rose-50 p-3 text-rose-700"><FileText className="h-5 w-5" /></div><div className="min-w-0 flex-1"><h3 className="line-clamp-3 text-base font-semibold leading-snug text-slate-900">{document.title}</h3><p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-500">{document.legal_basis || document.filename}</p></div></div>
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500"><span className="rounded-full bg-slate-100 px-2.5 py-1">{document.category || 'Văn bản y tế'}</span>{document.edition_year && <span>{document.edition_year}</span>}</div>
                  </a>
                </li>
              ))}</ul>
            )}
        </section>

        {uploadMessage && !isUploadOpen && <div role="status" className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-4 py-3 text-sm text-emerald-800 shadow-lg"><CheckCircle2 className="h-4 w-4" />{uploadMessage}</div>}
        {isUploadOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-0 sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !isUploading) setIsUploadOpen(false); }}>
          <div ref={uploadDialogRef} tabIndex={-1} className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl outline-none sm:h-auto sm:max-h-[min(92dvh,780px)] sm:max-w-2xl sm:rounded-2xl sm:border sm:border-slate-200" role="dialog" aria-modal="true" aria-labelledby="document-upload-title" data-testid="document-upload-dialog">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3.5 sm:px-6 sm:py-4">
              <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-800"><FileUp className="h-5 w-5" /></div><div><h2 id="document-upload-title" className="font-semibold text-slate-900">Thêm tài liệu y tế</h2><p className="text-xs text-slate-500">PDF được lưu và đưa vào tìm kiếm chatbot</p></div></div>
              <button type="button" aria-label="Đóng biểu mẫu tải tài liệu" disabled={isUploading} onClick={() => setIsUploadOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleUpload} className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
                <div onDragEnter={(event) => { event.preventDefault(); setIsDraggingFile(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { event.preventDefault(); if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDraggingFile(false); }} onDrop={(event) => { event.preventDefault(); setIsDraggingFile(false); acceptFile(event.dataTransfer.files[0]); }} className={`relative rounded-xl border-2 border-dashed p-5 text-center transition sm:p-7 ${isDraggingFile ? 'border-teal-600 bg-teal-50' : selectedFile ? 'border-emerald-300 bg-emerald-50/60' : 'border-slate-300 bg-slate-50 hover:border-teal-400 hover:bg-teal-50/50'}`}>
                  <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" onChange={(event) => acceptFile(event.target.files?.[0])} className="sr-only" aria-label="Chọn tệp PDF" />
                  {selectedFile ? <div data-testid="selected-document-file" className="flex items-center justify-center gap-3 text-left"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white text-rose-700 shadow-xs"><FileText className="h-5 w-5" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{selectedFile.name}</p><p className="mt-0.5 text-xs text-slate-500">{formatDocumentFileSize(selectedFile.size)} · PDF</p></div><button type="button" aria-label="Bỏ tệp đã chọn" disabled={isUploading} onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-rose-700"><X className="h-4 w-4" /></button></div> : <><div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-teal-700 shadow-xs"><Upload className="h-5 w-5" /></div><p className="text-sm font-semibold text-slate-800">Thả tệp PDF vào đây</p><p className="mt-1 text-xs text-slate-500">hoặc</p><button type="button" onClick={() => fileInputRef.current?.click()} className="mt-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-teal-800 hover:bg-teal-50">Chọn tệp từ thiết bị</button><p className="mt-2 text-[11px] text-slate-400">Chỉ nhận tài liệu định dạng PDF</p></>}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-slate-700 sm:col-span-2">Tên tài liệu<input name="title" required maxLength={300} className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" placeholder="VD: Thông tư hướng dẫn kê đơn thuốc" /></label>
                  <label className="block text-sm font-medium text-slate-700">Loại tài liệu<input name="category" required maxLength={100} list="document-category-options" className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" placeholder="Nghị định, Thông tư…" /><datalist id="document-category-options">{categories.filter((item) => item !== 'Tất cả').map((item) => <option key={item} value={item} />)}</datalist></label>
                  <label className="block text-sm font-medium text-slate-700">Năm ban hành<input name="edition_year" type="number" min="1900" max="2200" required defaultValue={new Date().getFullYear()} className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" /></label>
                  <label className="block text-sm font-medium text-slate-700 sm:col-span-2">Số hiệu / căn cứ<input name="legal_basis" required maxLength={300} className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" placeholder="VD: Thông tư 26/2025/TT-BYT" /></label>
                </div>
                {uploadError && <p role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{uploadError}</p>}
                <p className="text-xs text-slate-500">Sau khi nạp, nội dung tài liệu sẽ được lập chỉ mục để chatbot tra cứu.</p>
              </div>
              <div className="border-t border-slate-200 bg-white px-4 py-3.5 sm:px-6">
                {isUploading && <div className="mb-3"><div className="mb-1.5 flex items-center justify-between text-xs text-teal-800"><span>Đang tải lên và lập chỉ mục tài liệu…</span><LoaderCircle className="h-3.5 w-3.5 animate-spin" /></div><div className="h-1.5 overflow-hidden rounded-full bg-teal-100"><div className="h-full w-1/3 animate-pulse rounded-full bg-teal-700" /></div></div>}
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" disabled={isUploading} onClick={() => setIsUploadOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Hủy</button><button type="submit" disabled={isUploading || !selectedFile} className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50">{isUploading ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Đang xử lý…</> : <><Upload className="h-4 w-4" /> Tải lên và lập chỉ mục</>}</button></div>
              </div>
            </form>
          </div>
        </div>}
      </div>
    </div>
  );
};
