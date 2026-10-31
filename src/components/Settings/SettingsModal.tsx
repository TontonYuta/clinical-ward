import React, { useEffect } from 'react';
import { LogOut, Settings, X } from 'lucide-react';
import type { AppFontScale } from '../../utils/storage/appStatePersistence';
import { fontScaleToPixels } from './fontScaleModel';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  fontScale: AppFontScale;
  onFontScaleChange: (scale: AppFontScale) => void;
  isAuthenticated: boolean;
  username?: string;
  roleLabel: string;
  onLogout?: () => Promise<void>;
}

const OPTIONS: Array<{ value: AppFontScale; label: string; sample: string }> = [
  { value: 'compact', label: 'Nhỏ', sample: 'Aa' },
  { value: 'standard', label: 'Tiêu chuẩn', sample: 'Aa' },
  { value: 'large', label: 'Lớn', sample: 'Aa' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, fontScale, onFontScaleChange, isAuthenticated, username, roleLabel, onLogout }) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);
  if (!isOpen) return null;

  return <div className="fixed inset-0 z-[70] flex items-start justify-end bg-slate-950/35" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="app-settings-title" className="h-full w-full max-w-md overflow-y-auto border-l border-slate-300 bg-white shadow-2xl">
      <header className="flex items-center justify-between border-b border-slate-300 px-5 py-4"><div className="flex items-center gap-3"><Settings className="h-5 w-5 text-slate-600" /><div><h2 id="app-settings-title" className="text-lg font-semibold text-slate-950">Cài đặt</h2><p className="text-sm text-slate-500">Tùy chỉnh cách hiển thị và phiên làm việc</p></div></div><button type="button" aria-label="Đóng cài đặt" onClick={onClose} className="p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></header>
      <div className="divide-y divide-slate-200 px-5">
        <section className="py-5"><h3 className="text-sm font-semibold text-slate-900">Cỡ chữ</h3><p className="mt-1 text-sm text-slate-500">Áp dụng cho toàn bộ giao diện trên thiết bị này.</p><div className="mt-3 grid grid-cols-3 border border-slate-300">{OPTIONS.map((option) => <button key={option.value} type="button" aria-pressed={fontScale === option.value} onClick={() => onFontScaleChange(option.value)} className={'border-r border-slate-300 p-3 text-left last:border-r-0 hover:bg-slate-50 ' + (fontScale === option.value ? 'bg-slate-100 ring-2 ring-inset ring-teal-700' : 'bg-white')}><span className="block text-sm font-medium">{option.label}</span><span style={{ fontSize: fontScaleToPixels(option.value) }} className="mt-1 block font-semibold">{option.sample}</span></button>)}</div></section>
        <section className="py-5"><h3 className="text-sm font-semibold text-slate-900">Phiên làm việc</h3><p className="mt-2 text-sm text-slate-700">Vai trò: {roleLabel}</p>{isAuthenticated ? <><p className="mt-1 text-sm text-slate-700">Tài khoản: {username || 'đã đăng nhập'}</p><p className="mt-1 text-xs text-emerald-700">Phiên đã xác thực ở máy chủ.</p>{onLogout && <button type="button" onClick={() => { void onLogout(); onClose(); }} className="mt-4 inline-flex items-center gap-2 border border-rose-300 px-3 py-2 text-sm font-medium text-rose-800 hover:bg-rose-50"><LogOut className="h-4 w-4" />Đăng xuất</button>}</> : <p className="mt-1 text-xs text-amber-800">Chế độ dùng thử: vai trò đang chọn chỉ là mô phỏng, chưa phải tài khoản đã xác thực.</p>}</section>
        <section className="py-5"><h3 className="text-sm font-semibold text-slate-900">Cấu hình khác</h3><p className="mt-1 text-sm text-slate-500">Cấu hình khóa AI được quản lý ở máy chủ và không lưu trong trình duyệt.</p></section>
      </div>
    </section>
  </div>;
};
