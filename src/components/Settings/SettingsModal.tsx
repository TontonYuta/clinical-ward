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
        <section className="py-5"><h3 className="text-sm font-semibold text-slate-900">Cỡ chữ</h3><p className="mt-1 text-sm text-slate-500">Chọn chính xác kích thước chữ từ 12 đến 24 px.</p><div className="mt-4 flex items-center gap-3"><input aria-label="Cỡ chữ theo pixel" type="range" min="12" max="24" step="0.5" value={fontScaleToPixels(fontScale)} onChange={(event) => onFontScaleChange(Number(event.target.value))} className="min-w-0 flex-1 accent-teal-700" /><output className="w-16 rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-center text-sm font-semibold text-slate-800">{fontScaleToPixels(fontScale)} px</output></div><div className="mt-3 rounded-lg bg-slate-50 p-3 font-semibold text-slate-800" style={{ fontSize: fontScaleToPixels(fontScale) }}>Aa — Văn bản mẫu</div></section>
        <section className="py-5"><h3 className="text-sm font-semibold text-slate-900">Phiên làm việc</h3><p className="mt-2 text-sm text-slate-700">Vai trò: {roleLabel}</p>{isAuthenticated ? <><p className="mt-1 text-sm text-slate-700">Tài khoản: {username || 'đã đăng nhập'}</p><p className="mt-1 text-xs text-emerald-700">Phiên đã xác thực ở máy chủ.</p>{onLogout && <button type="button" onClick={() => { void onLogout(); onClose(); }} className="mt-4 inline-flex items-center gap-2 border border-rose-300 px-3 py-2 text-sm font-medium text-rose-800 hover:bg-rose-50"><LogOut className="h-4 w-4" />Đăng xuất</button>}</> : <p className="mt-1 text-xs text-amber-800">Chế độ dùng thử: vai trò đang chọn chỉ là mô phỏng, chưa phải tài khoản đã xác thực.</p>}</section>
        <section className="py-5"><h3 className="text-sm font-semibold text-slate-900">Cấu hình khác</h3><p className="mt-1 text-sm text-slate-500">Cấu hình khóa AI được quản lý ở máy chủ và không lưu trong trình duyệt.</p></section>
      </div>
    </section>
  </div>;
};
