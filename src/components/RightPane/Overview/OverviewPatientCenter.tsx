import React, { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { PatientProfile } from '../../../services/patientService';
import { SearchField } from '../../ui/Workspace';
interface OverviewPatientCenterProps {
  canSearch: boolean;
  onOpenPatient: (query: string) => void;
  patients: PatientProfile[];
}
const normalize = (s: string) =>
  s
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim();
export const OverviewPatientCenter: React.FC<OverviewPatientCenterProps> = ({
  canSearch,
  onOpenPatient,
  patients,
}) => {
  const [query, setQuery] = useState('');
  if (!canSearch) return null;
  const q = normalize(query);
  const matches = q
    ? patients.filter((p) => normalize(`${p.fullName} ${p.id} ${p.room}`).includes(q))
    : [];
  return (
    <section className="overview-patient-lookup" aria-label="Tìm hồ sơ người bệnh">
      <div className="flex items-center gap-4 flex-wrap">
        <h2 className="text-sm font-semibold">Tìm hồ sơ người bệnh</h2>
        <SearchField
          value={query}
          onChange={setQuery}
          label="Tìm người bệnh"
          placeholder="Họ tên, mã hồ sơ hoặc buồng giường…"
        />
      </div>
      {q && (
        <div className="patient-lookup-results">
          {matches.length ? (
            matches.map((p) => (
              <button type="button" key={p.id} onClick={() => onOpenPatient(p.id)}>
                <div>
                  <strong>{p.fullName}</strong>
                  <span>
                    {p.id} · {p.room}
                  </span>
                </div>
                <ArrowUpRight size={17} />
              </button>
            ))
          ) : (
            <p className="record-sub py-3">Không tìm thấy người bệnh phù hợp.</p>
          )}
        </div>
      )}
    </section>
  );
};
