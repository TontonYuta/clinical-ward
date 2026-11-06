import React from 'react';
import { PatientProfile } from '../../../services/patientService';
export const PatientAdminTab: React.FC<{ patient: PatientProfile }> = ({ patient: p }) => (
  <div role="tabpanel" className="detail-overview-scroll">
    <div className="detail-info-grid">
      <section>
        <p className="section-kicker">Định danh</p>
        <dl className="detail-facts">
          {[
            ['Mã hồ sơ', p.id],
            ['Họ và tên', p.fullName],
            ['Ngày sinh', p.dob],
            ['Giới tính', p.gender],
            ['Định danh (nếu có)', p.cccd],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value || 'Chưa ghi nhận'}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section>
        <p className="section-kicker">Liên hệ & tiếp nhận</p>
        <dl className="detail-facts">
          {[
            ['Điện thoại', p.phone],
            ['Email', p.email],
            ['Khoa điều trị', p.department],
            ['Buồng / giường', p.room],
            ['Thời điểm nhập viện', p.admissionDate],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value || 'Chưa ghi nhận'}</dd>
            </div>
          ))}
        </dl>
        <p className="record-sub mt-6">
          Kiểm tra người nhận và thông tin liên hệ trước khi gửi dữ liệu y tế.
        </p>
      </section>
    </div>
  </div>
);
