import React from 'react';
import type { ColdChainMonitorState } from '../../../../types/clinical';
export const ColdChainQuarantineBanner: React.FC<{ coldChainState: ColdChainMonitorState; onReleaseQuarantine?: () => void }> = ({ coldChainState: state, onReleaseQuarantine }) => <section data-testid="coldchain-quarantine-banner" className="border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
  <strong>Trạng thái tủ: đang biệt trữ, chờ thẩm định</strong>
  <p className="mt-2">{state.quarantineReason || 'Kiểm tra sự cố và liên kết của từng lô trước khi xem xét giải phóng.'}</p>
  <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1"><div><dt>VVM ghi nhận ở trạng thái tủ</dt><dd>{Number.isFinite(state.vvmStage) ? state.vvmStage : 'Chưa có dữ liệu'}</dd></div><div><dt>MKT ghi nhận</dt><dd>{Number.isFinite(state.mktTemperature) ? `${state.mktTemperature}°C` : 'Chưa có dữ liệu'}</dd></div><div><dt>Thời gian sự cố ghi nhận</dt><dd>{Number.isFinite(state.outageMinutes) ? `${state.outageMinutes} phút` : 'Chưa có dữ liệu'}</dd></div></dl>
  <p className="mt-2">Các chỉ số tổng hợp của tủ chưa thay thế việc kiểm tra từng lô. Không có kết luận tự động rằng vắc xin đủ điều kiện sử dụng.</p>
  {onReleaseQuarantine && <button type="button" onClick={onReleaseQuarantine} className="button-secondary mt-3">Xét giải phóng biệt trữ</button>}
</section>;
