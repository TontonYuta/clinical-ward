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
  EyeOff
} from 'lucide-react';

interface UserGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserGuideModal: React.FC<UserGuideModalProps> = ({ isOpen, onClose }) => {
  const [activeSection, setActiveSection] = useState<'overview' | 'roles' | 'tab1' | 'tab2' | 'tab3' | 'tab4' | 'tab5' | 'ai' | 'auth'>('overview');
  const [showPinCodes, setShowPinCodes] = useState<boolean>(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="h-14 px-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center border border-teal-500/30">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold">Tài Liệu Hướng Dẫn Sử Dụng Ứng Dụng Y Tế Lâm Sàng</h2>
              <span className="text-xs text-slate-400 font-mono">
                Sổ Tay Hướng Dẫn Vận Hành Nghiệp Vụ Lâm Sàng Bệnh Viện
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Split: Left Navigation + Right Content */}
        <div className="flex-1 flex flex-row overflow-hidden min-h-0">
          {/* Left Navigation Bar */}
          <div className="w-64 border-r border-slate-200 bg-slate-50/80 p-3 flex flex-col gap-1 overflow-y-auto shrink-0 text-xs sm:text-sm">
            <span className="px-2 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
              Mục lục hướng dẫn
            </span>

            <button
              onClick={() => setActiveSection('overview')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg font-semibold transition text-left cursor-pointer ${
                activeSection === 'overview'
                  ? 'bg-teal-700 text-white shadow-2xs'
                  : 'text-slate-700 hover:bg-slate-200/70'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5 shrink-0" />
              <span>1. Tổng quan &amp; Nguyên tắc</span>
            </button>

            <button
              onClick={() => setActiveSection('roles')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg font-semibold transition text-left cursor-pointer ${
                activeSection === 'roles'
                  ? 'bg-teal-700 text-white shadow-2xs'
                  : 'text-slate-700 hover:bg-slate-200/70'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>2. Phân quyền 5 vị trí (RBAC)</span>
            </button>

            <button
              onClick={() => setActiveSection('tab1')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg font-semibold transition text-left cursor-pointer ${
                activeSection === 'tab1'
                  ? 'bg-teal-700 text-white shadow-2xs'
                  : 'text-slate-700 hover:bg-slate-200/70'
              }`}
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span>3. Sổ nợ tủ trực lâm sàng</span>
            </button>

            <button
              onClick={() => setActiveSection('tab2')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg font-semibold transition text-left cursor-pointer ${
                activeSection === 'tab2'
                  ? 'bg-teal-700 text-white shadow-2xs'
                  : 'text-slate-700 hover:bg-slate-200/70'
              }`}
            >
              <Wrench className="w-3.5 h-3.5 shrink-0" />
              <span>4. Sự cố &amp; Bàn giao TBYT</span>
            </button>

            <button
              onClick={() => setActiveSection('tab3')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg font-semibold transition text-left cursor-pointer ${
                activeSection === 'tab3'
                  ? 'bg-teal-700 text-white shadow-2xs'
                  : 'text-slate-700 hover:bg-slate-200/70'
              }`}
            >
              <Boxes className="w-3.5 h-3.5 shrink-0" />
              <span>5. Kho Dược FEFO &amp; Định mức</span>
            </button>

            <button
              onClick={() => setActiveSection('tab4')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg font-semibold transition text-left cursor-pointer ${
                activeSection === 'tab4'
                  ? 'bg-teal-700 text-white shadow-2xs'
                  : 'text-slate-700 hover:bg-slate-200/70'
              }`}
            >
              <ThermometerSnowflake className="w-3.5 h-3.5 shrink-0" />
              <span>6. Dây chuyền lạnh Vaccine</span>
            </button>

            <button
              onClick={() => setActiveSection('tab5')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg font-semibold transition text-left cursor-pointer ${
                activeSection === 'tab5'
                  ? 'bg-teal-700 text-white shadow-2xs'
                  : 'text-slate-700 hover:bg-slate-200/70'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 shrink-0" />
              <span>7. Kiểm kê &amp; Thanh lý TS</span>
            </button>

            <button
              onClick={() => setActiveSection('auth')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg font-semibold transition text-left cursor-pointer ${
                activeSection === 'auth'
                  ? 'bg-teal-700 text-white shadow-2xs'
                  : 'text-slate-700 hover:bg-slate-200/70'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>8. Ký số &amp; Sổ kiểm toán</span>
            </button>

            <button
              onClick={() => setActiveSection('ai')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg font-semibold transition text-left cursor-pointer ${
                activeSection === 'ai'
                  ? 'bg-teal-700 text-white shadow-2xs'
                  : 'text-slate-700 hover:bg-slate-200/70'
              }`}
            >
              <Bot className="w-3.5 h-3.5 shrink-0" />
              <span>9. Trợ lý AI (Tùy chọn)</span>
            </button>
          </div>

          {/* Right Scrollable Document Pane */}
          <div className="flex-1 p-6 overflow-y-auto text-slate-700 space-y-6 text-xs leading-relaxed">
            {activeSection === 'overview' && (
              <div className="space-y-4">
                <div className="p-4 bg-teal-50 border border-teal-200 rounded-xl text-teal-950">
                  <h3 className="text-sm font-bold mb-1 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-700" />
                    Nguyên Tắc Thiết Kế Cốt Lõi: Độc Lập 100% Với AI
                  </h3>
                  <p className="text-xs text-teal-900 leading-relaxed">
                    Hệ thống được thiết kế theo đúng tiêu chuẩn vận hành bệnh viện thực tế (HIS/EMR/ERP). Mọi nghiệp vụ từ cấp phát thuốc khẩn ca đêm, báo hỏng máy thở, xuất kho dược FEFO, kiểm soát chuỗi lạnh vắc xin, đến kiểm kê và ký biên bản điều chuyển tài sản đều <strong>hoạt động hoàn toàn độc lập thông qua các nút bấm, biểu mẫu và hộp thoại ký số chuyên môn</strong>. AI là một công cụ hỗ trợ tùy chọn (Copilot), không phải là điều kiện bắt buộc để hệ thống vận hành.
                  </p>
                </div>

                <h4 className="text-sm font-bold text-slate-900">Bố Cục Giao Diện Mới:</h4>
                <ul className="list-disc pl-5 space-y-2 text-slate-600">
                  <li><strong>Thanh Tiêu Đề (Header):</strong> Chọn nhanh chức vụ đang trực (Điều dưỡng, Bác sĩ, Dược sĩ, Kỹ sư Trang thiết bị y tế, Giám đốc); mở Căn cứ pháp lý, Nhật ký kiểm toán, Bật/tắt âm cảnh báo và Nút mở Trợ lý AI khi có nhu cầu.</li>
                  <li><strong>Bàn Làm Việc Lâm Sàng (Clinical Workstation):</strong> Chiếm toàn bộ không gian màn hình (100% full-width), loại bỏ các thanh quy trình chiếm chỗ rườm rà, tập trung hiển thị trực tiếp dữ liệu bệnh nhân, sổ nợ, trang thiết bị và kho dược.</li>
                  <li><strong>Phân Hệ Làm Việc (Tabs):</strong> Phân quyền nghiêm ngặt theo RBAC, chỉ hiển thị đúng các phân hệ mà chức vụ hiện tại được phép truy cập.</li>
                </ul>
              </div>
            )}

            {activeSection === 'roles' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-4.5 h-4.5 text-teal-700" />
                    <span>Phân Quyền Vai Trò Người Dùng (Role-Based Access Control)</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowPinCodes(prev => !prev)}
                    className="text-xs text-slate-600 hover:text-teal-800 font-semibold flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                    title={showPinCodes ? "Ẩn mã PIN bảo mật" : "Hiện mã PIN demo"}
                  >
                    {showPinCodes ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-teal-700" />}
                    <span>{showPinCodes ? 'Ẩn mã PIN' : 'Hiện mã PIN demo'}</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                    <div className="font-bold text-slate-900 text-sm flex items-center justify-between mb-1">
                      <span>1. Điều Dưỡng Ca Trực (ĐD. Lê Thị Thu)</span>
                      <span className="text-xs font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md font-bold">
                        PIN: {showPinCodes ? '1111' : '••••'}
                      </span>
                    </div>
                    <p className="text-slate-600 text-xs leading-relaxed">
                      • <strong>Phân hệ truy cập:</strong> Sổ nợ tủ trực.<br/>
                      • <strong>Thẩm quyền:</strong> Lập phiếu mượn khẩn thuốc/vật tư ca đêm, thu hồi vỏ ống Morphin nộp vào khay niêm phong, làm chứng biên bản kỹ thuật.
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                    <div className="font-bold text-slate-900 text-sm flex items-center justify-between mb-1">
                      <span>2. Bác Sĩ Điều Trị (BS. Trần Văn Hùng)</span>
                      <span className="text-xs font-mono bg-teal-100 text-teal-800 px-2 py-0.5 rounded-md font-bold">
                        PIN: {showPinCodes ? '4444' : '••••'}
                      </span>
                    </div>
                    <p className="text-slate-600 text-xs leading-relaxed">
                      • <strong>Phân hệ truy cập:</strong> Sổ nợ tủ trực, Sự cố thiết bị y tế.<br/>
                      • <strong>Thẩm quyền:</strong> Ra y lệnh cấp cứu mượn thuốc, ký đơn thuốc hoàn bù tủ trực, nghiệm thu thử tải máy thở bàn giao buồng bệnh.
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                    <div className="font-bold text-slate-900 text-sm flex items-center justify-between mb-1">
                      <span>3. Dược Sĩ Kho Dược (DS. Nguyễn Bích Ngọc)</span>
                      <span className="text-xs font-mono bg-purple-100 text-purple-800 px-2 py-0.5 rounded-md font-bold">
                        PIN: {showPinCodes ? '2222' : '••••'}
                      </span>
                    </div>
                    <p className="text-slate-600 text-xs leading-relaxed">
                      • <strong>Phân hệ truy cập:</strong> Sổ nợ tủ trực, Kho Dược FEFO, Chuỗi lạnh vắc xin.<br/>
                      • <strong>Thẩm quyền:</strong> Duyệt hoàn bù trừ kho, chủ trì Hội đồng hủy vỏ Morphin (TT 20), ký lệnh xuất kho FEFO, lập dự trù bổ sung cơ số, ký lệnh giải phóng lô vắc xin.
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                    <div className="font-bold text-slate-900 text-sm flex items-center justify-between mb-1">
                      <span>4. Kỹ Sư Trang Thiết Bị Y Tế (KS. Đặng Văn Nam)</span>
                      <span className="text-xs font-mono bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md font-bold">
                        PIN: {showPinCodes ? '3333' : '••••'}
                      </span>
                    </div>
                    <p className="text-slate-600 text-xs leading-relaxed">
                      • <strong>Phân hệ truy cập:</strong> Sự cố thiết bị y tế, Kiểm kê &amp; Quản lý tài sản.<br/>
                      • <strong>Thẩm quyền:</strong> Tiếp nhận sửa chữa máy móc, thử tải an toàn điện lực và ký biên bản bàn giao NĐ 98, quét mã QR kiểm kê, lập biên bản điều chuyển tài sản Mẫu 01/TSC-ĐC.
                    </p>
                  </div>

                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl md:col-span-2 space-y-1.5">
                    <div className="font-bold text-slate-900 text-sm flex items-center justify-between mb-1">
                      <span>5. Ban Giám Đốc Bệnh Viện (TS.BS. Nguyễn Văn An)</span>
                      <span className="text-xs font-mono bg-amber-200 text-amber-900 px-2 py-0.5 rounded-md font-bold">
                        PIN: {showPinCodes ? '9999' : '••••'}
                      </span>
                    </div>
                    <p className="text-slate-700 text-xs leading-relaxed">
                      • <strong>Phân hệ truy cập:</strong> Toàn quyền 5/5 phân hệ lâm sàng.<br/>
                      • <strong>Thẩm quyền độc quyền:</strong> Ký Tờ trình thành lập Hội đồng thanh lý tài sản công (NĐ 151/2017 &amp; NĐ 114/2024), phê duyệt các quyết định đầu tư bổ sung cơ số lớn.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'tab1' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900">
                  Phân Hệ 1: Sổ Nợ Tủ Trực Cấp Cứu (TT 22/2011 &amp; TT 20/2017)
                </h3>

                <div className="space-y-3">
                  <div className="border border-slate-200 rounded-lg p-3">
                    <h5 className="font-bold text-slate-900 mb-1">Bước 1: Mượn khẩn thuốc / vật tư tủ trực ca đêm</h5>
                    <p className="text-slate-600 mb-2">
                      Nhấn nút <strong className="text-emerald-700 bg-emerald-50 px-1 rounded border border-emerald-200">+ Lập Phiếu Mượn Khẩn (Cơ Số Tủ Trực)</strong> ở góc trên bên phải.
                    </p>
                    <ul className="list-disc pl-5 space-y-1 text-slate-600">
                      <li>Chọn loại thuốc (Morphin, Fentanyl, Adrenalin, Ceftriaxone, Bơm tiêm...).</li>
                      <li>Nhập số lượng, mã bệnh nhân, buồng bệnh, bác sĩ ra y lệnh và lý do cấp cứu.</li>
                      <li>Nhấn <strong>Lập Phiếu &amp; Ký Xác Nhận</strong> $\to$ Xác thực mã PIN cá nhân $\to$ Phiếu ghi nợ được ghi nhận vào bảng.</li>
                    </ul>
                  </div>

                  <div className="border border-slate-200 rounded-lg p-3">
                    <h5 className="font-bold text-slate-900 mb-1">Bước 2: Thu hồi vỏ ống thuốc gây nghiện (TT 20/2017/TT-BYT)</h5>
                    <p className="text-slate-600 mb-2">
                      Đối với thuốc gây nghiện (Morphin, Fentanyl), sau khi tiêm xong cho bệnh nhân, Điều dưỡng bấm nút <strong className="text-amber-800 bg-amber-50 px-1 rounded border border-amber-200">Thu hồi vỏ ống</strong> trực tiếp trên dòng tương ứng để niêm phong vỏ ống vào khay khóa chuyên dụng.
                    </p>
                  </div>

                  <div className="border border-slate-200 rounded-lg p-3">
                    <h5 className="font-bold text-slate-900 mb-1">Bước 3: Hoàn bù cơ số tủ trực &amp; Trừ kho Dược FEFO</h5>
                    <p className="text-slate-600 mb-2">
                      Khi có đơn thuốc bù hợp lệ từ Bác sĩ, nhấn nút <strong className="text-slate-900 bg-slate-100 px-1 rounded border border-slate-300">Hoàn bù cơ số</strong> $\to$ Nhập PIN xác thực lâm sàng. Hệ thống sẽ tự động chuyển trạng thái phiếu nợ thành "Đã hoàn bù" và tự động trừ tồn kho Dược phẩm theo đúng lô cận hạn nhất (FEFO).
                    </p>
                  </div>

                  <div className="border border-slate-200 rounded-lg p-3">
                    <h5 className="font-bold text-slate-900 mb-1">Bước 4: Hội đồng tiêu hủy vỏ ống thuốc gây nghiện</h5>
                    <p className="text-slate-600">
                      Dược sĩ Kho Dược hoặc Giám đốc bấm nút <strong className="text-rose-700 bg-rose-50 px-1 rounded border border-rose-200">Hội đồng hủy vỏ</strong> $\to$ Mở biên bản tiêu hủy Mẫu số 10 $\to$ Ký xác nhận bắt buộc với sự chứng kiến của 02 thành viên (Dược sĩ + Điều dưỡng).
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'tab2' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900">
                  Phân Hệ 2: Sự Cố &amp; Bàn Giao Thiết Bị Y Tế (Nghị Định 98/2021)
                </h3>
                <div className="space-y-3">
                  <div className="border border-slate-200 rounded-lg p-3">
                    <h5 className="font-bold text-slate-900 mb-1">1. Báo hỏng thiết bị y tế từ buồng bệnh</h5>
                    <p className="text-slate-600">
                      Khi máy thở, monitor hoặc máy sốc tim gặp sự cố, điều dưỡng/bác sĩ nhấn nút <strong className="text-rose-700 bg-rose-50 px-1 rounded border border-rose-200">+ Báo Hỏng Thiết Bị</strong> $\to$ Điền thiết bị, vị trí buồng bệnh, mô tả hiện tượng hư hỏng $\to$ Nhấn tạo phiếu để thông báo khẩn cấp cho Kỹ sư TBYT.
                    </p>
                  </div>
                  <div className="border border-slate-200 rounded-lg p-3">
                    <h5 className="font-bold text-slate-900 mb-1">2. Tiếp nhận sửa chữa &amp; Thay thế phụ kiện</h5>
                    <p className="text-slate-600">
                      Kỹ sư TBYT kiểm tra thiết bị, chuyển trạng thái "Đang sửa chữa" và ghi nhận phụ kiện CO/CQ đã thay thế vào sổ theo dõi.
                    </p>
                  </div>
                  <div className="border border-slate-200 rounded-lg p-3">
                    <h5 className="font-bold text-slate-900 mb-1">3. Kiểm định an toàn điện &amp; Ký biên bản bàn giao (Handover)</h5>
                    <p className="text-slate-600">
                      Nhấn nút <strong className="text-emerald-700 bg-emerald-50 px-1 rounded border border-emerald-200">Nghiệm thu &amp; Bàn giao</strong> $\to$ Nhập kết quả thử tải dòng rò điện $\to$ Ký xác thực 02 bên (Kỹ sư TBYT + Bác sĩ/Điều dưỡng khoa nhận máy) theo đúng Điều 34 Nghị định 98/2021.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'tab3' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900">
                  Phân Hệ 3: Kho Dược FEFO &amp; Định Mức An Toàn (TT 36/2018 GSP &amp; TT 22/2011)
                </h3>
                <div className="space-y-3">
                  <div className="border border-slate-200 rounded-lg p-3">
                    <h5 className="font-bold text-slate-900 mb-1">1. Xuất kho theo nguyên tắc FEFO (Hạn ngắn xuất trước)</h5>
                    <p className="text-slate-600">
                      Dược sĩ duyệt xuất lô thuốc bằng cách bấm nút <strong className="text-slate-900 bg-slate-100 px-1 rounded border">Xuất kho FEFO</strong>. Các lô thuốc cận hạn (&lt; 60 ngày) được hệ thống đánh dấu viền đỏ ưu tiên xuất trước để ngăn chặn thuốc quá hạn.
                    </p>
                  </div>
                  <div className="border border-slate-200 rounded-lg p-3">
                    <h5 className="font-bold text-slate-900 mb-1">2. Lập phiếu dự trù bổ sung khi chạm ngưỡng Min</h5>
                    <p className="text-slate-600">
                      Khi số lượng tồn kho chạm ngưỡng tối thiểu an toàn, bấm nút <strong className="text-rose-700 bg-rose-50 px-1 rounded border border-rose-200">Dự trù bổ sung cơ số</strong> $\to$ Xác nhận nhập khẩn cấp để đưa kho về định mức an toàn tối đa.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'tab4' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900">
                  Phân Hệ 4: Dây Chuyền Lạnh Vắc Xin &amp; Biệt Trữ GSP (TT 36/2018/TT-BYT)
                </h3>
                <div className="space-y-3">
                  <div className="border border-slate-200 rounded-lg p-3">
                    <h5 className="font-bold text-slate-900 mb-1">1. Giám sát nhiệt độ 2 - 8°C &amp; Cảnh báo quá nhiệt</h5>
                    <p className="text-slate-600">
                      Hệ thống cảm biến đo nhiệt độ liên tục. Khi nhiệt độ vượt 8°C (hoặc mô phỏng bằng nút "Mô phỏng ngắt điện"), còi báo động sẽ hú vang và vắc xin tự động chuyển sang chế độ Biệt Trữ (Quarantine).
                    </p>
                  </div>
                  <div className="border border-slate-200 rounded-lg p-3">
                    <h5 className="font-bold text-slate-900 mb-1">2. Lệnh giải phóng lô tiêm chủng (Batch Release)</h5>
                    <p className="text-slate-600">
                      Sau khi nhiệt độ được ổn định lại và chỉ thị đông băng VVM đạt chuẩn Cấp 1, Hội đồng Dược bấm nút <strong className="text-emerald-700 bg-emerald-50 px-1 rounded border border-emerald-200">Ký lệnh phóng thích lô</strong> với chứng chỉ hành nghề để cho phép tiếp tục sử dụng.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'tab5' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900">
                  Phân Hệ 5: Kiểm Kê &amp; Thanh Lý Tài Sản Công (Nghị Định 151/2017 &amp; NĐ 114/2024)
                </h3>
                <div className="space-y-3">
                  <div className="border border-slate-200 rounded-lg p-3">
                    <h5 className="font-bold text-slate-900 mb-1">1. Quét mã QR kiểm kê tại giường bệnh</h5>
                    <p className="text-slate-600">
                      Bấm nút <strong className="text-slate-900 bg-slate-100 px-1 rounded border">Quét mã QR kiểm kê</strong> để mô phỏng máy quét thực địa, phát hiện thiết bị bị điều chuyển sai khoa phòng so với sổ kế toán tài sản cố định.
                    </p>
                  </div>
                  <div className="border border-slate-200 rounded-lg p-3">
                    <h5 className="font-bold text-slate-900 mb-1">2. Lập Biên bản điều chuyển tài sản (Mẫu 01/TSC-ĐC)</h5>
                    <p className="text-slate-600">
                      Đối với máy nằm sai buồng, bấm nút <strong className="text-amber-800 bg-amber-50 px-1 rounded border border-amber-200">Điều chuyển</strong> $\to$ Ký biên bản bàn giao giữa Bên giao và Bên nhận theo Điều 39 &amp; 40 Nghị định 151/2017.
                    </p>
                  </div>
                  <div className="border border-slate-200 rounded-lg p-3">
                    <h5 className="font-bold text-slate-900 mb-1">3. Ký Tờ trình Thanh lý Tài sản (Độc quyền Giám đốc)</h5>
                    <p className="text-slate-600">
                      Đối với máy hư hỏng nát ngưng dùng trên 12 tháng hoặc hết thời gian khấu hao, chỉ có <strong>Giám đốc bệnh viện</strong> mới có quyền bấm nút <strong className="text-rose-700 bg-rose-50 px-1 rounded border border-rose-200">Ký Đề Xuất Thanh Lý</strong> để chuyển hồ sơ lên Sở Y tế.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'auth' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900">
                  Ký Số Lâm Sàng &amp; Sổ Nhật Ký Kiểm Toán (Nghị Định 130/2018/NĐ-CP)
                </h3>
                <div className="space-y-3">
                  <div className="border border-slate-200 rounded-lg p-3">
                    <h5 className="font-bold text-slate-900 mb-1">Cơ chế xác thực 2 lớp: Mã PIN chuyên môn &amp; Thẻ nhân viên RFID/NFC</h5>
                    <p className="text-slate-600">
                      Mỗi thao tác làm thay đổi cơ số thuốc hoặc hiện trạng thiết bị cấp cứu đều yêu cầu nhập mã PIN chuyên môn tương ứng với Chứng chỉ hành nghề y tế (CCHN) của người ký. Các nghiệp vụ nhạy cảm (như tiêu hủy Morphin hoặc bàn giao máy thở) bắt buộc phải có thêm chữ ký của Người Làm Chứng độc lập.
                    </p>
                  </div>
                  <div className="border border-slate-200 rounded-lg p-3">
                    <h5 className="font-bold text-slate-900 mb-1">Sổ Nhật Ký Kiểm Toán Không Thể Sửa Đổi (Audit Trail)</h5>
                    <p className="text-slate-600">
                      Bấm nút <strong>Nhật Ký Kiểm Toán</strong> trên thanh tiêu đề để xem toàn bộ lịch sử các giao dịch lâm sàng. Mọi bản ghi đều được khóa sổ bảo mật ngầm, gắn liền với tên bác sĩ/điều dưỡng/kỹ sư, thời gian chính xác và căn cứ pháp luật của Bộ Y Tế.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'ai' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900">
                  Trợ Lý Số AI Lâm Sàng (Tùy Chọn Mở Rộng)
                </h3>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <p className="text-slate-600">
                    Trợ lý AI là một tính năng <strong>hoàn toàn tùy chọn</strong> để nâng cao tiện ích:
                  </p>
                  <ul className="list-disc pl-5 space-y-2 text-slate-600">
                    <li><strong>Mở/Đóng linh hoạt:</strong> Bấm nút <strong>Trợ Lý AI</strong> trên thanh tiêu đề khi cần tra cứu nhanh. Khi đóng lại, màn hình làm việc lâm sàng sẽ mở rộng 100% để hiển thị nhiều thông tin nhất.</li>
                    <li><strong>Khả năng hỗ trợ:</strong> Tra cứu nhanh danh mục thuốc cấp cứu, tìm kiếm máy thở còn hạn tem kiểm định, gợi ý căn cứ điều khoản Thông tư/Nghị định.</li>
                    <li><strong>Đảm bảo an toàn y khoa:</strong> Mọi thao tác thay đổi dữ liệu do AI gợi ý đều vẫn phải trải qua bước Ký số xác thực lâm sàng của nhân viên y tế thật sự.</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="h-12 px-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0 text-xs">
          <span className="text-slate-500">
            Tài liệu lưu trữ đầy đủ tại: <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[11px]">docs/01_Cam_Nang_Toan_Dien_Nghiep_Vu_Y_Te.md</code>
          </span>
          <div className="flex items-center gap-2">
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
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg font-semibold transition cursor-pointer shadow-2xs active:scale-98"
              title="Tải tệp cẩm nang hướng dẫn nghiệp vụ lâm sàng (.md)"
            >
              <Download className="w-3.5 h-3.5 text-teal-700" />
              <span>Tải Cẩm Nang (.md)</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold transition cursor-pointer active:scale-98"
            >
              Đã Hiểu &amp; Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
