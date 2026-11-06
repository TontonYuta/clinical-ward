import React, { useState } from 'react';
import type { PatientProfile } from '../../services/patientService';
import {
  ArrowUpRight,
  Boxes,
  Thermometer,
  Pill,
  Users,
  Scale,
  Sparkles,
  Clock3,
} from 'lucide-react';
import type { DashboardTab, UserRole, AuditTrailRecord } from '../../types/clinical';
import type { DebtRecord, InventoryBatch } from '../../types/pharmacy';
import type {
  EquipmentTicket,
  ColdChainMonitorState,
  AssetAuditRecord,
} from '../../types/equipment';
import { canSearchMedications, canSearchPatients } from './flatDashboardModel';
import { OverviewPatientCenter } from './Overview/OverviewPatientCenter';
import { TextAction } from '../ui/Workspace';
import { expiryState, temperatureAlarm } from '../ui/workspaceStatus';
interface OperationsOverviewProps {
  patients: PatientProfile[];
  currentUserRole: UserRole;
  debts: DebtRecord[];
  tickets: EquipmentTicket[];
  batches: InventoryBatch[];
  coldChainState: ColdChainMonitorState;
  assets: AssetAuditRecord[];
  auditRecords: AuditTrailRecord[];
  allowedTabs: DashboardTab[];
  onTabChange: (tab: DashboardTab) => void;
  onOpenPatient: (query: string) => void;
  onOpenMedication: (query: string) => void;
  onOpenCopilot?: () => void;
  onOpenLegalDocs?: () => void;
}
export const OperationsOverview: React.FC<OperationsOverviewProps> = ({
  patients,
  currentUserRole,
  batches,
  coldChainState,
  allowedTabs,
  onTabChange,
  onOpenPatient,
  onOpenMedication,
  onOpenCopilot,
  onOpenLegalDocs,
}) => {
  const [patientSearchOpen, setPatientSearchOpen] = useState(false);
  const near = batches.filter((b) => expiryState(b.expiryDate) === 'near').length;
  const expired = batches.filter((b) => expiryState(b.expiryDate) === 'expired').length;
  const low = batches.filter((b) => b.isLowStock || b.currentStock <= b.minThreshold).length;
  const alarm = temperatureAlarm(coldChainState);
  const quarantined = coldChainState.quarantineStatus === 'quarantined';
  return (
    <div className="overview-scroll thin-scrollbar">
      <div className="overview-grid">
        <section className="overview-hero">
          <div className="overview-hero-copy">
            <p className="eyebrow">Clinical Ward / Không gian của bạn</p>
            <h2>
              Tập trung chuyên môn.
              <br />
              Nhẹ gánh thao tác.
            </h2>
            <p>
              Đơn thuốc, kho dược và bảo quản.
              <br />
              Đi thẳng đến công việc bạn cần.
            </p>
            {allowedTabs.includes('cpoe') ? (
              <TextAction onClick={() => onTabChange('cpoe')}>Mở danh sách đơn thuốc</TextAction>
            ) : (
              <TextAction onClick={() => onOpenLegalDocs?.()}>Mở thư viện tài liệu</TextAction>
            )}
          </div>
          <div className="orbital-art" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
        </section>
        <section className="overview-tools" aria-label="Tra cứu nhanh">
          <p className="section-kicker">Trong tầm tay</p>
          {canSearchPatients(currentUserRole) && (
            <button
              type="button"
              className="lookup-button"
              aria-expanded={patientSearchOpen}
              onClick={() => setPatientSearchOpen((v) => !v)}
            >
              <Users size={20} />
              <span>
                <strong>Tìm người bệnh</strong>
                <small>Hồ sơ & lịch sử điều trị</small>
              </span>
              <ArrowUpRight size={17} />
            </button>
          )}
          {canSearchMedications(currentUserRole) && (
            <button type="button" className="lookup-button" onClick={() => onOpenMedication('')}>
              <Pill size={20} />
              <span>
                <strong>Tra cứu thuốc</strong>
                <small>Thông tin thuốc & chuyên luận</small>
              </span>
              <ArrowUpRight size={17} />
            </button>
          )}
          <button type="button" className="lookup-button" onClick={() => onOpenLegalDocs?.()}>
            <Scale size={20} />
            <span>
              <strong>Văn bản & tài liệu</strong>
              <small>Thư viện tham chiếu</small>
            </span>
            <ArrowUpRight size={17} />
          </button>
        </section>
      </div>
      {patientSearchOpen && canSearchPatients(currentUserRole) && (
        <div className="mt-4">
          <OverviewPatientCenter patients={patients} canSearch onOpenPatient={onOpenPatient} />
        </div>
      )}
      {(allowedTabs.includes('fefo') || allowedTabs.includes('coldchain')) && (
        <section className="attention-section">
          <div className="section-heading">
            <h2>Điều cần chú ý</h2>
            <span>Từ dữ liệu hiện có · Mở từng mục để kiểm tra</span>
          </div>
          <div className="attention-grid">
            {allowedTabs.includes('fefo') && (
              <>
                <button
                  type="button"
                  className={`attention-card ${expired ? 'danger' : near ? 'warning' : ''}`}
                  onClick={() => {
                    sessionStorage.setItem('fefo_status', expired ? 'expired' : 'near_expiry');
                    onTabChange('fefo');
                  }}
                >
                  <span className="attention-card-top">
                    <span className="flex items-center gap-2">
                      <Clock3 size={16} />
                      Hạn dùng thuốc
                    </span>
                    <ArrowUpRight size={17} />
                  </span>
                  <span className="attention-value">
                    {expired || near}
                    <small>lô</small>
                  </span>
                  <span className="attention-caption">
                    {expired ? 'Đã hết hạn · cần xử lý riêng' : 'Còn tối đa 90 ngày đến hạn'}
                  </span>
                </button>
                <button
                  type="button"
                  className={`attention-card ${low ? 'warning' : ''}`}
                  onClick={() => {
                    sessionStorage.setItem('fefo_status', 'low_stock');
                    onTabChange('fefo');
                  }}
                >
                  <span className="attention-card-top">
                    <span className="flex items-center gap-2">
                      <Boxes size={16} />
                      Dưới tồn tối thiểu
                    </span>
                    <ArrowUpRight size={17} />
                  </span>
                  <span className="attention-value">
                    {low}
                    <small>lô</small>
                  </span>
                  <span className="attention-caption">Đối chiếu nhu cầu bổ sung thuốc</span>
                </button>
              </>
            )}
            {allowedTabs.includes('coldchain') && (
              <button
                type="button"
                className={`attention-card ${alarm ? 'danger' : quarantined ? 'warning' : ''}`}
                onClick={() => onTabChange('coldchain')}
              >
                <span className="attention-card-top">
                  <span className="flex items-center gap-2">
                    <Thermometer size={16} />
                    Giám sát chuỗi lạnh
                  </span>
                  <ArrowUpRight size={17} />
                </span>
                <span className="attention-value">
                  {Number.isFinite(coldChainState.currentTemp)
                    ? coldChainState.currentTemp.toFixed(1)
                    : '—'}
                  <small>°C</small>
                </span>
                <span className="attention-caption">
                  {alarm
                    ? 'Nhiệt độ cần kiểm tra'
                    : quarantined
                      ? 'Lô đang biệt trữ'
                      : 'Trong dải theo dõi của tủ'}{' '}
                  · {coldChainState.logs.length} bản ghi
                </span>
              </button>
            )}
          </div>
        </section>
      )}
      <footer className="overview-footnote">
        <span>
          Thông tin tổng quan hỗ trợ điều hướng. Kiểm tra hồ sơ chi tiết trước khi thực hiện nghiệp
          vụ.
        </span>
        <button type="button" className="text-action shrink-0" onClick={() => onOpenCopilot?.()}>
          <Sparkles size={14} />
          Mở trợ lý lâm sàng
        </button>
      </footer>
    </div>
  );
};
