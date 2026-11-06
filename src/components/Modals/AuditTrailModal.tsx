import React, { useState } from 'react';
import { X, Download, ChevronDown } from 'lucide-react';
import { AuditTrailRecord } from '../../types/clinical';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import { SearchField, EmptyState } from '../ui/Workspace';
interface AuditTrailModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: AuditTrailRecord[];
}
export const AuditTrailModal: React.FC<AuditTrailModalProps> = ({ isOpen, onClose, records }) => {
  useModalDismiss(isOpen, onClose);
  const [query, setQuery] = useState('');
  const [action, setAction] = useState('all');
  const filtered = records.filter(
    (r) =>
      (action === 'all' || r.actionType === action) &&
      [r.id, r.actionTitle, r.targetItem, r.signerName, r.signerCertificate, r.witnessName]
        .join(' ')
        .toLocaleLowerCase('vi')
        .includes(query.toLocaleLowerCase('vi')),
  );
  const exportCsv = () => {
    const cell = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const rows = [
      [
        'Mã',
        'Thời gian',
        'Nghiệp vụ',
        'Đối tượng',
        'Người thực hiện',
        'Người chứng kiến',
        'Căn cứ trong hồ sơ',
        'Phương thức',
        'Mã kiểm tra trong hồ sơ',
        'Trạng thái trong hồ sơ',
      ],
      ...filtered.map((r) => [
        r.id,
        r.timestamp,
        r.actionTitle,
        r.targetItem,
        r.signerName,
        r.witnessName,
        r.legalBasis,
        r.authMethod,
        r.integrityHash,
        r.status,
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(['\uFEFF' + rows.map((row) => row.map(cell).join(',')).join('\r\n')], {
        type: 'text/csv;charset=utf-8',
      }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `Nhat_ky_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  if (!isOpen) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Nhật ký hoạt động"
      className="clinical-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-5"
    >
      <div className="bg-white w-full max-w-5xl h-[100dvh] sm:h-[88vh] flex flex-col overflow-hidden">
        <header className="library-header">
          <div>
            <h2>
              Nhật ký hoạt động{' '}
              <span className="record-sub inline">/ {records.length} bản ghi</span>
            </h2>
          </div>
          <button type="button" className="icon-action" aria-label="Đóng nhật ký" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="p-4 sm:p-6 shrink-0">
          <div className="workspace-toolbar">
            <SearchField
              value={query}
              onChange={setQuery}
              label="Tìm nhật ký"
              placeholder="Nghiệp vụ, người thực hiện, đối tượng…"
            />
            <select
              className="workspace-select"
              aria-label="Nghiệp vụ nhật ký"
              value={action}
              onChange={(e) => setAction(e.target.value)}
            >
              <option value="all">Tất cả nghiệp vụ</option>
              {[...new Set(records.map((r) => r.actionType))].map((type) => (
                <option key={type} value={type}>
                  {records.find((r) => r.actionType === type)?.actionTitle || type}
                </option>
              ))}
            </select>
            <button type="button" className="button-secondary" onClick={exportCsv}>
              <Download size={16} />
              Xuất CSV
            </button>
          </div>
          <p className="record-sub mt-3">
            Nhật ký mô phỏng trong phiên làm việc hiện tại; không thay thế nhật ký máy chủ. Chưa xác minh chữ ký hoặc tính toàn vẹn của bản ghi.
          </p>
        </div>
        <div className="audit-records">
          {!filtered.length && <EmptyState title="Chưa có bản ghi phù hợp" />}
          {filtered.map((record) => (
            <article key={record.id} className="audit-record">
              <div className="audit-record-heading">
                <div>
                  <span className="record-sub record-mono">
                    {record.timestamp} · {record.id}
                  </span>
                  <h3>{record.actionTitle}</h3>
                  <p className="record-sub">{record.targetItem}</p>
                </div>
                <span className="status-pill neutral">{record.status === 'session_simulated' ? 'Mô phỏng trong phiên' : 'Chưa xác minh'}</span>
              </div>
              <div className="audit-record-person">
                <span>
                  Người thực hiện: <strong>{record.signerName || 'Chưa ghi nhận'}</strong>
                </span>
                {record.witnessName && (
                  <span>
                    Chứng kiến: <strong>{record.witnessName}</strong>
                  </span>
                )}
              </div>
              <details>
                <summary>
                  Thông tin hồ sơ
                  <ChevronDown size={13} />
                </summary>
                <dl className="detail-facts">
                  <div>
                    <dt>Căn cứ được lưu</dt>
                    <dd>{record.legalBasis || '—'}</dd>
                  </div>
                  <div>
                    <dt>Chứng chỉ được lưu</dt>
                    <dd>{record.signerCertificate || '—'}</dd>
                  </div>
                  <div>
                    <dt>Phương thức được lưu</dt>
                    <dd>{record.authMethod || '—'}</dd>
                  </div>
                  <div>
                    <dt>Mã kiểm tra trong hồ sơ</dt>
                    <dd className="break-all record-mono">{record.integrityHash || 'Chưa có'}</dd>
                  </div>
                  <div>
                    <dt>Trạng thái được lưu</dt>
                    <dd>{record.status || '—'}</dd>
                  </div>
                </dl>
              </details>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
};
