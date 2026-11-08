/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Hướng Dẫn Vận Hành Lâm Sàng & Quản Lý Kho Bệnh Viện
 * Bố cục Flat Workstation Chuẩn Y Tế: Zero-box, Top Underline Tabs, Bố Cục Trái - Phải Phẳng, Không Dấu Chấm
 */

import React, { useState } from 'react';
import {
  X,
  BookOpen,
  Clock,
  FileText,
  Boxes,
  Wrench,
  Bot,
  ShieldCheck,
  AlertCircle,
  Download,
  Eye,
  EyeOff,
  Activity,
  CheckCircle2,
  ShieldAlert,
  HelpCircle,
  Info
} from 'lucide-react';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import { stripLeadingBullets } from '../../utils/clinicalFormatter';

interface UserGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export type GuideTabId =
  | 'shift_workflow'
  | 'cpoe_safety'
  | 'pharmacy_stock'
  | 'equipment_incident'
  | 'clinical_ai';

interface GuideTabMeta {
  id: GuideTabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const GUIDE_TABS: GuideTabMeta[] = [
  { id: 'shift_workflow', label: 'Quy trình ca trực & Ký số', icon: Clock },
  { id: 'cpoe_safety', label: 'Kê đơn CPOE & An toàn', icon: FileText },
  { id: 'pharmacy_stock', label: 'Kho Dược & Tủ trực', icon: Boxes },
  // Tạm thời comment hướng dẫn TBYT theo yêu cầu người dùng
  // { id: 'equipment_incident', label: 'Thiết bị Y tế & Sự cố', icon: Wrench },
  { id: 'clinical_ai', label: 'Trợ lý AI Lâm sàng', icon: Bot },
];

export const UserGuideModal: React.FC<UserGuideModalProps> = ({ isOpen, onClose }) => {
  useModalDismiss(isOpen, onClose);
  const [activeTab, setActiveTab] = useState<GuideTabId>('shift_workflow');
  const [showPinCodes, setShowPinCodes] = useState<boolean>(false);

  if (!isOpen) return null;

  const downloadUserGuideMarkdown = () => {
    const guideText = `# CẨM NANG VẬN HÀNH LÂM SÀNG & QUẢN LÝ KHO DƯỢC BỆNH VIỆN
## HỆ THỐNG QUẢN LÝ KHO DƯỢC, VẬT TƯ, TỦ TRỰC & THIẾT BỊ Y TẾ

1. QUY TRÌNH CA TRỰC & KÝ SỐ LÂM SÀNG
- Mượn trả cơ số tủ trực ca đêm: Căn cứ Thông tư 22/2011/TT-BYT & Điều 15 Thông tư 20/2017/TT-BYT.
- Hoàn bù cơ số theo đơn thuốc của bác sĩ trước 07:00 sáng.
- Ký số xác thực mã PIN chuyên môn gắn liền CCHN theo Nghị định 130/2018/NĐ-CP.

2. KÊ ĐƠN THUỐC CPOE & HỆ THỐNG AN TOÀN CDSS
- Kê đơn ngoại trú / nội trú điện tử: Căn cứ Thông tư 26/2025/TT-BYT.
- Rà soát tiền sử dị ứng & dị ứng chéo: Căn cứ Thông tư 51/2017/TT-BYT.
- Cảnh báo tương tác thuốc DDI: Căn cứ Quyết định 5948/QĐ-BYT.
- Hiệu chỉnh liều theo chức năng thận (eGFR / CrCl): Căn cứ Hướng dẫn KDIGO 2024.

3. KHO DƯỢC FEFO & TỦ TRỰC LÂM SÀNG
- Nguyên tắc xuất kho cận hạn trước (FEFO): Căn cứ Thông tư 36/2018/TT-BYT (GSP).
- Bổ sung cơ số khi chạm ngưỡng tồn kho tối thiểu (Min Threshold).
- Thu hồi vỏ ống Morphin & Hội đồng tiêu hủy vỏ thuốc gây nghiện theo Mẫu 10 TT 20/2017.

4. TRANG THIẾT BỊ Y TẾ & BÀN GIAO KỸ THUẬT
- Báo hỏng khẩn cấp máy thở / monitor buồng bệnh.
- Đo kiểm định an toàn điện y tế IEC 60601-1 trước khi đưa vào sử dụng.
- Biên bản nghiệm thu bàn giao 2 bên: Căn cứ Điều 34, 55 Nghị định 98/2021/NĐ-CP & NĐ 07/2023.

5. TRỢ LÝ AI LÂM SÀNG (CDSS COPILOT)
- Tra cứu Dược thư Quốc gia Việt Nam 2015 và CSDL 54.885 biệt dược DAV.
- AI đóng vai trò hỗ trợ gợi ý; mọi thao tác xuất kho và kê đơn bắt buộc người dùng xác thực PIN.`;

    const blob = new Blob([guideText], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Cam_Nang_Van_Hanh_Lam_Sang.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4 md:p-6 animate-in fade-in duration-150">
      <div className="bg-white sm:rounded-lg rounded-none shadow-xl border sm:border-slate-200 border-none w-full h-full sm:h-[90vh] sm:max-h-[90vh] sm:max-w-5xl flex flex-col overflow-hidden">
        {/* Header - Workstation Bar */}
        <div className="h-14 sm:h-16 px-4 sm:px-6 bg-white border-b border-slate-200 text-slate-900 flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-md bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                Hướng Dẫn Vận Hành Lâm Sàng
              </h2>
              <p className="text-xs text-slate-500 font-sans truncate">
                Quy chuẩn Ca trực · CPOE · Kho Dược · Thiết bị · AI CDSS
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer flex items-center justify-center shrink-0 active:scale-95"
            title="Đóng cửa sổ"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Underline Tabs - Workstation Standard */}
        <div
          role="tablist"
          className="flex items-center gap-1 border-b border-slate-200 px-4 sm:px-6 bg-slate-50/70 overflow-x-auto shrink-0 scrollbar-none"
        >
          {GUIDE_TABS.map((tab) => {
            const isSelected = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isSelected}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 px-3.5 py-2.5 border-b-2 shrink-0 font-medium cursor-pointer transition-colors text-sm whitespace-nowrap ${
                  isSelected
                    ? 'border-teal-700 text-teal-950 font-semibold'
                    : 'border-transparent text-slate-600 hover:text-slate-950'
                }`}
              >
                <Icon className={`w-4 h-4 ${isSelected ? 'text-teal-700' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body: Left-Right Workstation Split (Zero-Box, Flat, Divide-x) */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {/* TAB 1: QUY TRÌNH CA TRỰC & KÝ SỐ */}
          {activeTab === 'shift_workflow' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 h-full min-h-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
              {/* Cột Trái: Quy trình vận hành cốt lõi */}
              <div className="lg:col-span-7 xl:col-span-8 p-5 sm:p-6 overflow-y-auto thin-scrollbar space-y-6 bg-white">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                    Quy Trình Vận Hành Ca Trực Lâm Sàng
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Thực hiện theo Thông tư 22/2011/TT-BYT và Thông tư 20/2017/TT-BYT Bộ Y Tế
                  </p>
                </div>

                <div className="space-y-5 text-sm">
                  {/* Bước 1 */}
                  <div className="space-y-1.5 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-2 text-slate-950 font-bold">
                      <span className="w-5 h-5 rounded-full bg-teal-700 text-white flex items-center justify-center text-xs shrink-0 font-sans font-bold">1</span>
                      <h4>Bàn giao & Tiếp nhận ca trực (07:00 / 19:00)</h4>
                    </div>
                    <p className="text-slate-600 leading-relaxed pl-7">
                      Điều dưỡng và bác sĩ hai ca trực đối soát số lượng tồn thuốc thực tế tại tủ trực buồng bệnh, kiểm tra niêm phong hộp chống sốc phản vệ và rà soát các phiếu nợ thuốc chưa hoàn bù.
                    </p>
                  </div>

                  {/* Bước 2 */}
                  <div className="space-y-1.5 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-2 text-slate-950 font-bold">
                      <span className="w-5 h-5 rounded-full bg-teal-700 text-white flex items-center justify-center text-xs shrink-0 font-sans font-bold">2</span>
                      <h4>Mượn khẩn thuốc / vật tư ca đêm</h4>
                    </div>
                    <p className="text-slate-600 leading-relaxed pl-7">
                      Tại phân hệ <strong>Sổ Nợ Tủ Trực</strong>, nhấn nút <strong>+ Lập Phiếu Mượn Khẩn</strong>. Chọn thuốc cấp cứu, số lượng, buồng bệnh và bác sĩ chỉ định. Nhập mã PIN cá nhân để hoàn tất ký số xuất thuốc khẩn.
                    </p>
                  </div>

                  {/* Bước 3 */}
                  <div className="space-y-1.5 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-2 text-slate-950 font-bold">
                      <span className="w-5 h-5 rounded-full bg-teal-700 text-white flex items-center justify-center text-xs shrink-0 font-sans font-bold">3</span>
                      <h4>Hoàn bù cơ số & Tự động trừ kho Dược FEFO</h4>
                    </div>
                    <p className="text-slate-600 leading-relaxed pl-7">
                      Bác sĩ kê đơn thuốc hoàn bù cho bệnh nhân trước 07:00 sáng. Điều dưỡng bấm <strong>Hoàn bù cơ số</strong>, xác thực mã PIN để ghi nhận trả nợ; hệ thống tự động trừ kho Dược theo lô cận hạn nhất (FEFO).
                    </p>
                  </div>

                  {/* Bước 4 */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-slate-950 font-bold">
                      <span className="w-5 h-5 rounded-full bg-teal-700 text-white flex items-center justify-center text-xs shrink-0 font-sans font-bold">4</span>
                      <h4>Ký số chuyên môn & Sổ nhật ký kiểm toán bất biến</h4>
                    </div>
                    <p className="text-slate-600 leading-relaxed pl-7">
                      Mọi giao dịch cấp phát thuốc, kê đơn và kiểm định thiết bị đều yêu cầu xác thực mã PIN gắn với CCHN (Nghị định 130/2018/NĐ-CP). Toàn bộ lịch sử được khóa sổ bảo mật với mã băm SHA-256 trong Sổ Kiểm Toán.
                    </p>
                  </div>
                </div>
              </div>

              {/* Cột Phải: Tra cứu chức danh & Mã PIN ca trực */}
              <div className="lg:col-span-5 xl:col-span-4 p-5 sm:p-6 bg-slate-50/70 overflow-y-auto thin-scrollbar space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Danh Bạ Ca Trực & Mã PIN
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">Xác thực chứng chỉ hành nghề y tế</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPinCodes((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-100 transition cursor-pointer"
                  >
                    {showPinCodes ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showPinCodes ? 'Ẩn' : 'Hiện PIN'}</span>
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  {/* Điều dưỡng */}
                  <div className="space-y-1 pb-3 border-b border-slate-200/80">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">1. Điều Dưỡng Ca Trực</span>
                      <span className="font-sans tabular-nums font-bold bg-white px-2 py-0.5 border border-slate-200 rounded text-slate-800">
                        PIN: {showPinCodes ? '1111' : '••••'}
                      </span>
                    </div>
                    <p className="text-slate-600">ĐD. Lê Thị Thu · CCHN: 004812/HN-CCHN</p>
                    <p className="text-slate-500">Quyền hạn: Mượn thuốc khẩn ca đêm, thu hồi vỏ ống Morphin.</p>
                  </div>

                  {/* Bác sĩ */}
                  <div className="space-y-1 pb-3 border-b border-slate-200/80">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">2. Bác Sĩ Điều Trị</span>
                      <span className="font-sans tabular-nums font-bold bg-white px-2 py-0.5 border border-slate-200 rounded text-slate-800">
                        PIN: {showPinCodes ? '4444' : '••••'}
                      </span>
                    </div>
                    <p className="text-slate-600">BS. Trần Văn Hùng · CCHN: 009125/BYT-CCHN</p>
                    <p className="text-slate-500">Quyền hạn: Kê đơn CPOE, ký hoàn bù cơ số, nghiệm thu TBYT.</p>
                  </div>

                  {/* Dược sĩ */}
                  <div className="space-y-1 pb-3 border-b border-slate-200/80">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">3. Dược Sĩ Kho Dược</span>
                      <span className="font-sans tabular-nums font-bold bg-white px-2 py-0.5 border border-slate-200 rounded text-slate-800">
                        PIN: {showPinCodes ? '2222' : '••••'}
                      </span>
                    </div>
                    <p className="text-slate-600">DS. Nguyễn Bích Ngọc · CCHN: 018234/BYT-CCHN</p>
                    <p className="text-slate-500">Quyền hạn: Xuất kho FEFO, lập dự trù bổ sung, chủ trì hủy vỏ Morphin.</p>
                  </div>

                  {/* Kỹ sư */}
                  <div className="space-y-1 pb-3 border-b border-slate-200/80">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">4. Kỹ Sư TBYT</span>
                      <span className="font-sans tabular-nums font-bold bg-white px-2 py-0.5 border border-slate-200 rounded text-slate-800">
                        PIN: {showPinCodes ? '3333' : '••••'}
                      </span>
                    </div>
                    <p className="text-slate-600">KS. Đặng Văn Nam · Mã: BME-204/VTYT</p>
                    <p className="text-slate-500">Quyền hạn: Tiếp nhận sửa chữa, đo dòng rò điện, ký bàn giao NĐ 98.</p>
                  </div>

                  {/* Giám đốc */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">5. Ban Giám Đốc</span>
                      <span className="font-sans tabular-nums font-bold bg-white px-2 py-0.5 border border-slate-200 rounded text-slate-800">
                        PIN: {showPinCodes ? '9999' : '••••'}
                      </span>
                    </div>
                    <p className="text-slate-600">TS.BS. Nguyễn Văn An · CCHN: 001002/BYT-CCHN</p>
                    <p className="text-slate-500">Quyền hạn: Toàn quyền hệ thống, phê duyệt bổ sung danh mục và thanh lý TS.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: KÊ ĐƠN CPOE & AN TOÀN NGƯỜI BỆNH */}
          {activeTab === 'cpoe_safety' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 h-full min-h-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
              {/* Cột Trái: Quy trình kê đơn & CDSS */}
              <div className="lg:col-span-7 xl:col-span-8 p-5 sm:p-6 overflow-y-auto thin-scrollbar space-y-6 bg-white">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                    Kê Đơn Thuốc CPOE & Hệ Thống CDSS Cảnh Báo An Toàn
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Tuân thủ Thông tư 26/2025/TT-BYT và các hướng dẫn an toàn dùng thuốc Bộ Y Tế
                  </p>
                </div>

                <div className="space-y-5 text-sm">
                  {/* Mục 1 */}
                  <div className="space-y-1.5 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-2 text-slate-950 font-bold">
                      <span className="w-5 h-5 rounded-full bg-teal-700 text-white flex items-center justify-center text-xs shrink-0 font-sans font-bold">1</span>
                      <h4>Lập đơn thuốc CPOE điện tử theo Thông tư 26/2025</h4>
                    </div>
                    <p className="text-slate-600 leading-relaxed pl-7">
                      Vào tab <strong>Kê Đơn Thuốc (CPOE)</strong>, chọn bệnh nhân từ danh sách điều trị. Nhập chẩn đoán ICD-10 (hỗ trợ Smart Macros gõ tắt như THA, DTĐ, COPD), chọn thuốc từ danh mục hoạt chất quốc gia và đường dùng chuẩn.
                    </p>
                  </div>

                  {/* Mục 2 */}
                  <div className="space-y-1.5 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-2 text-rose-800 font-bold">
                      <span className="w-5 h-5 rounded-full bg-rose-700 text-white flex items-center justify-center text-xs shrink-0 font-sans font-bold">2</span>
                      <h4>Rà soát tiền sử dị ứng theo Thông tư 51/2017</h4>
                    </div>
                    <p className="text-slate-600 leading-relaxed pl-7">
                      Hệ thống tự động đối chiếu tiền sử dị ứng đã ghi nhận trong hồ sơ bệnh án. Khi phát hiện thuốc kê có nguy cơ dị ứng chéo (ví dụ: dị ứng Penicillin đối với nhóm Cephalosporin), hệ thống cảnh báo chặn kê đơn ngay lập tức.
                    </p>
                  </div>

                  {/* Mục 3 */}
                  <div className="space-y-1.5 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-2 text-amber-800 font-bold">
                      <span className="w-5 h-5 rounded-full bg-amber-700 text-white flex items-center justify-center text-xs shrink-0 font-sans font-bold">3</span>
                      <h4>Cảnh báo tương tác thuốc DDI nghiêm trọng (Quyết định 5948)</h4>
                    </div>
                    <p className="text-slate-600 leading-relaxed pl-7">
                      CDSS chủ động phát hiện các cặp tương tác chống chỉ định tuyệt đối (ví dụ: Ceftriaxon phối hợp dịch truyền Ringer Lactat có Calci gây tủa; phối hợp đồng thời Opioid và Benzodiazepin gây ức chế hô hấp nặng).
                    </p>
                  </div>

                  {/* Mục 4 */}
                  <div className="space-y-1.5 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-2 text-blue-800 font-bold">
                      <span className="w-5 h-5 rounded-full bg-blue-700 text-white flex items-center justify-center text-xs shrink-0 font-sans font-bold">4</span>
                      <h4>Hiệu chỉnh liều theo chức năng thận (KDIGO 2024)</h4>
                    </div>
                    <p className="text-slate-600 leading-relaxed pl-7">
                      Tự động tính toán mức lọc cầu thận eGFR và CrCl theo công thức Cockcroft-Gault từ chỉ số Creatinin huyết thanh. Hệ thống khuyến cáo giãn liều hoặc giảm liều đối với các kháng sinh đào thải qua thận như Vancomycin, Meropenem.
                    </p>
                  </div>

                  {/* Mục 5 */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-emerald-800 font-bold">
                      <span className="w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center text-xs shrink-0 font-sans font-bold">5</span>
                      <h4>Bệnh viện gửi thông tin về điện thoại người bệnh</h4>
                    </div>
                    <p className="text-slate-600 leading-relaxed pl-7">
                      Sau khi bác sĩ ký số đơn thuốc CPOE, hệ thống hỗ trợ gửi mã đơn thuốc điện tử quốc gia, lịch dặn dò cữ uống thuốc và biên lai tạm ứng viện phí tự động về số điện thoại của bệnh nhân qua tin nhắn SMS / Zalo Brandname.
                    </p>
                  </div>
                </div>
              </div>

              {/* Cột Phải: Nguyên tắc kê đơn an toàn */}
              <div className="lg:col-span-5 xl:col-span-4 p-5 sm:p-6 bg-slate-50/70 overflow-y-auto thin-scrollbar space-y-5">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Quy Tắc An Toàn Bắt Buộc
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Tiêu chuẩn thực hành lâm sàng tốt</p>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="space-y-1 pb-3 border-b border-slate-200/80">
                    <span className="font-bold text-slate-900">Quy tắc 5 Đúng trong điều trị:</span>
                    <p className="text-slate-600 leading-relaxed">
                      Đúng người bệnh · Đúng thuốc · Đúng liều lượng · Đúng đường dùng · Đúng thời điểm.
                    </p>
                  </div>

                  <div className="space-y-1 pb-3 border-b border-slate-200/80">
                    <span className="font-bold text-rose-800">Thuốc Cảnh Báo Cao (High-Alert):</span>
                    <p className="text-slate-600 leading-relaxed">
                      Kali Clorid 10%: CẤM TUYỆT ĐỐI tiêm tĩnh mạch trực tiếp (nguy cơ ngừng tim). Bắt buộc pha loãng nồng độ không quá 40 mmol/L và truyền tĩnh mạch chậm có kiểm soát tốc độ.
                    </p>
                  </div>

                  <div className="space-y-1 pb-3 border-b border-slate-200/80">
                    <span className="font-bold text-slate-900">Ký số & Tính pháp lý đơn thuốc:</span>
                    <p className="text-slate-600 leading-relaxed">
                      Mọi đơn thuốc điện tử phải có chữ ký số hợp lệ của Bác sĩ điều trị theo Thông tư 26/2025/TT-BYT mới được chuyển sang Kho Dược cấp phát.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="font-bold text-slate-900">Thời hạn hiệu lực đơn thuốc:</span>
                    <p className="text-slate-600 leading-relaxed">
                      Đơn thuốc cấp cứu có giá trị thực hiện ngay trong phiên trực; đơn thuốc hoàn bù tủ trực nộp về Kho Dược trước 07:00 sáng ca giao ban.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: KHO DƯỢC & TỦ TRỰC */}
          {activeTab === 'pharmacy_stock' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 h-full min-h-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
              {/* Cột Trái: Vận hành Kho Dược FEFO */}
              <div className="lg:col-span-7 xl:col-span-8 p-5 sm:p-6 overflow-y-auto thin-scrollbar space-y-6 bg-white">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                    Quản Lý Kho Dược FEFO & Định Mức Tủ Trực
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Thực hành tốt bảo quản thuốc GSP (Thông tư 36/2018/TT-BYT) và Thông tư 20/2017/TT-BYT
                  </p>
                </div>

                <div className="space-y-5 text-sm">
                  {/* Mục 1 */}
                  <div className="space-y-1.5 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-2 text-slate-950 font-bold">
                      <span className="w-5 h-5 rounded-full bg-teal-700 text-white flex items-center justify-center text-xs shrink-0 font-sans font-bold">1</span>
                      <h4>Xuất kho theo nguyên tắc FEFO (Hạn ngắn xuất trước)</h4>
                    </div>
                    <p className="text-slate-600 leading-relaxed pl-7">
                      Tại tab <strong>Kho Dược</strong>, Dược sĩ duyệt xuất thuốc theo thứ tự ưu tiên các lô có hạn dùng ngắn nhất. Thuốc cận hạn (dưới 60 ngày) được đánh dấu cảnh báo viền đỏ để ưu tiên cấp phát, triệt tiêu nguy cơ thuốc hết hạn trong kho.
                    </p>
                  </div>

                  {/* Mục 2 */}
                  <div className="space-y-1.5 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-2 text-slate-950 font-bold">
                      <span className="w-5 h-5 rounded-full bg-teal-700 text-white flex items-center justify-center text-xs shrink-0 font-sans font-bold">2</span>
                      <h4>Cảnh báo chạm ngưỡng tồn kho tối thiểu (Min Threshold)</h4>
                    </div>
                    <p className="text-slate-600 leading-relaxed pl-7">
                      Khi số lượng tồn thực tế chạm hoặc xuống dưới định mức tối thiểu an toàn, hệ thống tự động cảnh báo màu hổ phách. Dược sĩ nhấn <strong>Lập phiếu dự trù bổ sung</strong> để kích hoạt quy trình nhập kho khẩn cấp.
                    </p>
                  </div>

                  {/* Mục 3 */}
                  <div className="space-y-1.5 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-2 text-slate-950 font-bold">
                      <span className="w-5 h-5 rounded-full bg-teal-700 text-white flex items-center justify-center text-xs shrink-0 font-sans font-bold">3</span>
                      <h4>Thu hồi vỏ ống Morphin & Khóa niêm phong (TT 20/2017)</h4>
                    </div>
                    <p className="text-slate-600 leading-relaxed pl-7">
                      Đối với thuốc gây nghiện và hướng tâm thần, sau khi tiêm cho người bệnh, Điều dưỡng bắt buộc nhấn <strong>Thu hồi vỏ ống</strong> trên dòng phiếu nợ để niêm phong vỏ vào khay khóa chuyên dụng, lưu giữ tối thiểu 12 tháng.
                    </p>
                  </div>

                  {/* Mục 4 */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-slate-950 font-bold">
                      <span className="w-5 h-5 rounded-full bg-teal-700 text-white flex items-center justify-center text-xs shrink-0 font-sans font-bold">4</span>
                      <h4>Hội đồng tiêu hủy vỏ ống thuốc gây nghiện</h4>
                    </div>
                    <p className="text-slate-600 leading-relaxed pl-7">
                      Dược sĩ hoặc Ban Giám Đốc nhấn <strong>Hội đồng hủy vỏ</strong> để mở Biên bản Mẫu số 10. Việc tiêu hủy bắt buộc phải có sự chứng kiến và đồng ký số của 02 thành viên (Dược sĩ phụ trách kho và Điều dưỡng ca trực).
                    </p>
                  </div>
                </div>
              </div>

              {/* Cột Phải: Tiêu chuẩn GSP & Quy định bảo quản */}
              <div className="lg:col-span-5 xl:col-span-4 p-5 sm:p-6 bg-slate-50/70 overflow-y-auto thin-scrollbar space-y-5">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Tiêu Chuẩn Bảo Quản GSP
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Kho mát & Dây chuyền lạnh vắc xin</p>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="space-y-1 pb-3 border-b border-slate-200/80">
                    <span className="font-bold text-slate-900">Nhiệt độ kho thường & Kho mát:</span>
                    <p className="text-slate-600 leading-relaxed">
                      Kho mát duy trì từ 15°C đến 25°C, độ ẩm không quá 70%. Thuốc phải xếp cách sàn 10 cm, cách tường 20 cm để đảm bảo lưu thông không khí.
                    </p>
                  </div>

                  <div className="space-y-1 pb-3 border-b border-slate-200/80">
                    <span className="font-bold text-blue-800">Dây chuyền lạnh vắc xin (Cold Chain):</span>
                    <p className="text-slate-600 leading-relaxed">
                      Duy trì nghiêm ngặt từ 2.0°C đến 8.0°C. Khi nhiệt độ vượt quá 8°C hoặc sự cố mất điện, vắc xin lập tức chuyển sang chế độ Biệt trữ (Quarantine) chờ hội đồng chuyên môn đánh giá chỉ số MKT và chỉ thị VVM.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="font-bold text-slate-900">Thuốc Kiểm Soát Đặc Biệt (KSĐB):</span>
                    <p className="text-slate-600 leading-relaxed">
                      Bảo quản tại tủ sắt riêng biệt có 2 lớp khóa. Chìa khóa do Dược sĩ phụ trách kho và người được ủy quyền bằng văn bản nắm giữ độc lập.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: THIẾT BỊ Y TẾ & SỰ CỐ */}
          {activeTab === 'equipment_incident' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 h-full min-h-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
              {/* Cột Trái: Báo hỏng, kiểm định & bàn giao */}
              <div className="lg:col-span-7 xl:col-span-8 p-5 sm:p-6 overflow-y-auto thin-scrollbar space-y-6 bg-white">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                    Sự Cố, Kiểm Định & Bàn Giao Thiết Bị Y Tế
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Thực hiện theo Điều 34, 55 Nghị định 98/2021/NĐ-CP và Nghị định 07/2023/NĐ-CP
                  </p>
                </div>

                <div className="space-y-5 text-sm">
                  {/* Mục 1 */}
                  <div className="space-y-1.5 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-2 text-rose-800 font-bold">
                      <span className="w-5 h-5 rounded-full bg-rose-700 text-white flex items-center justify-center text-xs shrink-0 font-sans font-bold">1</span>
                      <h4>Báo hỏng khẩn cấp thiết bị từ buồng bệnh</h4>
                    </div>
                    <p className="text-slate-600 leading-relaxed pl-7">
                      Khi máy thở, monitor hoặc máy sốc tim phát sinh trục trặc, Bác sĩ hoặc Điều dưỡng nhấn <strong>+ Báo Hỏng Thiết Bị</strong> tại tab Thiết Bị Y Tế. Điền mã máy, vị trí buồng bệnh và mô tả lỗi để kích hoạt thông báo khẩn tới phòng Vật tư - TBYT.
                    </p>
                  </div>

                  {/* Mục 2 */}
                  <div className="space-y-1.5 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-2 text-slate-950 font-bold">
                      <span className="w-5 h-5 rounded-full bg-teal-700 text-white flex items-center justify-center text-xs shrink-0 font-sans font-bold">2</span>
                      <h4>Tiếp nhận sửa chữa & Thay thế linh kiện chính hãng</h4>
                    </div>
                    <p className="text-slate-600 leading-relaxed pl-7">
                      Kỹ sư TBYT tiếp nhận máy, chuyển trạng thái sang "Đang sửa chữa", ghi nhận linh kiện phụ tùng có đầy đủ CO/CQ đã thay thế vào sổ theo dõi lý lịch máy.
                    </p>
                  </div>

                  {/* Mục 3 */}
                  <div className="space-y-1.5 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-2 text-slate-950 font-bold">
                      <span className="w-5 h-5 rounded-full bg-teal-700 text-white flex items-center justify-center text-xs shrink-0 font-sans font-bold">3</span>
                      <h4>Đo kiểm định an toàn điện lực y tế (IEC 60601-1)</h4>
                    </div>
                    <p className="text-slate-600 leading-relaxed pl-7">
                      Trước khi bàn giao máy trở lại buồng bệnh, kỹ sư bắt buộc thử tải dòng rò điện tiếp đất và điện trở nối đất đạt tiêu chuẩn y tế quốc tế IEC 60601-1 để bảo vệ an toàn tối đa cho bệnh nhân.
                    </p>
                  </div>

                  {/* Mục 4 */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-slate-950 font-bold">
                      <span className="w-5 h-5 rounded-full bg-teal-700 text-white flex items-center justify-center text-xs shrink-0 font-sans font-bold">4</span>
                      <h4>Ký biên bản nghiệm thu bàn giao 02 bên</h4>
                    </div>
                    <p className="text-slate-600 leading-relaxed pl-7">
                      Nhấn nút <strong>Nghiệm thu & Bàn giao</strong> để mở biên bản bàn giao theo Điều 34 NĐ 98/2021. Bắt buộc 02 bên (Kỹ sư TBYT trực tiếp sửa chữa và Bác sĩ/Điều dưỡng nhận máy) đồng xác thực mã PIN để đưa máy vào sử dụng.
                    </p>
                  </div>
                </div>
              </div>

              {/* Cột Phải: Phân loại rủi ro thiết bị */}
              <div className="lg:col-span-5 xl:col-span-4 p-5 sm:p-6 bg-slate-50/70 overflow-y-auto thin-scrollbar space-y-5">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Phân Loại Thiết Bị & Quy Chuẩn
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Tiêu chuẩn trang thiết bị y tế</p>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="space-y-1 pb-3 border-b border-slate-200/80">
                    <span className="font-bold text-rose-800">Thiết bị loại D (Rủi ro cao nhất):</span>
                    <p className="text-slate-600 leading-relaxed">
                      Máy thở xâm nhập, máy phá rung tim, hệ thống tuần hoàn ngoài cơ thể ECMO. Yêu cầu thời gian phản ứng khắc phục sự cố dưới 15 phút.
                    </p>
                  </div>

                  <div className="space-y-1 pb-3 border-b border-slate-200/80">
                    <span className="font-bold text-amber-800">Thiết bị loại C (Rủi ro trung bình - cao):</span>
                    <p className="text-slate-600 leading-relaxed">
                      Monitor theo dõi bệnh nhân 5 thông số, máy lọc máu liên tục, máy gây mê kèm thở.
                    </p>
                  </div>

                  <div className="space-y-1 pb-3 border-b border-slate-200/80">
                    <span className="font-bold text-slate-900">Thiết bị loại B & A:</span>
                    <p className="text-slate-600 leading-relaxed">
                      Bơm tiêm điện, máy truyền dịch tự động, nhiệt kế điện tử, máy đo huyết áp buồng bệnh.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="font-bold text-slate-900">Bảo trì phòng ngừa định kỳ:</span>
                    <p className="text-slate-600 leading-relaxed">
                      Toàn bộ thiết bị hồi sức cấp cứu phải được hiệu chuẩn và dán tem kiểm định an toàn tối thiểu 06 tháng một lần theo quy định Điều 55 NĐ 98/2021.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: TRỢ LÝ AI LÂM SÀNG */}
          {activeTab === 'clinical_ai' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 h-full min-h-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
              {/* Cột Trái: Hướng dẫn tra cứu & Bảng câu lệnh mẫu */}
              <div className="lg:col-span-7 xl:col-span-8 p-5 sm:p-6 overflow-y-auto thin-scrollbar space-y-6 bg-white">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                    Trợ Lý AI Lâm Sàng & Quản Lý Dược Bệnh Viện
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Hỗ trợ tra cứu nhanh Dược thư Quốc gia Việt Nam 2015 và CSDL 54.885 biệt dược DAV
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="text-sm text-slate-600 leading-relaxed pb-4 border-b border-slate-100">
                    Chatbot này phục vụ bác sĩ tra cứu thông tin thuốc và quy định có nguồn, rà soát hồ sơ/ca bệnh được xác định, và mở các nghiệp vụ có thể thao tác trong hệ thống. Chatbot không tư vấn trực tiếp cho bệnh nhân; nội dung đơn thuốc và thông báo vẫn cần bác sĩ đối chiếu, hoàn thiện và xác nhận trong biểu mẫu. Để sử dụng, nhấn biểu tượng <strong>Trợ Lý AI Lâm Sàng</strong> ở góc phải màn hình và nhập yêu cầu chuyên môn.
                  </div>

                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-3">
                      Các Câu Lệnh Mẫu Thực Tế (Copy hoặc Gõ Trực Tiếp):
                    </h4>
                    
                    <div className="divide-y divide-slate-100 text-xs">
                      {/* Lệnh 1 */}
                      <div className="py-2.5 space-y-1">
                        <p className="font-semibold text-slate-900">
                          "Kiểm tra tiền sử dị ứng cho bệnh nhân Võ Minh Trí, dùng Augmentin được không?"
                        </p>
                        <p className="text-slate-500">
                          Mục tiêu: Đối soát dị ứng Penicillin (BN-8820) và cảnh báo nguy cơ dị ứng chéo với Amoxicillin/Acid Clavulanic.
                        </p>
                      </div>

                      {/* Lệnh 2 */}
                      <div className="py-2.5 space-y-1">
                        <p className="font-semibold text-slate-900">
                          "Bệnh nhân Đặng Thị Lan eGFR 52 dùng Metformin và Ciprofloxacin thế nào?"
                        </p>
                        <p className="text-slate-500">
                          Mục tiêu: Gợi ý hiệu chỉnh liều suy thận giai đoạn G3a theo hướng dẫn quốc tế KDIGO 2024.
                        </p>
                      </div>

                      {/* Lệnh 3 */}
                      <div className="py-2.5 space-y-1">
                        <p className="font-semibold text-slate-900">
                          "Ceftriaxon có truyền cùng dung dịch Ringer Lactat chứa Calci được không?"
                        </p>
                        <p className="text-slate-500">
                          Mục tiêu: Cảnh báo chống chỉ định tuyệt đối phối hợp gây kết tủa muối Calci-Ceftriaxon tại phổi và thận.
                        </p>
                      </div>

                      {/* Lệnh 4 */}
                      <div className="py-2.5 space-y-1">
                        <p className="font-semibold text-slate-900">
                          "Thuốc Kali clorid 10% có được tiêm tĩnh mạch trực tiếp không?"
                        </p>
                        <p className="text-slate-500">
                          Mục tiêu: Cảnh báo High-Alert: CẤM TUYỆT ĐỐI tiêm trực tiếp, hướng dẫn tốc độ và nồng độ pha truyền an toàn.
                        </p>
                      </div>

                      {/* Lệnh 5 */}
                      <div className="py-2.5 space-y-1">
                        <p className="font-semibold text-slate-900">
                          "Phác đồ tiêm bắp Adrenalin phản vệ theo Thông tư 51/2017/TT-BYT?"
                        </p>
                        <p className="text-slate-500">
                          Mục tiêu: Hướng dẫn liều Adrenalin tiêm bắp khẩn cấp 1/2 đến 1 ống cho người lớn ngay từ phản vệ độ II.
                        </p>
                      </div>

                      {/* Lệnh 6 */}
                      <div className="py-2.5 space-y-1">
                        <p className="font-semibold text-slate-900">
                          "Quy chế thu hồi vỏ ống Morphin ca đêm theo Thông tư 20/2017?"
                        </p>
                        <p className="text-slate-500">
                          Mục tiêu: Trích xuất quy định niêm phong vỏ ống, lưu giữ 12 tháng và lập biên bản tiêu hủy Mẫu số 10.
                        </p>
                      </div>

                      {/* Lệnh 7 */}
                      <div className="py-2.5 space-y-1">
                        <p className="font-semibold text-slate-900">
                          "Kho viện còn bao nhiêu lọ Ceftriaxone 1g và những lô nào cận hạn dưới 60 ngày?"
                        </p>
                        <p className="text-slate-500">
                          Mục tiêu: Truy xuất số lượng tồn thực tế và phân loại hạn dùng theo nguyên tắc xuất kho FEFO.
                        </p>
                      </div>

                      {/* Lệnh 8 */}
                      <div className="py-2.5 space-y-1">
                        <p className="font-semibold text-slate-900">
                          "Báo hỏng máy thở Bennett 840 buồng phẫu thuật 2 bị xì khí"
                        </p>
                        <p className="text-slate-500">
                          Mục tiêu: Tự động khởi tạo thẻ báo hỏng thiết bị y tế khẩn cấp gửi tới Kỹ sư TBYT trực ca.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cột Phải: Ranh giới an toàn & Kiểm toán */}
              <div className="lg:col-span-5 xl:col-span-4 p-5 sm:p-6 bg-slate-50/70 overflow-y-auto thin-scrollbar space-y-5">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Nguyên Tắc An Toàn & Trách Nhiệm
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Quy chuẩn kiểm soát lâm sàng</p>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="space-y-1 pb-3 border-b border-slate-200/80">
                    <span className="font-bold text-slate-900">AI đóng vai trò gợi ý (Copilot):</span>
                    <p className="text-slate-600 leading-relaxed">
                      AI là công cụ tham vấn bổ trợ, không thay thế chẩn đoán và chỉ định điều trị của Bác sĩ. Mọi thông tin cần được nhân viên y tế đối chiếu với hồ sơ bệnh án thực tế.
                    </p>
                  </div>

                  <div className="space-y-1 pb-3 border-b border-slate-200/80">
                    <span className="font-bold text-slate-900">Bắt buộc xác thực PIN người dùng:</span>
                    <p className="text-slate-600 leading-relaxed">
                      AI không thể tự động duyệt đơn thuốc, trừ kho hay chuyển trạng thái thiết bị. Mọi thao tác đều bắt buộc người dùng nhập mã PIN chuyên môn để xác thực.
                    </p>
                  </div>

                  <div className="space-y-1 pb-3 border-b border-slate-200/80">
                    <span className="font-bold text-slate-900">Ghi vết kiểm toán bất biến (Audit Trail):</span>
                    <p className="text-slate-600 leading-relaxed">
                      Toàn bộ câu hỏi, kết quả đối soát và hành động kích hoạt qua AI đều được ghi nhật ký thời gian thực với mã băm SHA-256 phục vụ giám sát độc lập.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="font-bold text-slate-900">Độc lập hoàn toàn 100%:</span>
                    <p className="text-slate-600 leading-relaxed">
                      Toàn bộ hệ thống quản lý bệnh viện hoạt động trơn tru thông qua các nút bấm, biểu mẫu và cửa sổ chức năng trực tiếp mà không phụ thuộc vào trạng thái kết nối của AI.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer - Workstation Action Bar */}
        <div className="py-3 px-4 sm:px-6 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0 text-xs">
          <div className="flex items-center gap-2 text-slate-500 truncate text-center sm:text-left">
            <Info className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="truncate">Căn cứ vận hành: TT 22/2011 · TT 20/2017 · TT 26/2025 · TT 36/2018 · NĐ 98/2021</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={downloadUserGuideMarkdown}
              className="flex-1 sm:flex-initial h-9 px-3.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-98"
              title="Tải tệp cẩm nang hướng dẫn vận hành lâm sàng (.md)"
            >
              <Download className="w-4 h-4 text-teal-700" />
              <span>Tải Cẩm Nang</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial h-9 px-4 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-bold transition cursor-pointer active:scale-98 flex items-center justify-center"
            >
              Đã Hiểu & Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
