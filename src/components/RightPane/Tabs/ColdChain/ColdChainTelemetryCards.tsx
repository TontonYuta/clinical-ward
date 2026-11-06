import React from 'react';
import { Thermometer, Droplets, History } from 'lucide-react';
import { ColdChainMonitorState } from '../../../../types/clinical';
interface ColdChainTelemetryCardsProps {
  coldChainState: ColdChainMonitorState;
  isAlarm: boolean;
  isQuarantined: boolean;
}
export const ColdChainTelemetryCards: React.FC<ColdChainTelemetryCardsProps> = ({
  coldChainState: s,
  isAlarm,
  isQuarantined,
}) => (
  <section
    className={`telemetry-strip ${isAlarm ? 'is-alarm' : ''}`}
    aria-label="Thông số bảo quản"
  >
    <div className="telemetry-item">
      <p className="telemetry-label">
        <Thermometer size={14} />
        Nhiệt độ ghi nhận
      </p>
      <p className="telemetry-value">
        {Number.isFinite(s.currentTemp) ? s.currentTemp.toFixed(1) : '—'}
        <small>°C</small>
      </p>
      <p className="telemetry-note">
        {isAlarm
          ? 'Cần kiểm tra nhiệt độ'
          : isQuarantined
            ? 'Lô đang biệt trữ'
            : 'Dải theo dõi tủ: 2–8°C'}
      </p>
    </div>
    <div className="telemetry-item">
      <p className="telemetry-label">
        <Droplets size={14} />
        Độ ẩm ghi nhận
      </p>
      <p className="telemetry-value">
        {Number.isFinite(s.currentHumidity) ? s.currentHumidity : '—'}
        <small>% RH</small>
      </p>
      <p className="telemetry-note">Bản ghi cuối: {s.logs[s.logs.length - 1]?.timestamp || 'Chưa có'}</p>
    </div>
    <div className="telemetry-item">
      <p className="telemetry-label">
        <History size={14} />
        Nhật ký theo dõi
      </p>
      <p className="telemetry-value">
        {s.logs.length}
        <small>bản ghi</small>
      </p>
      <p className="telemetry-note">{s.storageName || 'Chưa có tên tủ'}</p>
    </div>
  </section>
);
