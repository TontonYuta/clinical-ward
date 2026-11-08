/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Tab Hồ Sơ Người Bệnh & Đơn Thuốc Đang Điều Trị (<=200 LOC)
 */

import React from 'react';
import { PatientProfile } from '../../../services/patientService';
import { PrescriptionOrder } from '../../../types/cpoe';

interface PatientOverviewTabProps {
  patient: PatientProfile;
  relatedPrescriptions: PrescriptionOrder[];
  relatedDebts: any[];
  onOpenPrescriptionOrder?: (patient: PatientProfile) => void;
}

export const PatientOverviewTab: React.FC<PatientOverviewTabProps> = ({
  patient,
  relatedPrescriptions,
  relatedDebts,
  onOpenPrescriptionOrder,
}) => {
  return (
    <div role="tabpanel" className="grid grid-cols-1 lg:grid-cols-12 min-h-0 flex-1 overflow-y-auto lg:overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
      {/* Cột Trái: Thông tin điều trị & Đơn thuốc đang dùng */}
      <div className="lg:col-span-7 xl:col-span-8 p-5 sm:p-6 overflow-y-auto thin-scrollbar space-y-5 bg-white">
        {/* 1. Thông tin điều trị hiện tại */}
        <div className="space-y-2.5 pb-5 border-b border-slate-100">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Thông Tin Nhập Viện &amp; Phụ Trách Điều Trị
          </h3>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <dt className="text-slate-500">Khoa / Buồng / Giường bệnh</dt>
              <dd className="text-sm font-semibold text-slate-900 mt-0.5">{patient.room}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Khoa lâm sàng</dt>
              <dd className="text-sm font-semibold text-slate-900 mt-0.5">{patient.department || 'Khoa Cấp Cứu A9'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Bác sĩ phụ trách điều trị</dt>
              <dd className="text-sm font-semibold text-slate-900 mt-0.5">{patient.primaryDoctor || 'BS. Trần Văn Hùng (Khoa Cấp Cứu)'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Chẩn đoán tiếp nhận / lâm sàng</dt>
              <dd className="text-sm font-semibold text-slate-900 mt-0.5">{patient.diagnosis || 'Theo dõi điều trị nội trú'}</dd>
            </div>
          </dl>
        </div>

        {/* 2. Đơn Thuốc Đang Điều Trị */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Đơn Thuốc Điện Tử CPOE Đang Điều Trị ({relatedPrescriptions.length})
            </h3>
            {onOpenPrescriptionOrder && (
              <button
                type="button"
                onClick={() => onOpenPrescriptionOrder(patient)}
                className="text-xs font-bold text-teal-800 hover:text-teal-950 hover:underline cursor-pointer"
              >
                Kê đơn mới cho BN
              </button>
            )}
          </div>
          {relatedPrescriptions.length === 0 ? (
            <p className="text-sm text-slate-500">Hiện chưa có đơn thuốc nội trú/ngoại trú nào đang kích hoạt.</p>
          ) : (
            <div className="space-y-3">
              {relatedPrescriptions.map((order) => (
                <div key={order.id} className="space-y-1.5 pb-2.5 border-b border-slate-50 last:border-b-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-sans tabular-nums font-bold text-slate-900">{order.id}</span>
                      <span className="text-slate-500">{order.prescribedAt}</span>
                    </div>
                    <span className="font-semibold text-slate-700">[{order.diagnosisIcd10}] {order.diagnosisText}</span>
                  </div>
                  <div className="text-xs text-slate-700 leading-relaxed">
                    {order.items.map((it, idx) => (
                      <span key={it.id || idx}>
                        {it.medicationName} ({it.quantity} {it.unit})
                        {idx < order.items.length - 1 ? ' · ' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cột Phải: Định danh & Sổ nợ vỏ */}
      <div className="lg:col-span-5 xl:col-span-4 p-5 sm:p-6 bg-slate-50/70 border-t lg:border-t-0 lg:border-l border-slate-200 overflow-y-auto thin-scrollbar space-y-5">
        {/* Định danh CCCD */}
        <div className="space-y-2.5 pb-5 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Định Danh Công Dân</h3>
            <span className="font-sans text-xs font-bold text-teal-900 bg-teal-50 border border-teal-200/80 px-2.5 py-0.5 rounded-md shadow-2xs">
              TT 26/2025/TT-BYT
            </span>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <dt className="text-slate-500">Mã Bệnh Nhân</dt>
              <dd className="text-sm font-bold text-slate-900 font-sans tabular-nums mt-0.5">{patient.id}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Số CCCD / Mã ĐDCN</dt>
              <dd className="text-sm font-bold text-slate-900 font-sans tabular-nums mt-0.5">{patient.cccd || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Ngày sinh</dt>
              <dd className="text-sm font-medium text-slate-800 mt-0.5">{patient.dob || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Giới tính &amp; Tuổi</dt>
              <dd className="text-sm font-medium text-slate-800 mt-0.5">{patient.gender} · {patient.age} tuổi</dd>
            </div>
            <div>
              <dt className="text-slate-500">Số điện thoại</dt>
              <dd className="text-sm font-medium text-slate-800 mt-0.5 font-sans tabular-nums">{patient.phone || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Email</dt>
              <dd className="text-sm font-medium text-slate-800 mt-0.5 truncate">{patient.email || '—'}</dd>
            </div>
          </dl>
        </div>

        {/* Phiếu Nợ Cơ Số Tủ Trực (TT 20/2017) */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Nợ Cơ Số Tủ Trực Cấp Cứu</h3>
            <span className="text-xs font-semibold text-slate-700">{relatedDebts.length} khoản</span>
          </div>
          {relatedDebts.length === 0 ? (
            <p className="text-xs text-slate-500">Không có khoản nợ cơ số tủ trực hoặc nợ vỏ thuốc gây nghiện.</p>
          ) : (
            <div className="space-y-2 text-xs">
              {relatedDebts.map((debt) => (
                <div key={debt.id} className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-100 last:border-b-0">
                  <div>
                    <span className="font-sans tabular-nums font-bold text-slate-900">{debt.code}</span>
                    <span className="text-slate-700 ml-1.5">{debt.itemName} ({debt.quantity})</span>
                  </div>
                  <span className={`text-2xs font-bold px-1.5 py-0.5 rounded ${debt.status === 'debt' ? 'text-amber-800 bg-amber-50' : 'text-slate-600 bg-slate-100'}`}>
                    {debt.status === 'debt' ? 'Đang nợ' : 'Đã bù'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
