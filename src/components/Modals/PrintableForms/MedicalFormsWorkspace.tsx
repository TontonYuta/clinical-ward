import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  X,
  Printer,
  Search,
  MoreHorizontal,
  Download,
  FileText,
  Check,
  PanelLeftClose,
  PanelLeftOpen,
  Maximize2,
} from 'lucide-react';
import type { PrintableFormType } from '../PrintableFormModal';
import { ClinicalNote } from '../../ui/ClinicalNote';
import { fitDocumentScale, FORM_GROUPS, FORM_PRESENTATION, normalizeFormSearch } from './formModel';
interface Props {
  activeForm: PrintableFormType;
  onFormChange: (id: PrintableFormType) => void;
  forms: readonly { id: PrintableFormType; shortLabel: string; codeLabel: string }[];
  sourcePicker: React.ReactNode;
  sourceReady: boolean;
  contextSummary: string;
  onPrint: () => void;
  onDownload: () => void;
  onClose: () => void;
  children: React.ReactNode;
}
export function MedicalFormsWorkspace({
  activeForm,
  onFormChange,
  forms,
  sourcePicker,
  sourceReady,
  contextSummary,
  onPrint,
  onDownload,
  onClose,
  children,
}: Props) {
  const [query, setQuery] = useState('');
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [zoom, setZoom] = useState<'fit' | '100%'>('fit');
  const [geometry, setGeometry] = useState({ width: 794, height: 1123, available: 794 });
  const canvasRef = useRef<HTMLDivElement>(null),
    paperRef = useRef<HTMLDivElement>(null),
    closeRef = useRef<HTMLButtonElement>(null),
    panelRef = useRef<HTMLDivElement>(null),
    catalogRef = useRef<HTMLElement>(null),
    catalogSearchRef = useRef<HTMLInputElement>(null),
    catalogTriggerRef = useRef<HTMLButtonElement>(null),
    wasCatalogOpen = useRef(false);
  const metadata = FORM_PRESENTATION[activeForm];
  const q = normalizeFormSearch(query);
  const filtered = forms.filter((f) =>
    normalizeFormSearch(
      `${FORM_PRESENTATION[f.id].title} ${f.shortLabel} ${FORM_PRESENTATION[f.id].group}`,
    ).includes(q),
  );
  const scale = zoom === 'fit' ? fitDocumentScale(geometry.available, geometry.width) : 1;
  useLayoutEffect(() => {
    const canvas = canvasRef.current,
      paper = paperRef.current;
    if (!canvas || !paper) return;
    const update = () => {
      const width = paper.offsetWidth || 794,
        height = paper.offsetHeight || 1123,
        available = Math.max(1, canvas.clientWidth - 32);
      setGeometry((prev) =>
        prev.width === width && prev.height === height && prev.available === available
          ? prev
          : { width, height, available },
      );
    };
    const observer = new ResizeObserver(update);
    observer.observe(canvas);
    observer.observe(paper);
    update();
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    setCatalogOpen(false);
    setZoom('fit');
  }, [activeForm]);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    return () => {
      previous?.focus();
    };
  }, []);
  useEffect(() => {
    if (catalogOpen) catalogSearchRef.current?.focus();
    else if (wasCatalogOpen.current) catalogTriggerRef.current?.focus();
    wasCatalogOpen.current = catalogOpen;
  }, [catalogOpen]);
  useEffect(() => {
    const media = window.matchMedia('(min-width:1024px)');
    const update = () => {
      if (media.matches) setCatalogOpen(false);
    };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        const elements = [
          ...((catalogOpen ? catalogRef.current : panelRef.current)?.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input,select,a[href],[tabindex="0"]',
          ) || []),
        ].filter((el) => el.getClientRects().length > 0);
        const first = elements[0],
          last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p' && !sourceReady) {
        event.preventDefault();
        panelRef.current?.querySelector<HTMLSelectElement>('.forms-source-picker select')?.focus();
        return;
      }

      if (event.key === 'Escape' && catalogOpen) {
        event.stopImmediatePropagation();
        event.preventDefault();
        setCatalogOpen(false);
      } else if (event.key === 'Escape' && moreOpen) {
        event.stopImmediatePropagation();
        event.preventDefault();
        setMoreOpen(false);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [catalogOpen, moreOpen, sourceReady]);
  const select = (id: PrintableFormType) => {
    onFormChange(id);
    setCatalogOpen(false);
  };
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="forms-workspace-title"
      data-testid="printable-form-modal"
      className="medical-forms-overlay clinical-modal-overlay fixed inset-0 z-50 print:static print:block"
    >
      <div className="medical-forms-panel bg-white" ref={panelRef}>
        <header className="forms-header print:hidden" inert={catalogOpen}>
          <div className="forms-header-title">
            <FileText size={22} aria-hidden="true" />
            <h2 id="forms-workspace-title">Biểu mẫu</h2>
            <span>{forms.length} loại phiếu</span>
          </div>
          <div className="forms-header-actions">
            <button
              type="button"
              className="button-primary"
              onClick={onPrint}
              disabled={!sourceReady}
            >
              <Printer size={17} aria-hidden="true" />
              In / Lưu PDF
            </button>
            <div className="forms-overflow">
              <button
                type="button"
                className="icon-action"
                aria-label="Tùy chọn xuất biểu mẫu"
                aria-expanded={moreOpen}
                onClick={() => setMoreOpen((v) => !v)}
              >
                <MoreHorizontal size={19} />
              </button>
              {moreOpen && (
                <div className="forms-overflow-menu">
                  <button
                    type="button"
                    onClick={() => {
                      onDownload();
                      setMoreOpen(false);
                    }}
                    disabled={!sourceReady}
                  >
                    <Download size={16} aria-hidden="true" />
                    Tải bản HTML
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              className="icon-action"
              ref={closeRef}
              data-testid="close-printable-modal"
              aria-label="Đóng biểu mẫu"
              onClick={onClose}
            >
              <X size={20} />
            </button>
          </div>
        </header>
        <div className="forms-workspace-body">
          <aside
            className={`forms-catalog print:hidden ${catalogOpen ? 'is-open' : ''}`}
            aria-label="Danh mục biểu mẫu"
            id="forms-catalog"
            ref={catalogRef}
            role={catalogOpen ? 'dialog' : undefined}
            aria-modal={catalogOpen ? true : undefined}
          >
            <div className="forms-catalog-title">
              <strong>Chọn loại phiếu</strong>
              <button
                type="button"
                aria-label="Đóng danh mục phiếu"
                className="forms-catalog-close icon-action"
                onClick={() => setCatalogOpen(false)}
              >
                <X size={17} />
              </button>
            </div>
            <label className="forms-search">
              <Search size={16} aria-hidden="true" />
              <span className="sr-only">Tìm biểu mẫu</span>
              <input
                type="search"
                ref={catalogSearchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm tên phiếu…"
              />
            </label>
            <nav aria-label="Các loại phiếu">
              {FORM_GROUPS.map((group) => {
                const items = filtered.filter((f) => FORM_PRESENTATION[f.id].group === group);
                return (
                  !!items.length && (
                    <section key={group}>
                      <h3>{group}</h3>
                      {items.map((form) => (
                        <button
                          type="button"
                          key={form.id}
                          data-testid={`form-choice-${form.id}`}
                          aria-current={activeForm === form.id ? 'true' : undefined}
                          onClick={() => select(form.id)}
                        >
                          <span>
                            <strong>{FORM_PRESENTATION[form.id].title}</strong>
                            <small>{FORM_PRESENTATION[form.id].hint}</small>
                          </span>
                          {activeForm === form.id && <Check size={17} aria-hidden="true" />}
                        </button>
                      ))}
                    </section>
                  )
                );
              })}
              {!filtered.length && (
                <p className="forms-catalog-empty">Không tìm thấy loại phiếu phù hợp.</p>
              )}
            </nav>
          </aside>
          {catalogOpen && (
            <button
              type="button"
              className="forms-catalog-scrim print:hidden"
              aria-label="Đóng danh mục"
              onClick={() => setCatalogOpen(false)}
            />
          )}
          <div className="forms-work-area" inert={catalogOpen}>
            <div className="forms-context print:hidden">
              <div className="forms-selection-line">
                <button
                  type="button"
                  className="forms-catalog-trigger button-secondary"
                  aria-expanded={catalogOpen}
                  aria-controls="forms-catalog"
                  ref={catalogTriggerRef}
                  onClick={() => setCatalogOpen((v) => !v)}
                >
                  <PanelLeftOpen size={17} aria-hidden="true" />
                  Chọn phiếu
                </button>
                <strong id="forms-catalog-current">{metadata.title}</strong>
              </div>
              {sourcePicker}
              <div className={`forms-source-summary ${sourceReady ? '' : 'needs-source'}`}>
                <span className="status-pill info">Dự thảo</span>
                <p>{contextSummary}</p>
              </div>
            </div>
            <div className="forms-review print:hidden">
              <ClinicalNote
                severity={sourceReady ? 'info' : 'warning'}
                title={sourceReady ? 'Đối chiếu thông tin trước khi in' : 'Cần chọn hồ sơ nguồn'}
              >
                {sourceReady
                  ? 'Bản nháp chưa xác minh. Trường thiếu dữ liệu được ghi “Chưa ghi”; cần đối chiếu hồ sơ và bổ sung trước khi sử dụng.'
                  : 'Chọn đúng phiếu, thiết bị hoặc tài sản để lấy dữ liệu. Chưa thể in khi chưa chọn hồ sơ.'}
              </ClinicalNote>
            </div>
            <div className="forms-preview-controls print:hidden">
              <span>Bản xem trước · A4</span>
              <button
                type="button"
                aria-pressed={zoom === '100%'}
                onClick={() => setZoom((v) => (v === 'fit' ? '100%' : 'fit'))}
              >
                <Maximize2 size={16} aria-hidden="true" />
                {zoom === 'fit' ? 'Xem 100%' : 'Vừa khung'}
              </button>
            </div>
            <div
              className="forms-preview-canvas"
              ref={canvasRef}
              aria-label="Bản xem trước biểu mẫu"
            >
              {!sourceReady && (
                <div className="forms-awaiting-source print:hidden">
                  <FileText size={35} aria-hidden="true" />
                  <strong>Chưa có dữ liệu hồ sơ</strong>
                  <p>Chọn hồ sơ nguồn để xem đúng thông tin trên phiếu.</p>
                </div>
              )}
              <div
                hidden={!sourceReady}
                className="forms-paper-reservation"
                style={{ width: geometry.width * scale, height: geometry.height * scale }}
              >
                <div
                  className="forms-paper"
                  ref={paperRef}
                  style={{ transform: `scale(${scale})` }}
                >
                  {children}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
