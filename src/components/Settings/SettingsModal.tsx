/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Bảng Cấu Hình Hiển Thị: Cỡ chữ & Phông chữ (Inter, Arial, Roboto, Be Vietnam Pro, Times New Roman)
 */

import React, { useEffect } from 'react';
import { Settings, X, RotateCcw, Type, Check } from 'lucide-react';
import type { AppFontScale, AppFontFamily } from '../../utils/storage/appStatePersistence';
import { FONT_FAMILY_OPTIONS } from '../../utils/storage/appStatePersistence';
import { fontScaleToPixels } from './fontScaleModel';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  fontScale: AppFontScale;
  onFontScaleChange: (scale: AppFontScale) => void;
  fontFamily: AppFontFamily;
  onFontFamilyChange: (font: AppFontFamily) => void;
  isAuthenticated?: boolean;
  username?: string;
  roleLabel?: string;
  onLogout?: () => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  fontScale,
  onFontScaleChange,
  fontFamily,
  onFontFamilyChange,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentPixels = fontScaleToPixels(fontScale);
  const selectedOption = FONT_FAMILY_OPTIONS.find((f) => f.id === fontFamily) || FONT_FAMILY_OPTIONS[0];

  const handleResetDefault = () => {
    onFontScaleChange(16);
    onFontFamilyChange('inter');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-settings-title"
      data-testid="settings-modal"
      className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-5 md:p-8 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-100"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full sm:max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-100">
        {/* Header Tối Giản */}
        <header className="h-16 px-6 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
              <Settings className="w-4 h-4 text-slate-700" />
            </div>
            <div>
              <h2 id="app-settings-title" className="text-base font-bold text-slate-900">
                Cấu hình hiển thị
              </h2>
              <p className="text-xs text-slate-400">Tùy chỉnh cỡ chữ &amp; phông chữ toàn hệ thống</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Đóng cài đặt"
            onClick={onClose}
            className="p-2 -mr-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Nội Dung Cấu Hình */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* 1. Điều Chỉnh Cỡ Chữ */}
          <section className="space-y-3 pb-6 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <label htmlFor="font-size-slider" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Cỡ chữ giao diện
              </label>
              <output className="px-2.5 py-0.5 rounded-md border border-slate-200 bg-slate-50 font-mono text-xs font-bold text-slate-800">
                {currentPixels} px
              </output>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <span className="text-xs font-medium text-slate-400">12px</span>
              <input
                id="font-size-slider"
                aria-label="Cỡ chữ theo pixel"
                type="range"
                min="12"
                max="24"
                step="0.5"
                value={currentPixels}
                onChange={(e) => onFontScaleChange(Number(e.target.value))}
                className="min-w-0 flex-1 accent-slate-900 cursor-pointer h-2 bg-slate-100 rounded-lg"
              />
              <span className="text-xs font-medium text-slate-400">24px</span>
            </div>

            <div className="flex justify-between text-[11px] text-slate-400 pt-0.5">
              <span>Nhỏ gọn (14px)</span>
              <span>Chuẩn mặc định (16px)</span>
              <span>Lớn (18px+)</span>
            </div>
          </section>

          {/* 2. Lựa Chọn Phông Chữ (Bao gồm Arial) */}
          <section className="space-y-3 pb-6 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5 text-slate-500" />
                Phông chữ hiển thị
              </h3>
              <span className="text-xs text-teal-700 font-medium">
                {selectedOption.label}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              {FONT_FAMILY_OPTIONS.map((opt) => {
                const isSelected = fontFamily === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onFontFamilyChange(opt.id)}
                    className={`flex items-center justify-between p-3 rounded-xl border text-left transition cursor-pointer ${
                      isSelected
                        ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                        : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <p
                        className="text-sm font-bold truncate"
                        style={{ fontFamily: opt.fontFamily }}
                      >
                        {opt.label}
                      </p>
                      <p
                        className={`text-[11px] truncate mt-0.5 ${
                          isSelected ? 'text-slate-300' : 'text-slate-400'
                        }`}
                      >
                        {opt.desc}
                      </p>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-white shrink-0 ml-2" />}
                  </button>
                );
              })}
            </div>
          </section>

          {/* 3. Khối Xem Trước Trực Tiếp (Live Preview) */}
          <section className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Xem trước văn bản thực tế
            </h4>
            <div
              className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5 transition-all"
              style={{
                fontFamily: selectedOption.fontFamily,
                fontSize: `${currentPixels}px`,
                lineHeight: 1.5,
              }}
            >
              <p className="font-bold text-slate-900">
                Bệnh Viện Đa Khoa — Khoa Hồi Sức Tích Cực
              </p>
              <p className="text-slate-700">
                Đơn thuốc: Paracetamol 500mg · Uống 01 viên khi sốt ≥ 38.5°C
              </p>
              <p className="text-xs text-slate-500 font-normal">
                Aa Bb Cc Dd Ee Gg Hh Ii Kk Ll Mm Nn 0123456789
              </p>
            </div>
          </section>
        </div>

        {/* Footer */}
        <footer className="h-16 px-6 border-t border-slate-100 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleResetDefault}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 font-medium cursor-pointer transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Khôi phục mặc định
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition cursor-pointer active:scale-95"
          >
            Hoàn tất
          </button>
        </footer>
      </div>
    </div>
  );
};
