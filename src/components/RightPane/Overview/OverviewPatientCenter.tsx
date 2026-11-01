/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Trung Tâm Thông Tin Bệnh Nhân Lâm Sàng (<=200 LOC)
 */

import React, { useState } from 'react';
import { User, Search, ShieldAlert, HeartPulse, Activity, AlertTriangle, ArrowRight, Stethoscope } from 'lucide-react';
import { INITIAL_PATIENTS } from '../../../services/patientService';
import { normalizeLookupQuery } from '../flatDashboardModel';

interface OverviewPatientCenterProps {
  canSearch: boolean;
  onOpenPatient: (query: string) => void;
}

export const OverviewPatientCenter: React.FC<OverviewPatientCenterProps> = ({
  canSearch,
  onOpenPatient
}) => {
  const [query, setQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = normalizeLookupQuery(query);
    if (clean) onOpenPatient(clean);
  };

  const samplePatients = INITIAL_PATIENTS.slice(0, 3);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs space-y-4">
      {/* 1. Header & Thanh Tìm Kiếm Bệnh Nhân */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-teal-50 text-teal-700">
              <User className="w-4 h-4" />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
              Thông Tin Bệnh Nhân &amp; Giám Sát Lâm Sàng
            </h3>
            <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-teal-100/70 text-teal-800">
              {INITIAL_PATIENTS.length} Hồ Sơ
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Theo dõi tiền sử dị ứng, chức năng thận (eGFR) và y lệnh dùng thuốc của người bệnh.
          </p>
        </div>

        {canSearch && (
          <form onSubmit={handleSearch} className="flex items-center gap-2 w-full sm:w-80 shrink-0">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Mã BN (BN-8820) hoặc họ tên..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-600 focus:border-teal-600 transition"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white rounded-xl transition cursor-pointer shadow-2xs shrink-0"
            >
              Mở hồ sơ
            </button>
          </form>
        )}
      </div>

      {/* 2. Chỉ số tóm tắt an toàn người bệnh */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
          <div className="text-2xs font-semibold text-slate-500 uppercase">Bệnh nhân nội trú theo dõi</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-slate-900">{INITIAL_PATIENTS.length}</span>
            <span className="text-2xs text-slate-500">người bệnh</span>
          </div>
        </div>
        <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-200">
          <div className="text-2xs font-semibold text-rose-800 uppercase flex items-center gap-1">
            <ShieldAlert className="w-3 h-3 text-rose-600" />
            <span>Có tiền sử dị ứng thuốc</span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-rose-900">
              {INITIAL_PATIENTS.filter((p) => p.allergies && !p.allergies.toLowerCase().includes('không')).length}
            </span>
            <span className="text-2xs text-rose-700">Penicillin, NSAID, Sulfamid</span>
          </div>
        </div>
        <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200">
          <div className="text-2xs font-semibold text-amber-800 uppercase flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            <span>Suy giảm eGFR (&lt; 60 mL/min)</span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-amber-900">
              {INITIAL_PATIENTS.filter((p) => p.egfr && p.egfr < 60).length}
            </span>
            <span className="text-2xs text-amber-700">Cần hiệu chỉnh liều thận</span>
          </div>
        </div>
      </div>

      {/* 3. Danh sách hồ sơ bệnh nhân trọng điểm */}
      <div className="space-y-2">
        <div className="text-2xs font-bold text-slate-500 uppercase tracking-wider">
          Hồ Sơ Bệnh Nhân Lâm Sàng Trọng Điểm Trong Khoa
        </div>
        <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden bg-slate-50/30">
          {samplePatients.map((p) => {
            const hasAllergy = p.allergies && !p.allergies.toLowerCase().includes('không');
            const isRenalRisk = p.egfr && p.egfr < 60;
            return (
              <div
                key={p.id}
                className="p-3 hover:bg-slate-50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => onOpenPatient(p.fullName || p.id)}
                      className="font-bold text-slate-900 hover:text-teal-700 hover:underline cursor-pointer text-sm"
                    >
                      {p.fullName}
                    </button>
                    <span className="font-mono text-2xs font-bold px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-800">
                      {p.id}
                    </span>
                    <span className="text-slate-500">
                      {p.gender} · {p.age} tuổi · {p.room}
                    </span>
                  </div>
                  <div className="text-slate-600 flex items-center gap-3 flex-wrap text-2xs">
                    <span>Chẩn đoán: <strong className="text-slate-800">{p.diagnosis || p.chronicConditions}</strong></span>
                    {hasAllergy && (
                      <span className="font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                        Dị ứng: {p.allergies}
                      </span>
                    )}
                    {isRenalRisk && (
                      <span className="font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                        eGFR: {p.egfr} mL/min (Hiệu chỉnh liều)
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenPatient(p.fullName || p.id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-2xs font-bold rounded-lg bg-white border border-slate-300 hover:border-teal-400 hover:bg-teal-50 text-slate-700 hover:text-teal-900 transition cursor-pointer self-start sm:self-auto shrink-0 shadow-2xs"
                >
                  <span>Xem hồ sơ</span>
                  <ArrowRight className="w-3 h-3 text-slate-400" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
