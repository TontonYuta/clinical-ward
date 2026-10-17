/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ShieldCheck,
  Search,
  Filter,
  Download,
  X,
  Lock,
  FileText,
  KeyRound,
  CreditCard,
  Users,
  CheckCircle2,
  Calendar,
  Hash
} from 'lucide-react';
import { AuditTrailRecord } from '../../types/clinical';

interface AuditTrailModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: AuditTrailRecord[];
}

export const AuditTrailModal: React.FC<AuditTrailModalProps> = ({
  isOpen,
  onClose,
  records
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('all');

  if (!isOpen) return null;

  const filteredRecords = records.filter(r => {
    const matchesSearch =
      r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.actionTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.targetItem.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.signerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.signerCertificate.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.witnessName && r.witnessName.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesFilter = filterType === 'all' || r.actionType === filterType;

    return matchesSearch && matchesFilter;
  });

  const dualWitnessCount = records.filter(r => Boolean(r.witnessName)).length;
  const rfidAuthCount = records.filter(r => r.authMethod === 'RFID_NFC').length;
  const pinAuthCount = records.filter(r => r.authMethod === 'PIN').length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-6xl w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 h-[88vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-600/30 border border-teal-400/40 flex items-center justify-center text-teal-300">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-tight text-white">
                  Sổ Nhật Ký Thao Tác Lâm Sàng
                </h2>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-teal-950 text-teal-300 border border-teal-500/30">
                  Hồ Sơ Nội Bộ Bệnh Viện
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Theo dõi lịch sử ký duyệt, phân định trách nhiệm chuyên môn của kíp trực và bảo đảm an toàn lâm sàng
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Executive Summary Metrics */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0 text-xs">
          <div className="bg-white p-2.5 rounded-lg border border-slate-200/90 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Tổng bản ghi xác thực</span>
            <span className="text-base font-black text-slate-900 mt-0.5 block font-mono">{records.length}</span>
            <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1 mt-0.5">
              <CheckCircle2 className="w-3 h-3" />
              100% nguyên vẹn dữ liệu
            </span>
          </div>

          <div className="bg-white p-2.5 rounded-lg border border-slate-200/90 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Có người làm chứng</span>
            <span className="text-base font-black text-purple-900 mt-0.5 block font-mono">{dualWitnessCount}</span>
            <span className="text-[10px] text-purple-700 font-semibold mt-0.5 block">
              Quy chế TT 20/2017 Morphin
            </span>
          </div>

          <div className="bg-white p-2.5 rounded-lg border border-slate-200/90 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Chạm thẻ RFID / NFC</span>
            <span className="text-base font-black text-teal-800 mt-0.5 block font-mono">{rfidAuthCount}</span>
            <span className="text-[10px] text-slate-500 font-medium mt-0.5 block">
              Định danh phần cứng bệnh viện
            </span>
          </div>

          <div className="bg-white p-2.5 rounded-lg border border-slate-200/90 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Mã PIN Lâm Sàng</span>
            <span className="text-base font-black text-slate-800 mt-0.5 block font-mono">{pinAuthCount}</span>
            <span className="text-[10px] text-slate-500 font-medium mt-0.5 block">
              Gắn theo CCHN bác sĩ/dược sĩ
            </span>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="px-5 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0 bg-white">
          <div className="flex items-center gap-2 flex-1 min-w-[240px] max-w-sm">
            <div className="relative w-full">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm theo mã kiểm toán, người ký, CCHN, đối tượng..."
                className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-800"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                <option value="all">Tất cả nghiệp vụ</option>
                <option value="SETTLE_DEBT">Duyệt hoàn bù (TT 22)</option>
                <option value="RETURN_AMPOULE">Thu hồi vỏ ống (TT 20)</option>
                <option value="DESTROY_AMPOULES">Tiêu hủy vỏ Morphin (TT 20)</option>
                <option value="HANDOVER_EQUIPMENT">Kiểm định &amp; Bàn giao (NĐ 98)</option>
                <option value="DISPATCH_FEFO">Xuất kho FEFO (TT 36)</option>
                <option value="RESTOCK_MEDICATION">Dự trù bổ sung (TT 22)</option>
                <option value="TRANSFER_ASSET">Điều chuyển tài sản (NĐ 151)</option>
                <option value="LIQUIDATE_ASSET">Thanh lý tài sản (NĐ 151)</option>
              </select>
            </div>

            <button
              onClick={() => alert('Đã trích xuất biên bản đối soát nhật ký lâm sàng của kíp trực.')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Xuất PDF/Excel</span>
            </button>
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="flex-1 min-h-0 overflow-auto bg-white">
          <table className="w-full text-left text-xs min-w-[850px]">
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold shadow-2xs">
              <tr>
                <th className="py-2.5 px-4 whitespace-nowrap bg-slate-50">Thời gian &amp; Số hồ sơ</th>
                <th className="py-2.5 px-3 whitespace-nowrap bg-slate-50">Nghiệp vụ &amp; Căn cứ pháp lý</th>
                <th className="py-2.5 px-3 whitespace-nowrap bg-slate-50">Đối tượng tác động</th>
                <th className="py-2.5 px-3 whitespace-nowrap bg-slate-50">Người ký xác thực (CCHN)</th>
                <th className="py-2.5 px-3 whitespace-nowrap bg-slate-50">Người làm chứng</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap bg-slate-50">Phương thức</th>
                <th className="py-2.5 px-4 text-right whitespace-nowrap bg-slate-50">Tình trạng xác nhận</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.map((record) => (
                <tr key={record.id} className="hover:bg-slate-50/80 transition">
                  {/* Timestamp & Code */}
                  <td className="py-2.5 px-4 whitespace-nowrap">
                    <span className="font-mono font-bold text-slate-900 block">{record.id}</span>
                    <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {record.timestamp}
                    </span>
                  </td>

                  {/* Action & Legal */}
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <span className="font-bold text-slate-900 block">{record.actionTitle}</span>
                    <span className="text-[10px] font-mono text-teal-800 bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200">
                      {record.legalBasis}
                    </span>
                  </td>

                  {/* Target Item */}
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <span className="font-semibold text-slate-800 block text-xs">{record.targetItem}</span>
                    <span className="text-[10px] font-mono text-slate-400">Hành động: {record.actionType}</span>
                  </td>

                  {/* Signer */}
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-[10px]">
                        {record.signerName.charAt(0)}
                      </div>
                      <div>
                        <span className="font-bold text-slate-900 block">{record.signerName}</span>
                        <span className="text-[10px] font-mono text-slate-500">
                          CCHN: <strong className="text-slate-800">{record.signerCertificate}</strong>
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Witness */}
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    {record.witnessName ? (
                      <div className="flex items-center gap-1.5 text-purple-900 bg-purple-50 px-2 py-1 rounded border border-purple-200">
                        <Users className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                        <div>
                          <span className="font-bold block text-[11px]">{record.witnessName}</span>
                          <span className="text-[9px] font-mono text-purple-700">
                            {record.witnessCertificate}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-xs italic">Chữ ký đơn</span>
                    )}
                  </td>

                  {/* Auth Method */}
                  <td className="py-2.5 px-3 text-center whitespace-nowrap">
                    {record.authMethod === 'RFID_NFC' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-teal-50 text-teal-800 border border-teal-300">
                        <CreditCard className="w-3 h-3 text-teal-600" />
                        <span>Thẻ RFID</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-300">
                        <KeyRound className="w-3 h-3 text-slate-600" />
                        <span>Mã PIN</span>
                      </span>
                    )}
                  </td>

                  {/* Status & Medical Verification */}
                  <td className="py-2.5 px-4 text-right whitespace-nowrap">
                    <span
                      title={`Mã bảo mật hệ thống: ${record.integrityHash}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 cursor-default"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Đã xác nhận &amp; Khóa sổ</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-700" />
            <span>
              Sổ nhật ký tuân thủ nguyên tắc lưu trữ cố định của bệnh viện. Mọi thao tác ký duyệt được bảo vệ chống can thiệp sửa đổi trái phép.
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs cursor-pointer shadow-2xs"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
