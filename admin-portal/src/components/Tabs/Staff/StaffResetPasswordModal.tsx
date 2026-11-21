import React, { useState } from 'react';
import { X, KeyRound, RefreshCw, Copy, Check, ShieldCheck, Lock, ShieldAlert } from 'lucide-react';
import { StaffItem } from '../../../types/staff';

interface StaffResetPasswordModalProps {
  staff: StaffItem | null;
  isOpen: boolean;
  onClose: () => void;
  onResetPassword: (id: string, newPassword: string, mustChangePassword: boolean) => Promise<void>;
}

export const StaffResetPasswordModal: React.FC<StaffResetPasswordModalProps> = ({
  staff,
  isOpen,
  onClose,
  onResetPassword,
}) => {
  const [newPassword, setNewPassword] = useState('Hospital@2026');
  const [mustChangePassword, setMustChangePassword] = useState(true);
  const [showPassword, setShowPassword] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !staff) return null;

  const handleGenerate = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let pwd = 'Med@';
    for (let i = 0; i < 8; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(pwd);
    setCopied(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(newPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const getPasswordStrength = (pwd: string) => {
    if (pwd.length < 6) return { label: 'Quá ngắn', color: 'bg-rose-500', text: 'text-rose-600', score: 1 };
    let score = 1;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^a-zA-Z0-9]/.test(pwd)) score++;

    if (score <= 2) return { label: 'Yếu', color: 'bg-amber-500', text: 'text-amber-600', score: 2 };
    if (score <= 4) return { label: 'Trung bình', color: 'bg-teal-500', text: 'text-teal-600', score: 3 };
    return { label: 'Rất mạnh', color: 'bg-emerald-500', text: 'text-emerald-600', score: 4 };
  };

  const strength = getPasswordStrength(newPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError('Mật khẩu mới phải có tối thiểu 6 ký tự.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await onResetPassword(staff.id, newPassword, mustChangePassword);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi cấp lại mật khẩu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Cấp lại mật khẩu Web</h3>
              <p className="text-2xs text-slate-500">
                {staff.name} {staff.username ? `(@${staff.username})` : `(${staff.id})`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>Mật khẩu mới</span>
              </label>
              <span className={`text-2xs font-semibold ${strength.text}`}>
                Độ mạnh: {strength.label}
              </span>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  maxLength={64}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setCopied(false);
                  }}
                  className="w-full h-10 px-3 pr-9 border border-slate-200 rounded-xl font-mono text-sm tracking-wide text-slate-900 bg-slate-50/50 focus:bg-white focus:border-teal-600 focus:outline-none transition shadow-xs"
                  placeholder="Nhập mật khẩu mới..."
                />
              </div>

              <button
                type="button"
                onClick={handleGenerate}
                className="px-3 h-10 rounded-xl border border-slate-200 hover:border-teal-300 hover:bg-teal-50/50 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                title="Sinh mật khẩu ngẫu nhiên an toàn"
              >
                <RefreshCw className="w-3.5 h-3.5 text-teal-700" />
                <span>Sinh ngẫu nhiên</span>
              </button>

              <button
                type="button"
                onClick={handleCopy}
                className={`px-3 h-10 rounded-xl border text-xs font-medium flex items-center gap-1 transition cursor-pointer ${
                  copied
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                }`}
                title="Sao chép mật khẩu"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Đã chép' : 'Sao chép'}</span>
              </button>
            </div>

            {/* Strength meter bars */}
            <div className="flex gap-1 mt-2">
              {[1, 2, 3, 4].map((level) => (
                <div
                  key={level}
                  className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                    strength.score >= level ? strength.color : 'bg-slate-200'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Must change password checkbox */}
          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={mustChangePassword}
                onChange={(e) => setMustChangePassword(e.target.checked)}
                className="mt-0.5 rounded text-teal-700 focus:ring-teal-600 cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-semibold text-slate-800 block">
                  Bắt buộc đổi mật khẩu ở lần đăng nhập tiếp theo
                </span>
                <span className="text-slate-500 text-2xs block mt-0.5">
                  Khuyến nghị tuân thủ bảo mật ISO 27001 và quy chế an toàn bệnh viện.
                </span>
              </div>
            </label>
          </div>

          {/* Legal / Audit Note */}
          <div className="p-2.5 rounded-lg bg-teal-50/60 border border-teal-200/50 flex items-start gap-2 text-2xs text-teal-800">
            <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
            <span>
              Thao tác này được mã hóa bảo mật Argon2id và ghi vết kiểm toán y tế (Nghị định 13/2023/NĐ-CP). Các phiên đăng nhập cũ của nhân sự sẽ tự động bị thu hồi.
            </span>
          </div>

          {/* Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang cập nhật...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Xác nhận cấp lại</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
