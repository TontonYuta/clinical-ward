/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Tab Hồ Sơ Hành Chính & CCCD TT26 (<=200 LOC)
 */

import React from 'react';
import { PatientProfile } from '../../../services/patientService';

interface PatientAdminTabProps {
  patient: PatientProfile;
}

export const PatientAdminTab: React.FC<PatientAdminTabProps> = ({ patient }) => {
  return (
    <div role="tabpanel" className="grid grid-cols-1 lg:grid-cols-12 min-h-0 flex-1 overflow-y-auto lg:overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
      <div className="lg:col-span-7 xl:col-span-8 p-5 sm:p-6 overflow-y-auto thin-scrollbar space-y-5 bg-white">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
          Thông Tin Hành Chính &amp; Định Danh Theo Thông Tư 26/2025/TT-BYT
        </h3>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <dt className="text-slate-500">Mã Bệnh Nhân (Patient ID)</dt>
            <dd className="text-sm font-sans tabular-nums font-bold text-slate-900 mt-0.5">{patient.id}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Họ và tên đầy đủ</dt>
            <dd className="text-sm font-bold text-slate-900 mt-0.5">{patient.fullName}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Số Căn Cước Công Dân (CCCD 12 số)</dt>
            <dd className="text-sm font-sans tabular-nums font-bold text-slate-900 mt-0.5">{patient.cccd || '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Ngày sinh &amp; Tuổi</dt>
            <dd className="text-sm font-medium text-slate-900 mt-0.5">{patient.dob || '—'} ({patient.age} tuổi)</dd>
          </div>
          <div>
            <dt className="text-slate-500">Giới tính</dt>
            <dd className="text-sm font-medium text-slate-900 mt-0.5">{patient.gender}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Khoa lâm sàng điều trị</dt>
            <dd className="text-sm font-medium text-slate-900 mt-0.5">{patient.department || 'Khoa Cấp Cứu A9'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Buồng bệnh &amp; Số giường</dt>
            <dd className="text-sm font-semibold text-slate-900 mt-0.5">{patient.room}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Số điện thoại di động (Bệnh viện gửi thông tin)</dt>
            <dd className="text-sm font-sans tabular-nums font-bold text-slate-900 mt-0.5 flex items-center gap-2">
              <span>{patient.phone || 'Chưa cập nhật SĐT'}</span>
              {patient.phone && (
                <span className="text-2xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Đã kết nối SMS/Zalo
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Email nhận hồ sơ &amp; dặn dò</dt>
            <dd className="text-sm font-medium text-slate-900 mt-0.5">{patient.email || 'patient@hospital.vn'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Thời điểm nhập viện</dt>
            <dd className="text-sm font-sans tabular-nums text-slate-800 mt-0.5">{patient.admissionDate || '2026-10-24 01:15'}</dd>
          </div>
        </dl>
      </div>

      <div className="lg:col-span-5 xl:col-span-4 p-5 sm:p-6 bg-slate-50/70 border-t lg:border-t-0 lg:border-l border-slate-200 overflow-y-auto thin-scrollbar space-y-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Căn Cứ Pháp Lý Hồ Sơ Điện Tử</h3>
        <p className="text-xs text-slate-700 leading-relaxed">
          Hồ sơ bệnh nhân được quản lý bảo mật theo Luật Khám bệnh, chữa bệnh 2023 và quy chế kê đơn thuốc điện tử quốc gia Thông tư 26/2025/TT-BYT.
        </p>

        <div className="space-y-2 pt-3 border-t border-slate-200">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Dịch Vụ Gửi Tin Nhắn Y Tế Về Điện Thoại
          </h4>
          <p className="text-xs text-slate-600 leading-relaxed">
            Bệnh viện triển khai dịch vụ tự động gửi thông tin lâm sàng và hành chính về số điện thoại di động của người bệnh:
          </p>
          <ul className="space-y-1.5 text-xs text-slate-700">
            <li className="flex items-start gap-1.5">
              <span className="text-emerald-600 font-bold">✓</span>
              <span><strong>Mã đơn thuốc điện tử:</strong> Nhận link tra cứu đơn thuốc điện tử liên thông Cổng Quốc gia theo Thông tư 26/2025/TT-BYT.</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-emerald-600 font-bold">✓</span>
              <span><strong>Lịch dặn dò bác sĩ:</strong> Thông báo cữ uống thuốc sáng - trưa - tối và theo dõi phản ứng phụ tại nhà.</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-emerald-600 font-bold">✓</span>
              <span><strong>Viện phí &amp; Tái khám:</strong> Nhận thông báo xác nhận tạm ứng viện phí và lịch hẹn khám định kỳ.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
