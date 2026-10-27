/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Bàn Tra Cứu Dược Thư Quốc Gia Việt Nam & Hướng Dẫn Sử Dụng An Toàn (<=200 LOC)
 * Chuẩn QĐ 2033/QĐ-BYT, QĐ 2147/QĐ-BYT & QĐ 5948/QĐ-BYT
 * Font chữ tăng gấp đôi, hỗ trợ scroll ngang và dọc với thanh scroll siêu mỏng
 */

import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, FileText, ExternalLink, ShieldAlert, HeartPulse, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { ALL_MASTER_MEDICATIONS, removeVietnameseTones } from '../../data/medicationMasterData';
import { getMedicationClinicalProfile } from '../../data/clinicalProfiles';
import { MasterMedication } from '../../types/medication';
import { useModalDismiss } from '../../hooks/useModalDismiss';

interface MedicationSafetyModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMedicationId?: string;
  initialMedicationName?: string;
  defaultTab?: string;
}

// Danh sách thuốc Dược Thư tiêu biểu truy cập nhanh 1-click
const QUICK_LOOKUP_MEDICATIONS = [
  { id: 'b-3', label: 'Morphin 10mg/ml', tag: 'Opioid', page: '1005' },
  { id: 'b-4', label: 'Hadunalin (Adrenalin)', tag: 'Cấp cứu', page: '594' },
  { id: 'b-5', label: 'Kali clorid 10%', tag: 'Điện giải', page: '853' },
  { id: 'b-2', label: 'Ceftriaxona Normon', tag: 'Kháng sinh', page: '371' },
  { id: 'b-7', label: 'Diazepam 10mg', tag: 'An thần', page: '513' },
  { id: 'b-6', label: 'Vancomycin 1g', tag: 'Kháng sinh', page: '1455' },
  { id: 'b-19', label: 'Panfor PR-750 (Metformin)', tag: 'ĐTĐ', page: '965' },
  { id: 'b-18', label: 'Safeesem 5 (Amlodipin)', tag: 'THA', page: '120' },
  { id: 'b-20', label: 'Atorvastatin 20mg', tag: 'Mỡ máu', page: '175' },
  { id: 'b-1', label: 'Paracetamol 500mg', tag: 'Hạ sốt', page: '1118' },
  { id: 'med-enox-01', label: 'Enoxaparin 4000 IU', tag: 'Chống đông', page: '582' },
  { id: 'med-nalox-01', label: 'Naloxon 0.4mg/ml', tag: 'Antidote', page: '1024' },
];

export const MedicationSafetyModal: React.FC<MedicationSafetyModalProps> = ({
  isOpen, onClose, initialMedicationId, initialMedicationName,
}) => {
  useModalDismiss(isOpen, onClose);
  const [selectedMedId, setSelectedMedId] = useState<string>('b-3');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Logic nhận diện thuốc khi mở modal
  useEffect(() => {
    if (!isOpen) return;

    if (initialMedicationId) {
      setSelectedMedId(initialMedicationId);
      setSearchQuery('');
    } else if (initialMedicationName && initialMedicationName.trim()) {
      const q = removeVietnameseTones(initialMedicationName);
      const cleanQ = q.replace(/sulfate|sulfat|hydroclorid|hydrochloride/g, '').trim();
      const found = ALL_MASTER_MEDICATIONS.find((m) => {
        const brand = removeVietnameseTones(m.brandName);
        const active = removeVietnameseTones(m.activeIngredient);
        const code = (m.nationalCode || '').toLowerCase();
        const aliases = (m.searchAliases || []).map(removeVietnameseTones);
        return brand.includes(q) || q.includes(brand) ||
               active.includes(q) || q.includes(active) ||
               code.includes(q) ||
               aliases.some(a => a.includes(q) || q.includes(a)) ||
               (cleanQ.length > 2 && (brand.includes(cleanQ) || active.includes(cleanQ)));
      });

      if (found) {
        setSelectedMedId(found.id);
      } else {
        setSelectedMedId(initialMedicationName);
      }
      setSearchQuery('');
    } else {
      // Mặc định chọn Morphin nếu không truyền thuốc cụ thể để không bị màn hình trống
      setSelectedMedId((prev) => prev || 'b-3');
    }
  }, [initialMedicationId, initialMedicationName, isOpen]);

  // Tìm kiếm tức thì thuốc trong danh mục
  const filteredSearchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = removeVietnameseTones(searchQuery);
    return ALL_MASTER_MEDICATIONS.filter((m) => {
      const brand = removeVietnameseTones(m.brandName);
      const active = removeVietnameseTones(m.activeIngredient);
      const code = (m.nationalCode || '').toLowerCase();
      const aliases = (m.searchAliases || []).map(removeVietnameseTones);
      return brand.includes(q) || active.includes(q) || code.includes(q) || aliases.some(a => a.includes(q));
    }).slice(0, 8);
  }, [searchQuery]);

  if (!isOpen) return null;

  // Lấy dữ liệu thuốc và hồ sơ Dược Thư
  const currentMed: Partial<MasterMedication> =
    ALL_MASTER_MEDICATIONS.find((m) => m.id === selectedMedId) || {
      id: selectedMedId,
      brandName: selectedMedId,
      activeIngredient: selectedMedId,
    };

  const profile = getMedicationClinicalProfile(selectedMedId, currentMed);
  const isVerifiedMonograph = profile.isVerifiedMonograph !== false && Boolean(profile.officialSource?.pdfPage);
  const src = profile.officialSource;
  const pageNum = src?.pdfPage?.toString().split(/[-–\s]+/)[0].trim();
  const pdfUrl = src?.citationUrl || (pageNum ? `/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf#page=${pageNum}` : '/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf');

  return (
    <div
      role="dialog" aria-modal="true" aria-label="Tra Cứu Dược Thư Quốc Gia"
      className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-0 sm:p-5"
    >
      <div className="bg-white rounded-none sm:rounded-2xl shadow-2xl border-0 sm:border border-slate-300 w-full sm:w-[98vw] max-w-7xl h-[100dvh] sm:h-auto sm:max-h-[94vh] flex flex-col overflow-hidden animate-in fade-in duration-100">
        
        {/* Top Header: Thanh tiêu đề tra cứu chuẩn Dược Thư */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 bg-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="pr-2 min-w-0">
            <h2 className="text-lg sm:text-2xl font-black tracking-tight flex items-center gap-2 sm:gap-3 flex-wrap">
              <span>Tra Cứu Dược Thư Quốc Gia</span>
              <span className="text-2xs sm:text-xs font-bold bg-blue-600 text-white px-2 py-0.5 sm:px-3 sm:py-1 rounded-full uppercase tracking-wider">
                QĐ 2033/QĐ-BYT
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 font-normal mt-0.5 sm:mt-1 line-clamp-1 sm:line-clamp-none">
              Bộ Y Tế • Chuyên Luận Dược Thư 2015/2022, Hướng Dẫn Kê Đơn An Toàn 5 Đúng &amp; Tương Tác Thuốc (QĐ 5948)
            </p>
          </div>
          <button
            onClick={onClose}
            data-testid="btn-close-safety-modal"
            className="p-1.5 sm:p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer shrink-0"
            title="Đóng (ESC)"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Search Ribbon & Quick Filter Pills */}
        <div className="px-3 py-2 sm:px-6 sm:py-3 bg-slate-100/90 border-b border-slate-200 shrink-0 space-y-2">
          {/* Ô tìm kiếm thông minh */}
          <div className="relative">
            <Search className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setIsSearchOpen(true); }}
              onFocus={() => setIsSearchOpen(true)}
              placeholder="Nhập tên thuốc, hoạt chất, số đăng ký hoặc mã ATC..."
              className="w-full pl-9 sm:pl-11 pr-9 sm:pr-10 py-2 sm:py-2.5 bg-white border border-slate-300 rounded-xl text-sm sm:text-base font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setIsSearchOpen(false); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* Dropdown kết quả tìm kiếm */}
            {isSearchOpen && filteredSearchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white rounded-xl shadow-2xl border border-slate-300 max-h-80 overflow-y-auto divide-y divide-slate-100 thin-scrollbar">
                {filteredSearchResults.map((med) => (
                  <button
                    key={med.id}
                    type="button"
                    onClick={() => { setSelectedMedId(med.id); setIsSearchOpen(false); setSearchQuery(''); }}
                    className="w-full text-left p-3.5 hover:bg-blue-50/80 transition cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-slate-900 text-base">{med.brandName}</div>
                      <div className="text-sm text-slate-600 mt-0.5">
                        Hoạt chất: <strong className="text-slate-800">{med.activeIngredient}</strong> ({med.concentration}) • SĐK: {med.nationalCode}
                      </div>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md border border-slate-200">
                      {med.group}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Selection Pills: 1-click chuyển nhanh giữa các thuốc Dược Thư */}
          <div className="flex items-center gap-2 overflow-x-auto thin-scrollbar pb-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1">
              Thuốc tiêu biểu:
            </span>
            {QUICK_LOOKUP_MEDICATIONS.map((med) => {
              const isActive = selectedMedId === med.id || selectedMedId.toLowerCase().includes(med.label.toLowerCase().split(' ')[0]);
              return (
                <button
                  key={med.id}
                  type="button"
                  onClick={() => { setSelectedMedId(med.id); setIsSearchOpen(false); setSearchQuery(''); }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer shrink-0 shadow-2xs ${
                    isActive
                      ? 'bg-blue-700 text-white shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-slate-200/80 hover:text-slate-900 border border-slate-300'
                  }`}
                >
                  <span>{med.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${isActive ? 'bg-blue-800 text-blue-100' : 'bg-slate-100 text-slate-600'}`}>
                    Tr.{med.page}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Workstation Body: Font chữ tăng gấp đôi, cuộn ngang & dọc mượt mà với thanh scroll nhỏ */}
        <div className="overflow-x-auto overflow-y-auto thin-scrollbar p-3.5 sm:p-6 flex-1 bg-slate-50/40">
          <div className="w-full sm:min-w-[950px] xl:min-w-[1100px] space-y-4 sm:space-y-6">
            
            {/* 1. Header Tên Thuốc & Định Danh Dược */}
            <div className="bg-white border border-slate-300 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-2xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                      {currentMed.brandName || selectedMedId}
                    </h3>
                    {currentMed.tallManName && (
                      <span className="font-mono text-base font-bold text-teal-950 bg-teal-50 border border-teal-300 px-3 py-1 rounded-lg">
                        {currentMed.tallManName}
                      </span>
                    )}
                    {currentMed.nationalCode && (
                      <span className="font-mono text-base font-bold text-slate-800 bg-slate-100 border border-slate-300 px-3 py-1 rounded-lg">
                        SĐK: {currentMed.nationalCode}
                      </span>
                    )}
                  </div>
                  <p className="text-lg sm:text-xl text-slate-700 mt-2 font-medium">
                    Hoạt chất chính: <strong className="text-slate-950 font-bold">{currentMed.activeIngredient || profile.composition?.activeIngredients?.[0]?.innName}</strong>
                    {currentMed.concentration && <span className="text-slate-600 ml-2">({currentMed.concentration})</span>}
                    {currentMed.route && <span className="text-slate-600 ml-2">• {currentMed.route}</span>}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {profile.composition?.dosageForm && (
                    <span className="px-3.5 py-1.5 rounded-lg text-sm font-bold bg-slate-100 text-slate-800 border border-slate-300">
                      {profile.composition.dosageForm}
                    </span>
                  )}
                  {profile.atcCode && (
                    <span className="px-3.5 py-1.5 rounded-lg text-sm font-mono font-bold bg-blue-50 text-blue-900 border border-blue-300">
                      ATC: {profile.atcCode}
                    </span>
                  )}
                </div>
              </div>

              {/* Căn cứ pháp lý & Tri thức: Phân biệt minh bạch giữa Dược Thư 2015 và CSDL Cục QLD */}
              {isVerifiedMonograph ? (
                <div className="mt-3 p-4 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center justify-between flex-wrap gap-3">
                  <div className="space-y-1">
                    <div className="text-xs uppercase font-bold tracking-wider text-blue-800">
                      Căn cứ chuyên luận y khoa chuẩn Bộ Y Tế
                    </div>
                    <div className="text-base sm:text-lg font-bold text-blue-950">
                      {src?.documentName || 'Dược thư Quốc gia Việt Nam (Lần xuất bản II - 2015, QĐ 2033/QĐ-BYT)'}
                    </div>
                    {src?.pdfPage && (
                      <div className="text-sm sm:text-base text-blue-900 font-semibold">
                        Chuyên luận tra cứu: <span className="font-mono font-black text-blue-950 bg-white px-2.5 py-0.5 rounded border border-blue-300">Trang {src.pdfPage}</span>
                        {src.manufacturer && <span className="ml-3 font-normal text-slate-600">• Cơ sở: {src.manufacturer}</span>}
                      </div>
                    )}
                  </div>

                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-sm sm:text-base shadow-xs transition active:scale-98 cursor-pointer"
                    title="Mở tài liệu PDF Dược Thư gốc tại trang chuyên luận"
                  >
                    <FileText className="w-5 h-5 text-blue-200" />
                    <span>Mở PDF Dược Thư {pageNum ? `(Trang ${pageNum})` : ''}</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              ) : (
                <div className="mt-3 p-4 bg-amber-50/80 border border-amber-200 rounded-xl flex items-center justify-between flex-wrap gap-3">
                  <div className="space-y-1">
                    <div className="text-xs uppercase font-bold tracking-wider text-amber-800">
                      Căn cứ Cục Quản lý Dược (Bộ Y Tế)
                    </div>
                    <div className="text-base sm:text-lg font-bold text-amber-950">
                      Chưa có chuyên luận riêng trong Dược thư Quốc gia 2015 (QĐ 2033/QĐ-BYT)
                    </div>
                    <div className="text-sm sm:text-base text-amber-900 font-medium">
                      Dược Thư chỉ gồm ~700 hoạt chất gốc (Generic). Tra cứu trực tiếp theo Tờ Hướng Dẫn Sử Dụng (HDSD) và Nhãn gốc được Cục QLD phê duyệt.
                    </div>
                  </div>

                  <a
                    href={currentMed.nationalCode ? `https://dichvucong.dav.gov.vn/congbothuoc/index?search=${encodeURIComponent(currentMed.nationalCode)}` : 'https://dichvucong.dav.gov.vn/congbothuoc/index'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-sm sm:text-base shadow-xs transition active:scale-98 cursor-pointer"
                    title="Tra cứu hồ sơ công bố và Tờ HDSD gốc tại Cục Quản lý Dược"
                  >
                    <ExternalLink className="w-5 h-5 text-slate-300" />
                    <span>Tra cứu Cổng Dịch vụ công Cục QLD {currentMed.nationalCode ? `(SĐK: ${currentMed.nationalCode})` : ''}</span>
                  </a>
                </div>
              )}
            </div>

            {/* NẾU KHÔNG CÓ CHUYÊN LUẬN DƯỢC THƯ: HIỂN THỊ HƯỚNG DẪN THỰC HÀNH Y LỆNH & LOẠI BỎ DỮ LIỆU BỊA ĐẶT */}
            {!isVerifiedMonograph ? (
              <div className="space-y-5">
                <div className="bg-amber-50/80 border-2 border-amber-300 rounded-2xl p-6 shadow-2xs space-y-3">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-7 h-7 text-amber-700 shrink-0" />
                    <div>
                      <h4 className="text-xl sm:text-2xl font-black text-amber-950">
                        Nguyên Tắc Sử Dụng An Toàn Theo Hồ Sơ Cục Quản Lý Dược
                      </h4>
                      <p className="text-base text-amber-800 font-medium">
                        Quy chế Dược bệnh viện &amp; Thông tư số 22/2011/TT-BYT
                      </p>
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-amber-200 text-base sm:text-lg text-slate-800 space-y-3 leading-relaxed">
                    <p>
                      • <strong>Chỉ định &amp; Liều dùng:</strong> Thực hiện theo đơn thuốc và y lệnh của Bác sĩ điều trị. Tham khảo chỉ định, liều dùng và chống chỉ định chi tiết trên <strong>Tờ Hướng Dẫn Sử Dụng (HDSD)</strong> đi kèm hộp thuốc do Cục Quản lý Dược phê duyệt.
                    </p>
                    <p>
                      • <strong>Đánh giá tiền sử:</strong> Bắt buộc khai thác tiền sử dị ứng thuốc và bệnh nền (suy gan, suy thận, thai kỳ) trước khi thực hiện y lệnh.
                    </p>
                    <p>
                      • <strong>Đối chứng pháp lý:</strong> Nhân viên y tế có thể mở xem trực tiếp Giấy phép công bố lưu hành thuốc tại Cổng Dịch vụ công Cục Quản lý Dược.
                    </p>
                  </div>
                </div>

                {/* QUY CHUẨN AN TOÀN 5 ĐÚNG (QĐ 2147/BYT) */}
                <div className="bg-white border border-slate-300 rounded-2xl p-6 shadow-2xs space-y-3">
                  <div className="border-b border-slate-200 pb-3">
                    <h4 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                      Quy Chuẩn An Toàn 5 Đúng Trong Sử Dụng Thuốc (QĐ 2147/QĐ-BYT)
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-base sm:text-lg">
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="font-bold text-slate-900 block mb-1">1. Đúng Người Bệnh:</span>
                      <span className="text-slate-700 text-sm sm:text-base">Đối soát họ tên, mã người bệnh và vòng đeo tay.</span>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="font-bold text-slate-900 block mb-1">2. Đúng Thuốc (Tall Man):</span>
                      <span className="font-mono text-teal-900 font-bold text-sm sm:text-base">{profile.tallManLASA || currentMed.brandName}</span>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="font-bold text-slate-900 block mb-1">3. Đúng Liều Lượng:</span>
                      <span className="text-slate-700 text-sm sm:text-base">{profile.standardDosing || 'Theo y lệnh bác sĩ'}</span>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="font-bold text-slate-900 block mb-1">4. Đúng Đường Dùng:</span>
                      <span className="text-slate-700 text-sm sm:text-base">{currentMed.route || 'Đường dùng theo chỉ định'}</span>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="font-bold text-slate-900 block mb-1">5. Đúng Thời Điểm:</span>
                      <span className="text-slate-700 text-sm sm:text-base">{profile.timingAndFrequency || 'Theo lịch cấp phát'}</span>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="font-bold text-slate-900 block mb-1">Dung Môi Tương Thích:</span>
                      <span className="text-slate-700 text-sm sm:text-base">Theo Tờ HDSD nhà sản xuất</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
            {/* 2. CẢNH BÁO CHỐNG CHỈ ĐỊNH TUYỆT ĐỐI (CẤM KỴ TỬ VONG) */}
            {(profile.contraindications?.length > 0 || profile.blackBoxWarning) && (
              <div className="bg-red-50/80 border-2 border-red-300 rounded-2xl p-6 shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-red-200 pb-3">
                  <h4 className="text-xl sm:text-2xl font-black text-red-950 uppercase tracking-wide flex items-center gap-2">
                    <ShieldAlert className="w-6 h-6 text-red-700 shrink-0" />
                    <span>Chống Chỉ Định Tuyệt Đối &amp; Cảnh Báo Nguy Hiểm</span>
                  </h4>
                  <span className="px-3 py-1 rounded-full text-xs sm:text-sm font-black bg-red-700 text-white uppercase">
                    Cấm Kỵ
                  </span>
                </div>

                {profile.blackBoxWarning && (
                  <p className="text-base sm:text-lg font-bold text-red-900 bg-white/80 p-3.5 rounded-xl border border-red-200 leading-relaxed">
                    ⚠️ {profile.blackBoxWarning}
                  </p>
                )}

                <ul className="space-y-2 text-base sm:text-lg text-red-950 font-semibold leading-relaxed">
                  {profile.contraindications.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <span className="font-black text-red-700 select-none text-xl leading-none mt-1">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 3. CHỈ ĐỊNH ĐIỀU TRỊ CHÍNH THỨC */}
            <div className="bg-white border border-slate-300 rounded-2xl p-6 shadow-2xs space-y-3">
              <div className="border-b border-slate-200 pb-3">
                <h4 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                  <span>Chỉ Định Điều Trị Lâm Sàng Được Bộ Y Tế Phê Duyệt</span>
                </h4>
              </div>
              <ul className="space-y-2.5 text-base sm:text-lg text-slate-800 leading-relaxed sm:leading-loose">
                {(profile.indications || []).map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="font-bold text-emerald-600 select-none text-xl leading-none mt-1">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 4. LIỀU LƯỢNG, ĐƯỜNG DÙNG & CHỈNH LIỀU SUY THẬN (COCKCROFT-GAULT) */}
            <div className="bg-white border border-slate-300 rounded-2xl p-6 shadow-2xs space-y-4">
              <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
                <h4 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <HeartPulse className="w-6 h-6 text-blue-600 shrink-0" />
                  <span>Liều Dùng Chuẩn &amp; Hiệu Chỉnh Liều Suy Thận (Cockcroft-Gault)</span>
                </h4>
                <span className="text-xs sm:text-sm font-bold px-3 py-1 bg-blue-50 text-blue-900 border border-blue-200 rounded-md">
                  Liều lượng &amp; Cách dùng
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-base sm:text-lg">
                <div className="bg-slate-50 p-4.5 rounded-xl border border-slate-200 space-y-2">
                  <div className="font-bold text-slate-900 text-lg sm:text-xl">Liều Dùng Tiêu Chuẩn:</div>
                  <p className="text-slate-800 leading-relaxed font-medium">
                    {profile.standardDosing || 'Tuân thủ theo chỉ định liều của bác sĩ điều trị và hướng dẫn ghi trên nhãn.'}
                  </p>
                  {profile.maxDailyDose && (
                    <div className="text-sm sm:text-base font-bold text-rose-800 pt-2 border-t border-slate-200">
                      Trần liều tối đa: <span className="font-mono">{profile.maxDailyDose}</span>
                    </div>
                  )}
                </div>

                <div className="bg-amber-50/80 p-4.5 rounded-xl border border-amber-200 space-y-2">
                  <div className="font-bold text-amber-950 text-lg sm:text-xl">Hiệu Chỉnh Liều Theo Độ Thanh Thải Thận (ClCr / eGFR):</div>
                  <p className="text-amber-950 leading-relaxed font-semibold">
                    {profile.renalAdjustment || 'Hiệu chỉnh giảm liều hoặc kéo dài khoảng cách liều khi eGFR < 50 mL/phút.'}
                  </p>
                  {profile.hepaticAdjustment && (
                    <div className="text-sm sm:text-base text-amber-900 pt-2 border-t border-amber-200">
                      Suy gan: <strong>{profile.hepaticAdjustment}</strong>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 5. THUỐC GIẢI ĐỘC ĐẶC HIỆU (ANTIDOTE) & XỬ TRÍ QUÁ LIỀU */}
            {profile.antidote && (
              <div className="bg-emerald-50/90 border-2 border-emerald-300 rounded-2xl p-6 shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-emerald-200 pb-3">
                  <h4 className="text-xl sm:text-2xl font-black text-emerald-950 uppercase tracking-wide flex items-center gap-2">
                    <span>Thuốc Giải Độc Đặc Hiệu (Antidote) &amp; Cấp Cứu Quá Liều</span>
                  </h4>
                  <span className="px-3 py-1 rounded-full text-xs sm:text-sm font-black bg-emerald-700 text-white uppercase">
                    Cấp Cứu
                  </span>
                </div>
                <div className="text-lg sm:text-xl font-bold text-emerald-950 bg-white/90 p-4 rounded-xl border border-emerald-200 leading-relaxed">
                  {profile.antidote}
                </div>
              </div>
            )}

            {/* 6. TƯƠNG TÁC THUỐC CHỐNG CHỈ ĐỊNH (QUYẾT ĐỊNH 5948/BYT) & TÁC DỤNG PHỤ (ADR) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Cột Tương tác thuốc */}
              <div className="bg-white border border-slate-300 rounded-2xl p-6 shadow-2xs space-y-3">
                <div className="border-b border-slate-200 pb-3">
                  <h4 className="text-xl sm:text-2xl font-bold text-rose-950 tracking-tight flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                    <span>Tương Tác Chống Chỉ Định (QĐ 5948/BYT)</span>
                  </h4>
                </div>
                <ul className="space-y-2.5 text-base sm:text-lg text-rose-950 font-semibold leading-relaxed">
                  {(profile.ddiWarnings || ['Kiểm tra các thuốc dùng kèm trước khi phối hợp.']).map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <span className="font-black text-rose-600 select-none text-xl leading-none mt-1">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Cột Tác dụng phụ thường gặp & Theo dõi */}
              <div className="bg-white border border-slate-300 rounded-2xl p-6 shadow-2xs space-y-3">
                <div className="border-b border-slate-200 pb-3">
                  <h4 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                    Tác Dụng Phụ (ADR) &amp; Giám Sát Lâm Sàng
                  </h4>
                </div>
                <div className="space-y-3 text-base sm:text-lg text-slate-800 leading-relaxed">
                  <div className="flex flex-wrap gap-2">
                    {(profile.adverseReactions || []).map((adr, idx) => (
                      <span key={idx} className="px-3 py-1 bg-slate-100 text-slate-800 rounded-lg border border-slate-200 font-semibold text-sm sm:text-base">
                        • {adr}
                      </span>
                    ))}
                  </div>
                  {profile.clinicalMonitoring && (
                    <div className="pt-2 border-t border-slate-200 text-slate-700">
                      <strong>Theo dõi lâm sàng: </strong>{profile.clinicalMonitoring}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 7. QUY CHUẨN AN TOÀN 5 ĐÚNG (QĐ 2147/BYT) */}
            <div className="bg-white border border-slate-300 rounded-2xl p-6 shadow-2xs space-y-3">
              <div className="border-b border-slate-200 pb-3">
                <h4 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Quy Chuẩn An Toàn 5 Đúng Trong Sử Dụng Thuốc (QĐ 2147/QĐ-BYT)
                </h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-base sm:text-lg">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-900 block mb-1">1. Đúng Người Bệnh:</span>
                  <span className="text-slate-700 text-sm sm:text-base">Đối soát họ tên, mã người bệnh và vòng đeo tay.</span>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-900 block mb-1">2. Đúng Thuốc (Tall Man):</span>
                  <span className="font-mono text-teal-900 font-bold text-sm sm:text-base">{profile.tallManLASA || currentMed.brandName}</span>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-900 block mb-1">3. Đúng Liều Lượng:</span>
                  <span className="text-slate-700 text-sm sm:text-base">{profile.standardDosing || 'Theo y lệnh bác sĩ'}</span>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-900 block mb-1">4. Đúng Đường Dùng:</span>
                  <span className="text-slate-700 text-sm sm:text-base">{currentMed.route || 'Đường dùng theo chỉ định'}</span>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-900 block mb-1">5. Đúng Thời Điểm:</span>
                  <span className="text-slate-700 text-sm sm:text-base">{profile.timingAndFrequency || 'Theo lịch cấp phát'}</span>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-900 block mb-1">Dung Môi Tương Thích:</span>
                  <span className="text-slate-700 text-sm sm:text-base">{(profile.compatibleDiluents || ['NaCl 0.9%', 'Glucose 5%']).join(', ')}</span>
                </div>
              </div>
            </div>
              </>
            )}

          </div>
        </div>

        {/* Pinned Footer */}
        <div className="px-6 py-3.5 bg-white border-t border-slate-300 flex items-center justify-between shrink-0">
          <div className="text-sm text-slate-600 font-medium hidden sm:block">
            Cơ sở dữ liệu Dược Thư Quốc Gia Việt Nam • Cục Quản Lý Dược (Bộ Y Tế)
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-base cursor-pointer transition shadow-2xs ml-auto active:scale-98"
          >
            Đóng (ESC)
          </button>
        </div>

      </div>
    </div>
  );
};
