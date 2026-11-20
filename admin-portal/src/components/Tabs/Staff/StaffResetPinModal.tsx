import React, { useState } from 'react';
import { X, KeyRound, RefreshCw, ShieldCheck } from 'lucide-react';
import { StaffItem } from '../../../types/staff';

interface StaffResetPinModalProps {
  staff: StaffItem | null;
  isOpen: boolean;
  onClose: () => void;
  onResetPin: (id: string, newPin: string) => Promise<void>;
}

export const StaffResetPinModal: React.FC<StaffResetPinModalProps> = ({
  staff,
  isOpen,
  onClose,
  onResetPin,
}) => {
  const [newPin, setNewPin] = useState('1234');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !staff) return null;

  const handleGenerate = () => {
    const p = String(Math.floor(1000 + Math.random() * 9000));
    setNewPin(p);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.length < 4) {
      setError('Mã PIN phải từ 4 chữ số trở lên.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await onResetPin(staff.id, newPin);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi cập nhật mã PIN.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Cấp lại mã PIN ca trực</h3>
              <p className="text-2xs text-slate-500">{staff.name} ({staff.id})</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Mã PIN mới (4 - 6 số)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                maxLength={6}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                className="flex-1 h-10 px-3 rounded-lg border border-slate-200 font-mono font-bold tracking-widest text-base text-slate-900 text-center focus:border-teal-600 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleGenerate}
                className="px-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700"
              >
                Tạo ngẫu nhiên
              </button>
            </div>
            <p className="text-2xs text-slate-500 mt-1.5">
              Mã PIN được dùng để đăng nhập và ký xác nhận đơn thuốc lâm sàng trên hệ thống.
            </p>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
            >
              {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>Lưu mã PIN mới</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
