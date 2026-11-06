import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { VaccineBatchItem } from '../../../../types/clinical';
import { PrintableFormType } from '../../../Modals/PrintableFormModal';
import { vaccineState } from '../../../ui/workspaceStatus';
interface ColdChainVaccineCardProps {
  item: VaccineBatchItem;
  index: number;
  isQuarantined: boolean;
  onSelectVaccine: (v: VaccineBatchItem) => void;
  onOpenPrintForm?: (f: PrintableFormType) => void;
}
export const ColdChainVaccineCard: React.FC<ColdChainVaccineCardProps> = ({
  item,
  isQuarantined,
  onSelectVaccine,
}) => {
  const state = vaccineState(item, isQuarantined);
  return (
    <article className="mobile-record" data-workspace-record>
      <div className="mobile-record-heading">
        <button type="button" className="record-link" onClick={() => onSelectVaccine(item)}>
          {item.name}
        </button>
        <span className={`status-pill shrink-0 ${state.tone}`}>{state.label}</span>
      </div>
      <span className="record-sub">{item.storageCondition}</span>
      <div className="mobile-record-meta">
        <div>
          <span className="record-mono">{item.batchNumber}</span>
          <span className="record-sub">
            HD: {item.expiryDate} · {item.quantity} {item.unit}
          </span>
        </div>
        <button
          type="button"
          className="icon-action shrink-0"
          aria-label={`Xem ${item.name}`}
          onClick={() => onSelectVaccine(item)}
        >
          <ArrowUpRight size={16} />
        </button>
      </div>
    </article>
  );
};
