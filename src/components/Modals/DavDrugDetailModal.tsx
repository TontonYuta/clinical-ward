/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Modal Giấy Công Bố Thuốc Hành Chính - Đồng bộ CSDL Cục Quản Lý Dược (<=200 LOC)
 */

import React from 'react';
import { X, ExternalLink, ShieldCheck, Building2, Package, CheckCircle2, ArrowUpRight } from 'lucide-react';
import { InventoryBatch } from '../../types/pharmacy';

interface DavDrugDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  batch: InventoryBatch | null;
  onQuickDispatch?: (batch: InventoryBatch) => void;
}

export const DavDrugDetailModal: React.FC<DavDrugDetailModalProps> = ({
  isOpen, onClose, batch, onQuickDispatch,
}) => {
  if (!isOpen || !batch) return null;

  const sdk = batch.registrationNumber || batch.nationalCode || 'Chưa cập nhật';
  const davPortalUrl = `https://dichvucong.dav.gov.vn/congbothuoc/index?search=${encodeURIComponent(sdk)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header Hành chính Cục QLD */}
        <div className="bg-gradient-to-r from-teal-900 to-teal-800 text-white px-5 py-3.5 flex items-center justify-between shrink-0 border-b border-teal-950/20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-700/50 flex items-center justify-center border border-teal-500/40 shrink-0">
              <ShieldCheck className="w-5 h-5 text-teal-200" />
            </div>
            <div>
              <p className="text-2xs font-semibold uppercase tracking-wider text-teal-200">Bộ Y Tế • Cục Quản Lý Dược</p>
              <h2 className="text-sm sm:text-base font-bold text-white leading-tight">Thông Tin Công Bố Thuốc Lưu Hành</h2>
            </div>
          </div>
          <button onClick={onClose} className="text-teal-200 hover:text-white p-1 rounded-lg hover:bg-teal-700/50 transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Thân thông tin hành chính */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs sm:text-sm text-slate-700">
          {/* Banner tên & SĐK */}
          <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200/80">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <span className="font-mono text-2xs font-bold text-teal-900 bg-teal-100/70 border border-teal-200 px-2 py-0.5 rounded">
                  SĐK: {sdk}
                </span>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-1">{batch.itemName}</h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  <span className="font-semibold text-slate-700">Hoạt chất:</span> {batch.activeIngredient || 'Theo hồ sơ Cục QLD'}
                  {batch.concentration && <span className="font-semibold ml-1">({batch.concentration})</span>}
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-2xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Đã đồng bộ Cục QLD</span>
              </div>
            </div>
          </div>

          {/* Bảng thuộc tính công bố chuẩn DAV */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 border border-slate-200 rounded-lg p-3 bg-white">
            <div className="space-y-0.5 border-b sm:border-b-0 sm:border-r border-slate-100 pb-2 sm:pb-0 sm:pr-3">
              <span className="text-2xs uppercase font-bold text-slate-500">Dạng bào chế</span>
              <p className="font-medium text-slate-900">{batch.dosageForm || 'Viên nén / Dung dịch'}</p>
            </div>
            <div className="space-y-0.5 border-b sm:border-b-0 pb-2 sm:pb-0 sm:pl-1">
              <span className="text-2xs uppercase font-bold text-slate-500">Quy cách đóng gói</span>
              <p className="font-medium text-slate-900">{batch.packagingSpec || 'Theo tiêu chuẩn nhà sản xuất'}</p>
            </div>
            <div className="space-y-0.5 border-b sm:border-b-0 sm:border-r border-slate-100 pb-2 sm:pb-0 sm:pr-3 pt-1">
              <span className="text-2xs uppercase font-bold text-slate-500">Đường dùng & Tiêu chuẩn</span>
              <p className="font-medium text-slate-900">
                {batch.route || 'Đường dùng quy định'} • {batch.standardPharmacopeia || 'DĐVN V'}
              </p>
            </div>
            <div className="space-y-0.5 pb-1 sm:pl-1 pt-1">
              <span className="text-2xs uppercase font-bold text-slate-500">Phân loại quản lý</span>
              <p className="font-medium text-slate-900">
                {batch.category} {batch.isControlledSubstance && '• Kiểm soát đặc biệt'}
              </p>
            </div>
          </div>

          {/* Cơ sở sản xuất */}
          <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <Building2 className="w-5 h-5 text-slate-500 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-2xs uppercase font-bold text-slate-500">Cơ sở sản xuất & Xuất xứ</p>
              <p className="font-semibold text-slate-900 truncate">
                {batch.manufacturer || 'Công ty Dược phẩm'}
                {batch.country && <span className="text-slate-600 font-normal"> ({batch.country})</span>}
              </p>
            </div>
          </div>

          {/* Trạng thái kho bệnh viện thực tế */}
          <div className="border border-slate-200 rounded-lg p-3 bg-white space-y-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
                <Package className="w-4 h-4 text-teal-700" />
                <span>Trạng thái Lô tại Bệnh Viện (Quản trị FEFO)</span>
              </div>
              <span className="font-mono text-2xs font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">
                Lô: {batch.batchNumber}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="bg-slate-50 p-2 rounded">
                <span className="text-2xs text-slate-500 block">Hạn dùng</span>
                <span className="font-mono font-bold text-slate-900">{batch.expiryDate}</span>
                <span className={`text-2xs block ${batch.daysLeft <= 60 ? 'text-rose-600 font-bold' : 'text-slate-500'}`}>
                  (Còn {batch.daysLeft} ngày)
                </span>
              </div>
              <div className="bg-slate-50 p-2 rounded">
                <span className="text-2xs text-slate-500 block">Tồn thực tế</span>
                <span className="font-mono font-bold text-slate-900">{batch.currentStock} {batch.unit}</span>
                <span className="text-2xs text-slate-500 block">Min: {batch.minThreshold}</span>
              </div>
              <div className="bg-slate-50 p-2 rounded col-span-2">
                <span className="text-2xs text-slate-500 block">Vị trí lưu trữ</span>
                <span className="font-medium text-slate-800 line-clamp-2">{batch.warehouseLocation}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer thao tác */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <a
            href={davPortalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800 hover:text-teal-950 hover:underline"
          >
            <span>Đối soát trực tiếp Cục QLD</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
            >
              Đóng
            </button>
            {onQuickDispatch && (
              <button
                onClick={() => { onQuickDispatch(batch); onClose(); }}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-teal-800 hover:bg-teal-900 text-white text-xs font-bold cursor-pointer shadow-xs"
              >
                <span>Xuất FEFO</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
