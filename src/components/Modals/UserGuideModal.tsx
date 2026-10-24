/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  X,
  BookOpen,
  FileText,
  Wrench,
  Boxes,
  ThermometerSnowflake,
  Building2,
  Bot,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Download,
  Eye,
  EyeOff,
  ChevronRight,
  ShieldAlert,
  Lock,
  Sparkles
} from 'lucide-react';

interface UserGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type GuideSectionId = 'overview' | 'roles' | 'tab1' | 'tab2' | 'tab3' | 'tab4' | 'tab5' | 'auth' | 'ai';

interface GuideSectionMeta {
  id: GuideSectionId;
  title: string;
  shortTitle: string;
  icon: React.ComponentType<{ className?: string }>;
}

const GUIDE_SECTIONS: GuideSectionMeta[] = [
  { id: 'overview', title: '1. Tổng quan & Thiết kế', shortTitle: '1. Tổng quan', icon: HelpCircle },
  { id: 'roles', title: '2. Phân quyền 5 vị trí (RBAC)', shortTitle: '2. Phân quyền', icon: ShieldCheck },
  { id: 'tab1', title: '3. Sổ nợ tủ trực lâm sàng', shortTitle: '3. Tủ trực TT22', icon: FileText },
  { id: 'tab2', title: '4. Sự cố & Bàn giao TBYT', shortTitle: '4. Thiết bị NĐ98', icon: Wrench },
  { id: 'tab3', title: '5. Kho Dược FEFO & Định mức', shortTitle: '5. Kho FEFO', icon: Boxes },
  { id: 'tab4', title: '6. Dây chuyền lạnh Vaccine', shortTitle: '6. Chuỗi lạnh', icon: ThermometerSnowflake },
  { id: 'tab5', title: '7. Kiểm kê & Thanh lý TS', shortTitle: '7. Tài sản', icon: Building2 },
  { id: 'auth', title: '8. Ký số & Sổ kiểm toán', shortTitle: '8. Ký số & Audit', icon: ShieldCheck },
  { id: 'ai', title: '9. Trợ lý AI (Tùy chọn)', shortTitle: '9. Trợ lý AI', icon: Bot },
];

export const UserGuideModal: React.FC<UserGuideModalProps> = ({ isOpen, onClose }) => {
  const [activeSection, setActiveSection] = useState<GuideSectionId>('overview');
  const [showPinCodes, setShowPinCodes] = useState<boolean>(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4 md:p-6 animate-in fade-in duration-150">
      <div className="bg-white sm:rounded-lg rounded-none shadow-xl border sm:border-slate-200 border-none w-full h-full sm:h-[90vh] sm:max-h-[90vh] sm:max-w-5xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="h-14 sm:h-16 px-4 sm:px-6 bg-slate-900 text-white flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-md bg-teal-500/20 text-teal-400 flex items-center justify-center border border-teal-500/30 shrink-0">
              <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold truncate">
                <span className="hidden sm:inline">Hướng Dẫn Vận Hành Lâm Sàng</span>
                <span className="sm:hidden">Hướng Dẫn Vận Hành</span>
              </h2>
              <p className="text-xs text-slate-400 font-mono truncate">
                Quy chuẩn TT 22 · TT 20 · NĐ 98
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer flex items-center justify-center shrink-0 active:scale-95"
            title="Đóng cửa sổ"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mobile Horizontal Pill Tab Strip */}
        <div className="flex md:hidden overflow-x-auto scrollbar-none px-3 py-2 bg-slate-100 border-b border-slate-200 gap-1.5 shrink-0">
          {GUIDE_SECTIONS.map((sec) => {
            const Icon = sec.icon;
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => setActiveSection(sec.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-teal-800 text-white shadow-2xs font-bold'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-200/80 font-medium'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-teal-200' : 'text-slate-500'}`} />
                <span>{sec.shortTitle}</span>
              </button>
            );
          })}
        </div>

        {/* Body Split: Desktop Sidebar Navigation + Right Content */}
        <div className="flex-1 flex flex-row overflow-hidden min-h-0">
          {/* Desktop Left Navigation Bar */}
          <div className="hidden md:flex w-64 lg:w-72 border-r border-slate-200 bg-slate-50/80 p-3 flex-col gap-1 overflow-y-auto shrink-0 text-sm">
            <span className="px-2 py-1 text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
              Mục lục hướng dẫn
            </span>

            {GUIDE_SECTIONS.map((sec) => {
              const Icon = sec.icon;
              const isActive = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setActiveSection(sec.id)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-semibold transition text-left cursor-pointer text-xs sm:text-sm ${
                    isActive
                      ? 'bg-teal-800 text-white shadow-2xs'
                      : 'text-slate-700 hover:bg-slate-200/70'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-teal-200' : 'text-slate-500'}`} />
                  <span className="truncate flex-1">{sec.title}</span>
                  {isActive && <ChevronRight className="w-4 h-4 text-teal-200 shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Right Scrollable Document Pane */}
          <div className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto text-slate-700 space-y-5 text-sm leading-relaxed">
            {activeSection === 'overview' && (
              <div className="space-y-4">
                <div className="p-4 sm:p-5 bg-teal-50 border border-teal-200 rounded-xl text-teal-950 space-y-2">
                  <h3 className="text-sm sm:text-base font-bold flex items-center gap-2 text-teal-900">
                    <CheckCircle2 className="w-5 h-5 text-teal-700 shrink-0" />
                    <span>Nguyên Tắc Cốt Lõi: Độc Lập 100% Với AI &amp; Chuẩn Hóa Lâm Sàng</span>
                  </h3>
                  <p className="text-xs sm:text-sm text-teal-900 leading-relaxed">
                    Hệ thống được thiết kế theo đúng tiêu chuẩn vận hành bệnh viện thực tế (HIS/EMR/ERP). Mọi nghiệp vụ từ cấp phát thuốc khẩn ca đêm, báo hỏng máy thở, xuất kho dược FEFO, kiểm soát chuỗi lạnh vắc xin, đến kiểm kê và ký biên bản điều chuyển tài sản đều <strong>hoạt động hoàn toàn độc lập thông qua các nút bấm, biểu mẫu và hộp thoại ký số chuyên môn</strong>. AI là một công cụ hỗ trợ tùy chọn (Copilot), không phải là điều kiện bắt buộc để hệ thống vận hành.
                  </p>
                </div>

                <div className="space-y-2.5">
                  <h4 className="text-sm sm:text-base font-bold text-slate-900">Bố Cục Giao Diện Làm Việc:</h4>
                  <ul className="list-disc pl-5 space-y-2 text-xs sm:text-sm text-slate-600">
                    <li><strong>Thanh Tiêu Đề (Header):</strong> Chuyển đổi nhanh vai trò ca trực (Điều dưỡng, Bác sĩ, Dược sĩ, Kỹ sư Trang thiết bị y tế, Giám đốc); mở Căn cứ pháp lý, Sổ nhật ký kiểm toán, bật/tắt cảnh báo âm thanh và mở Trợ lý AI khi có nhu cầu.</li>
                    <li><strong>Bàn Làm Việc Lâm Sàng (Clinical Workstation):</strong> Chiếm toàn bộ không gian màn hình (100% full-width), tập trung hiển thị trực tiếp dữ liệu bệnh nhân, sổ nợ, trang thiết bị và kho dược.</li>
                    <li><strong>Phân Hệ Làm Việc (Tabs):</strong> Phân quyền nghiêm ngặt theo RBAC, chỉ hiển thị đúng các phân hệ mà chức vụ hiện tại được phép truy cập.</li>
                  </ul>
                </div>
              </div>
            )}

            {activeSection === 'roles' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-teal-700 shrink-0" />
                    <span>Phân Quyền 5 Vai Trò Người Dùng (RBAC)</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowPinCodes((prev) => !prev)}
                    className="text-xs text-slate-700 hover:text-teal-900 font-semibold flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition cursor-pointer border border-slate-200 shadow-2xs active:scale-98"
                    title={showPinCodes ? 'Ẩn mã PIN bảo mật' : 'Hiện mã PIN demo'}
                  >
                    {showPinCodes ? <EyeOff className="w-4 h-4 text-slate-600" /> : <Eye className="w-4 h-4 text-teal-700" />}
                    <span>{showPinCodes ? 'Ẩn mã PIN demo' : 'Hiện mã PIN demo'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  {/* Nurse */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 shadow-2xs">
                    <div className="font-bold text-slate-900 text-sm flex items-center justify-between flex-wrap gap-1">
                      <span>1. Điều Dưỡng Ca Trực (ĐD. Lê Thị Thu)</span>
                      <span className="text-xs font-mono bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-md font-bold border border-emerald-200">
                        PIN: {showPinCodes ? '1111' : '••••'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 font-mono">CCHN: 004812/HN-CCHN • Khoa Cấp Cứu A9</div>
                    <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                      • <strong>Phân hệ truy cập:</strong> Sổ nợ tủ trực, Sự cố thiết bị y tế.<br />
                      • <strong>Thẩm quyền:</strong> Lập phiếu mượn khẩn thuốc/vật tư ca đêm (TT 22), thu hồi vỏ ống Morphin nộp vào khay niêm phong (TT 20), làm chứng biên bản kỹ thuật.
                    </p>
                  </div>

                  {/* Doctor */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 shadow-2xs">
                    <div className="font-bold text-slate-900 text-sm flex items-center justify-between flex-wrap gap-1">
                      <span>2. Bác Sĩ Điều Trị (BS. Trần Văn Hùng)</span>
                      <span className="text-xs font-mono bg-teal-100 text-teal-900 px-2 py-0.5 rounded-md font-bold border border-teal-200">
                        PIN: {showPinCodes ? '4444' : '••••'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 font-mono">CCHN: 009125/BYT-CCHN • Hồi Sức Tích Cực (ICU)</div>
                    <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                      • <strong>Phân hệ truy cập:</strong> Sổ nợ tủ trực, Sự cố thiết bị y tế.<br />
                      • <strong>Thẩm quyền:</strong> Chỉ định mượn thuốc cấp cứu, ký đơn thuốc hoàn bù tủ trực, nghiệm thu thử tải máy thở bàn giao buồng bệnh (NĐ 98).
                    </p>
                  </div>

                  {/* Pharmacist */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 shadow-2xs">
                    <div className="font-bold text-slate-900 text-sm flex items-center justify-between flex-wrap gap-1">
                      <span>3. Dược Sĩ Kho Dược (DS. Nguyễn Bích Ngọc)</span>
                      <span className="text-xs font-mono bg-purple-100 text-purple-900 px-2 py-0.5 rounded-md font-bold border border-purple-200">
                        PIN: {showPinCodes ? '2222' : '••••'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 font-mono">CCHN: 018234/BYT-CCHN • Kho Dược Bệnh Viện</div>
                    <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                      • <strong>Phân hệ truy cập:</strong> Kho Dược FEFO, Sổ nợ tủ trực.<br />
                      • <strong>Thẩm quyền:</strong> Duyệt hoàn bù trừ kho, chủ trì Hội đồng hủy vỏ Morphin (TT 20), ký lệnh xuất kho FEFO (TT 36), lập dự trù bổ sung cơ số thuốc cấp cứu.
                    </p>
                  </div>

                  {/* Biomedical Engineer */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 shadow-2xs">
                    <div className="font-bold text-slate-900 text-sm flex items-center justify-between flex-wrap gap-1">
                      <span>4. Kỹ Sư TBYT (KS. Đặng Văn Nam)</span>
                      <span className="text-xs font-mono bg-blue-100 text-blue-900 px-2 py-0.5 rounded-md font-bold border border-blue-200">
                        PIN: {showPinCodes ? '3333' : '••••'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 font-mono">Mã thẻ: BME-204/VTYT • Phòng Vật Tư - TBYT</div>
                    <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                      • <strong>Phân hệ truy cập:</strong> Sự cố &amp; Kiểm định thiết bị y tế.<br />
                      • <strong>Thẩm quyền:</strong> Tiếp nhận sửa chữa máy thở/monitor, thử tải an toàn điện lực IEC 60601-1 và ký biên bản bàn giao NĐ 98.
                    </p>
                  </div>

                  {/* Director */}
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl md:col-span-2 space-y-2 shadow-2xs">
                    <div className="font-bold text-slate-900 text-sm flex items-center justify-between flex-wrap gap-1">
                      <span>5. Ban Giám Đốc Bệnh Viện (TS.BS. Nguyễn Văn An)</span>
                      <span className="text-xs font-mono bg-amber-200 text-amber-950 px-2 py-0.5 rounded-md font-bold border border-amber-300">
                        PIN: {showPinCodes ? '9999' : '••••'}
                      </span>
                    </div>
                    <div className="text-xs text-amber-800 font-mono">CCHN: 001002/BYT-CCHN • Ban Giám Đốc</div>
                    <p className="text-slate-700 text-xs sm:text-sm leading-relaxed">
                      • <strong>Phân hệ truy cập:</strong> Toàn quyền các phân hệ lâm sàng.<br />
                      • <strong>Thẩm quyền độc quyền:</strong> Phê duyệt quyết định bổ sung danh mục cơ số cấp cứu, quyết định thanh lý tài sản nhà nước theo NĐ 151/2017 &amp; NĐ 114/2024.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'tab1' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-teal-700 shrink-0" />
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    Phân Hệ 1: Sổ Nợ Tủ Trực Cấp Cứu (TT 22/2011 &amp; TT 20/2017)
                  </h3>
                </div>

                <div className="space-y-3">
                  <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-2 shadow-2xs">
                    <h5 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-teal-800 text-white flex items-center justify-center text-xs font-bold shrink-0">1</span>
                      <span>Mượn khẩn thuốc / vật tư tủ trực ca đêm</span>
                    </h5>
                    <p className="text-xs sm:text-sm text-slate-600">
                      Nhấn nút <strong className="text-teal-900 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 inline-block">+ Lập Phiếu Mượn Khẩn</strong> ở góc trên bảng.
                    </p>
                    <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm text-slate-600">
                      <li>Chọn thuốc cấp cứu (Morphin, Fentanyl, Adrenalin, Ceftriaxone, Noradrenalin...).</li>
                      <li>Nhập số lượng, mã bệnh nhân, buồng bệnh, bác sĩ chỉ định và lý do cấp cứu.</li>
                      <li>Có thể dùng thanh <strong>Smart Macros ICD-10</strong> để gõ tắt nhanh chẩn đoán (THA, NMCT, PUV, COPD...).</li>
                      <li>Nhấn <strong>Lập Phiếu &amp; Ký Xác Nhận</strong> $\to$ Nhập mã PIN cá nhân $\to$ Phiếu ghi nợ được ghi nhận vào bảng.</li>
                    </ul>
                  </div>

                  <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-2 shadow-2xs">
                    <h5 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-teal-800 text-white flex items-center justify-center text-xs font-bold shrink-0">2</span>
                      <span>Thu hồi vỏ ống thuốc gây nghiện (TT 20/2017/TT-BYT)</span>
                    </h5>
                    <p className="text-xs sm:text-sm text-slate-600">
                      Đối với thuốc gây nghiện (Morphin, Fentanyl), sau khi tiêm xong cho bệnh nhân, Điều dưỡng bấm nút <strong className="text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block">Thu hồi vỏ ống</strong> trực tiếp trên dòng tương ứng để niêm phong vỏ ống vào khay khóa chuyên dụng.
                    </p>
                  </div>

                  <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-2 shadow-2xs">
                    <h5 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-teal-800 text-white flex items-center justify-center text-xs font-bold shrink-0">3</span>
                      <span>Hoàn bù cơ số tủ trực &amp; Trừ kho Dược FEFO</span>
                    </h5>
                    <p className="text-xs sm:text-sm text-slate-600">
                      Khi có đơn thuốc bù hợp lệ từ Bác sĩ trước 07:00 sáng, nhấn nút <strong className="text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-300 inline-block">Hoàn bù cơ số</strong> $\to$ Nhập PIN xác thực lâm sàng. Hệ thống sẽ chuyển trạng thái phiếu nợ thành "Đã hoàn bù" và tự động trừ kho Dược theo lô cận hạn nhất (FEFO).
                    </p>
                  </div>

                  <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-2 shadow-2xs">
                    <h5 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-teal-800 text-white flex items-center justify-center text-xs font-bold shrink-0">4</span>
                      <span>Hội đồng tiêu hủy vỏ ống thuốc gây nghiện</span>
                    </h5>
                    <p className="text-xs sm:text-sm text-slate-600">
                      Dược sĩ Kho Dược hoặc Giám đốc bấm nút <strong className="text-rose-900 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 inline-block">Hội đồng hủy vỏ</strong> $\to$ Mở biên bản tiêu hủy Mẫu số 10 $\to$ Ký xác nhận bắt buộc với sự chứng kiến của 02 thành viên (Dược sĩ + Điều dưỡng).
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'tab2' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-teal-700 shrink-0" />
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    Phân Hệ 2: Sự Cố &amp; Bàn Giao Thiết Bị Y Tế (Nghị Định 98/2021)
                  </h3>
                </div>
                <div className="space-y-3">
                  <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-1.5 shadow-2xs">
                    <h5 className="font-bold text-slate-900 text-sm">1. Báo hỏng thiết bị y tế từ buồng bệnh</h5>
                    <p className="text-xs sm:text-sm text-slate-600">
                      Khi máy thở, monitor hoặc máy sốc tim gặp sự cố, điều dưỡng/bác sĩ nhấn nút <strong className="text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 inline-block">+ Báo Hỏng Thiết Bị</strong> $\to$ Điền thiết bị, vị trí buồng bệnh, mô tả hiện tượng hư hỏng $\to$ Tạo phiếu khẩn cấp gửi phòng Vật tư - TBYT.
                    </p>
                  </div>
                  <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-1.5 shadow-2xs">
                    <h5 className="font-bold text-slate-900 text-sm">2. Tiếp nhận sửa chữa &amp; Thay thế phụ kiện</h5>
                    <p className="text-xs sm:text-sm text-slate-600">
                      Kỹ sư TBYT kiểm tra thiết bị, chuyển trạng thái "Đang sửa chữa" và ghi nhận phụ kiện CO/CQ đã thay thế vào sổ lý lịch máy.
                    </p>
                  </div>
                  <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-1.5 shadow-2xs">
                    <h5 className="font-bold text-slate-900 text-sm">3. Kiểm định an toàn điện &amp; Ký biên bản bàn giao (Handover)</h5>
                    <p className="text-xs sm:text-sm text-slate-600">
                      Nhấn nút <strong className="text-teal-900 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 inline-block">Nghiệm thu &amp; Bàn giao</strong> $\to$ Nhập kết quả thử tải dòng rò điện $\to$ Ký xác thực 02 bên (Kỹ sư TBYT + Bác sĩ khoa nhận máy) theo đúng Điều 34 Nghị định 98/2021.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'tab3' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Boxes className="w-5 h-5 text-teal-700 shrink-0" />
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    Phân Hệ 3: Kho Dược FEFO &amp; Định Mức An Toàn (TT 36/2018 GSP)
                  </h3>
                </div>
                <div className="space-y-3">
                  <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-1.5 shadow-2xs">
                    <h5 className="font-bold text-slate-900 text-sm">1. Xuất kho theo nguyên tắc FEFO (Hạn ngắn xuất trước)</h5>
                    <p className="text-xs sm:text-sm text-slate-600">
                      Dược sĩ duyệt xuất lô thuốc bằng cách bấm nút <strong className="text-slate-900 bg-slate-100 px-2 py-0.5 rounded border inline-block">Xuất kho FEFO</strong>. Các lô thuốc cận hạn (&lt; 60 ngày) được hệ thống đánh dấu viền đỏ ưu tiên xuất trước để ngăn chặn thuốc quá hạn.
                    </p>
                  </div>
                  <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-1.5 shadow-2xs">
                    <h5 className="font-bold text-slate-900 text-sm">2. Lập phiếu dự trù bổ sung khi chạm ngưỡng Min</h5>
                    <p className="text-xs sm:text-sm text-slate-600">
                      Khi số lượng tồn kho chạm ngưỡng tối thiểu an toàn, bấm nút <strong className="text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 inline-block">Dự trù bổ sung cơ số</strong> $\to$ Xác nhận nhập khẩn cấp để đưa kho về định mức an toàn tối đa.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'tab4' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <ThermometerSnowflake className="w-5 h-5 text-teal-700 shrink-0" />
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    Phân Hệ 4: Dây Chuyền Lạnh Vắc Xin &amp; Biệt Trữ GSP (TT 36/2018/TT-BYT)
                  </h3>
                </div>
                <div className="space-y-3">
                  <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-1.5 shadow-2xs">
                    <h5 className="font-bold text-slate-900 text-sm">1. Giám sát nhiệt độ 2 - 8°C &amp; Cảnh báo quá nhiệt</h5>
                    <p className="text-xs sm:text-sm text-slate-600">
                      Hệ thống cảm biến đo nhiệt độ liên tục. Khi nhiệt độ vượt 8°C (hoặc mô phỏng bằng nút "Mô phỏng ngắt điện"), chuông báo động hú vang và vắc xin tự động chuyển sang chế độ Biệt Trữ (Quarantine).
                    </p>
                  </div>
                  <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-1.5 shadow-2xs">
                    <h5 className="font-bold text-slate-900 text-sm">2. Lệnh giải phóng lô tiêm chủng (Batch Release)</h5>
                    <p className="text-xs sm:text-sm text-slate-600">
                      Sau khi nhiệt độ ổn định lại và chỉ thị đông băng VVM đạt chuẩn Cấp 1, Hội đồng Dược bấm nút <strong className="text-teal-900 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 inline-block">Ký lệnh phóng thích lô</strong> với chứng chỉ hành nghề để tiếp tục sử dụng.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'tab5' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-teal-700 shrink-0" />
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    Phân Hệ 5: Kiểm Kê &amp; Thanh Lý Tài Sản Công (NĐ 151/2017 &amp; NĐ 114/2024)
                  </h3>
                </div>
                <div className="space-y-3">
                  <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-1.5 shadow-2xs">
                    <h5 className="font-bold text-slate-900 text-sm">1. Quét mã QR kiểm kê tại giường bệnh</h5>
                    <p className="text-xs sm:text-sm text-slate-600">
                      Bấm nút <strong className="text-slate-900 bg-slate-100 px-2 py-0.5 rounded border inline-block">Quét mã QR kiểm kê</strong> để mô phỏng máy quét thực địa, phát hiện thiết bị bị điều chuyển sai khoa phòng so với sổ kế toán tài sản cố định.
                    </p>
                  </div>
                  <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-1.5 shadow-2xs">
                    <h5 className="font-bold text-slate-900 text-sm">2. Lập Biên bản điều chuyển tài sản (Mẫu 01/TSC-ĐC)</h5>
                    <p className="text-xs sm:text-sm text-slate-600">
                      Đối với máy nằm sai buồng, bấm nút <strong className="text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block">Điều chuyển</strong> $\to$ Ký biên bản bàn giao theo Điều 39 &amp; 40 Nghị định 151/2017.
                    </p>
                  </div>
                  <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-1.5 shadow-2xs">
                    <h5 className="font-bold text-slate-900 text-sm">3. Ký Tờ trình Thanh lý Tài sản (Độc quyền Giám đốc)</h5>
                    <p className="text-xs sm:text-sm text-slate-600">
                      Đối với máy hư hỏng nát ngưng dùng trên 12 tháng, chỉ có <strong>Giám đốc bệnh viện</strong> mới có quyền bấm nút <strong className="text-rose-900 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 inline-block">Ký Đề Xuất Thanh Lý</strong>.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'auth' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-teal-700 shrink-0" />
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    Ký Số Lâm Sàng &amp; Sổ Nhật Ký Kiểm Toán (Nghị Định 130/2018/NĐ-CP)
                  </h3>
                </div>
                <div className="space-y-3">
                  <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-1.5 shadow-2xs">
                    <h5 className="font-bold text-slate-900 text-sm">Cơ chế xác thực 2 lớp: Mã PIN chuyên môn &amp; Thẻ nhân viên RFID/NFC</h5>
                    <p className="text-xs sm:text-sm text-slate-600">
                      Mỗi thao tác làm thay đổi cơ số thuốc hoặc hiện trạng thiết bị cấp cứu đều yêu cầu nhập mã PIN chuyên môn tương ứng với Chứng chỉ hành nghề y tế (CCHN) của người ký. Các nghiệp vụ nhạy cảm (như tiêu hủy Morphin hoặc bàn giao máy thở) bắt buộc phải có thêm chữ ký của Người Làm Chứng độc lập.
                    </p>
                  </div>
                  <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-1.5 shadow-2xs">
                    <h5 className="font-bold text-slate-900 text-sm">Sổ Nhật Ký Kiểm Toán Bất Biến (Audit Trail)</h5>
                    <p className="text-xs sm:text-sm text-slate-600">
                      Bấm nút <strong>Nhật Ký Kiểm Toán</strong> trên thanh menu để xem toàn bộ lịch sử các giao dịch lâm sàng. Mọi bản ghi đều được khóa sổ bảo mật với chuỗi băm SHA-256, gắn liền với tên bác sĩ/điều dưỡng/kỹ sư, thời gian chính xác và căn cứ pháp lý Bộ Y Tế.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'ai' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-teal-700 shrink-0" />
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    Trợ Lý AI Lâm Sàng (Tùy Chọn Mở Rộng)
                  </h3>
                </div>
                <div className="p-4 sm:p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-3 shadow-2xs">
                  <p className="text-xs sm:text-sm text-slate-600">
                    Trợ lý AI là một tính năng <strong>hoàn toàn tùy chọn</strong> để nâng cao tiện ích:
                  </p>
                  <ul className="list-disc pl-5 space-y-2 text-xs sm:text-sm text-slate-600">
                    <li><strong>Mở/Đóng linh hoạt:</strong> Bấm biểu tượng <strong>Trợ Lý AI</strong> ở góc dưới phải khi cần tra cứu nhanh. Khi đóng lại, màn hình làm việc lâm sàng sẽ mở rộng 100% để hiển thị nhiều thông tin nhất.</li>
                    <li><strong>Gõ tắt chẩn đoán ICD-10 (Smart Macros):</strong> Gõ THA, NMCT, PUV, COPD... để tự động bung chẩn đoán chuẩn hóa kèm mã ICD-10.</li>
                    <li><strong>Hỗ trợ an toàn người bệnh (CDSS):</strong> Tự động cảnh báo quá liều Opioid, tương tác thuốc nguy hiểm (Morphin + Diazepam), hoặc cảnh báo thuốc có nguy cơ cao (Kali Clorid).</li>
                    <li><strong>Đảm bảo an toàn y khoa:</strong> Mọi thao tác do AI gợi ý đều vẫn phải trải qua bước Ký số xác thực lâm sàng của nhân viên y tế thật sự.</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="py-3 px-4 sm:px-6 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0 text-xs">
          <span className="text-slate-500 text-center sm:text-left truncate">
            Tài liệu lưu trữ tại: <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[11px]">docs/01_Cam_Nang_Toan_Dien_Nghiep_Vu_Y_Te.md</code>
          </span>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => {
                const guideText = `# CẨM NANG TOÀN DIỆN VỀ NGHIỆP VỤ Y TẾ LÂM SÀNG & QUẢN LÝ KHO BỆNH VIỆN
## HỆ THỐNG QUẢN LÝ KHO DƯỢC, VẬT TƯ, TỦ TRỰC LÂM SÀNG & TRANG THIẾT BỊ Y TẾ BỆNH VIỆN

1. Sổ nợ tủ trực ca đêm: Thông tư 22/2011/TT-BYT & Điều 15 Thông tư 20/2017/TT-BYT (Khóa nợ vỏ ống Morphin).
2. Sự cố & Bàn giao thiết bị y tế: Điều 34, 55 Nghị định 98/2021/NĐ-CP & Nghị định 07/2023/NĐ-CP.
3. Kho Dược FEFO & Định mức: Khoản 2 Điều 12 Thông tư 36/2018/TT-BYT (GSP) & Điều 7 TT 22/2011.
4. Giám sát chuỗi lạnh vắc xin: Chuẩn GSP 2.0°C - 8.0°C, SOP xử lý mất điện & Quy chế Biệt trữ (Quarantine).
5. Kiểm kê & Thanh lý tài sản công: Điều 39, 40 Nghị định 151/2017/NĐ-CP & NĐ 114/2024.
6. Ký số chuyên môn & Sổ kiểm toán lâm sàng: Nghị định 130/2018/NĐ-CP.`;
                const blob = new Blob([guideText], { type: 'text/markdown;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'Cam_Nang_Nghiep_Vu_Y_Te_Do_An_2.md';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}
              className="flex-1 sm:flex-initial h-9 sm:h-9.5 px-3 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold transition cursor-pointer shadow-2xs flex items-center justify-center gap-1.5 active:scale-98"
              title="Tải tệp cẩm nang hướng dẫn nghiệp vụ lâm sàng (.md)"
            >
              <Download className="w-4 h-4 text-teal-700" />
              <span>Tải Cẩm Nang</span>
            </button>
            <button
              onClick={onClose}
              className="flex-1 sm:flex-initial h-9 sm:h-9.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition cursor-pointer shadow-2xs active:scale-98 flex items-center justify-center"
            >
              Đã Hiểu &amp; Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
