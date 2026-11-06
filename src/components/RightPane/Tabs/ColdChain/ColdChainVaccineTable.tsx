import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { VaccineBatchItem } from '../../../../types/clinical';
import { PrintableFormType } from '../../../Modals/PrintableFormModal';
import { EmptyState } from '../../../ui/Workspace';
import { vaccineState } from '../../../ui/workspaceStatus';
interface ColdChainVaccineTableProps {
  vaccines: VaccineBatchItem[];
  isQuarantined: boolean;
  onSelectVaccine: (v: VaccineBatchItem) => void;
  onOpenPrintForm?: (f: PrintableFormType) => void;
}
export const ColdChainVaccineTable: React.FC<ColdChainVaccineTableProps> = ({
  vaccines,
  isQuarantined,
  onSelectVaccine,
}) => (
  <div className="workspace-list desktop-records">
    <div className="list-caption">
      <strong>
        Vắc xin & sinh phẩm <span className="record-mono">/ {vaccines.length}</span>
      </strong>
      <span>Điều kiện bảo quản theo từng sản phẩm</span>
    </div>
    <div className="workspace-table-scroll">
      <table className="workspace-table">
        <colgroup>
          <col style={{ width: '30%' }} />
          <col style={{ width: '20%' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '20%' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '6%' }} />
        </colgroup>
        <thead>
          <tr>
            <th>Sinh phẩm</th>
            <th>Lô / Hạn dùng</th>
            <th>Tồn kho</th>
            <th>Bảo quản</th>
            <th>Chú ý</th>
            <th>
              <span className="sr-only">Chi tiết</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {vaccines.map((item) => {
            const state = vaccineState(item, isQuarantined);
            return (
              <tr key={item.id} data-workspace-record>
                <td>
                  <button
                    type="button"
                    className="record-link"
                    onClick={() => onSelectVaccine(item)}
                  >
                    {item.name}
                  </button>
                  <span className="record-sub">{item.manufacturer}</span>
                </td>
                <td>
                  <span className="record-mono">{item.batchNumber}</span>
                  <span className="record-sub">HD: {item.expiryDate}</span>
                </td>
                <td>
                  <strong>{item.quantity.toLocaleString('vi-VN')}</strong>
                  <span className="record-sub">{item.unit}</span>
                </td>
                <td>
                  <span className="text-[.72rem] leading-relaxed">{item.storageCondition}</span>
                </td>
                <td>
                  <span className={`status-pill ${state.tone}`}>{state.label}</span>
                </td>
                <td>
                  <button
                    type="button"
                    className="icon-action"
                    aria-label={`Xem ${item.name}`}
                    onClick={() => onSelectVaccine(item)}
                  >
                    <ArrowUpRight size={16} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!vaccines.length && <EmptyState title="Không tìm thấy sinh phẩm" />}
    </div>
  </div>
);
