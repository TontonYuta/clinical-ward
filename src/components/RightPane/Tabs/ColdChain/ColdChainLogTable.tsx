import React from 'react';
import { ColdChainLog } from '../../../../types/clinical';
import { EmptyState } from '../../../ui/Workspace';
interface ColdChainLogTableProps {
  logs: ColdChainLog[];
}
export const ColdChainLogTable: React.FC<ColdChainLogTableProps> = ({ logs }) => (
  <div className="workspace-list">
    <div className="list-caption">
      <strong>{logs.length} bản ghi</strong>
      <span>Thời điểm &amp; điều kiện bảo quản</span>
    </div>
    <div className="workspace-table-scroll">
      <table className="workspace-table">
        <colgroup>
          <col style={{ width: '30%' }} />
          <col style={{ width: '20%' }} />
          <col style={{ width: '20%' }} />
          <col style={{ width: '30%' }} />
        </colgroup>
        <thead>
          <tr>
            <th>Thời điểm</th>
            <th>Nhiệt độ</th>
            <th>Độ ẩm</th>
            <th>Theo dõi</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log, i) => {
            const warning = log.temperature < 2 || log.temperature > 8 || log.status !== 'normal';
            return (
              <tr key={i} data-workspace-record>
                <td className="record-mono">{log.timestamp}</td>
                <td>
                  <strong>{log.temperature.toFixed(1)}°C</strong>
                </td>
                <td>{Number.isFinite(log.humidity) ? `${log.humidity}% RH` : 'Chưa có dữ liệu'}</td>
                <td>
                  <span className={`status-pill ${warning ? 'danger' : 'neutral'}`}>
                    {warning ? 'Cần kiểm tra' : 'Trong dải tủ'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!logs.length && <EmptyState title="Chưa có bản ghi nhiệt độ" />}
    </div>
  </div>
);
