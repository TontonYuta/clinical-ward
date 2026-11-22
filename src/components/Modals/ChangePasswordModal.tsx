/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Modal Đổi Mật Khẩu Cá Nhân Chuẩn An Toàn Y Tế (NIST SP 800-63B)
 */

import React, { useState, useId, useMemo } from 'react';
import {
  KeyRound,
  ShieldCheck,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  Lock,
} from 'lucide-react';
import { changeStaffPassword } from '../../services/passwordApi';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  isMandatoryFirstTime?: boolean;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  isMandatoryFirstTime = false,
}) => {
  const currentPasswordId = useId();
  const newPasswordId = useId();
  const confirmPasswordId = useId();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Password rules validation
  const rules = useMemo(() => {
    const hasMinLen = newPassword.length >= 8;
    const hasLower = /[a-z]/.test(newPassword);
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?/~`'"]/.test(newPassword);
    const isDifferent = newPassword !== '' && newPassword !== currentPassword;
    const isMatch = newPassword !== '' && newPassword === confirmPassword;

    let score = 0;
    if (hasMinLen) score += 1;
    if (hasLower && hasUpper) score += 1;
    if (hasNumber) score += 1;
    if (hasSpecial) score += 1;

    return {
      hasMinLen,
      hasLowerAndUpper: hasLower && hasUpper,
      hasNumber,
      hasSpecial,
      isDifferent,
      isMatch,
      score,
      allValid: hasMinLen && hasLower && hasUpper && hasNumber && hasSpecial && isDifferent && isMatch,
    };
  }, [newPassword, currentPassword, confirmPassword]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!currentPassword) {
      setErrorMessage('Vui lòng nhập mật khẩu hiện tại.');
      return;
    }

    if (!rules.allValid) {
      if (!rules.isMatch) {
        setErrorMessage('Mật khẩu xác nhận không khớp với mật khẩu mới.');
      } else if (!rules.isDifferent) {
        setErrorMessage('Mật khẩu mới không được trùng với mật khẩu hiện tại.');
      } else {
        setErrorMessage('Mật khẩu mới chưa đáp ứng đầy đủ các tiêu chuẩn bảo mật bên dưới.');
      }
      return;
    }

    setLoading(true);
    try {
      const res = await changeStaffPassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      setSuccessMessage(res.message || 'Đổi mật khẩu thành công!');
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
        // Reset form
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setSuccessMessage('');
        setErrorMessage('');
      }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Có lỗi xảy ra khi đổi mật khẩu.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const strengthLabels = ['Rất yếu', 'Yếu', 'Trung bình', 'Khá', 'Mạnh'];
  const strengthColors = [
    'bg-slate-200',
    'bg-rose-500',
    'bg-amber-500',
    'bg-blue-500',
    'bg-emerald-500',
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="change-password-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-teal-50/60 to-slate-50">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 text-teal-700 shadow-xs">
              <KeyRound className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {isMandatoryFirstTime ? 'Cập Nhật Mật Khẩu Lần Đầu' : 'Đổi Mật Khẩu Cá Nhân'}
              </h2>
              <p className="text-xs text-slate-500">
                Tiêu chuẩn an toàn thông tin y tế BYT & NIST SP 800-63B
              </p>
            </div>
          </div>
          {!isMandatoryFirstTime && (
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="text-slate-400 hover:text-slate-600 rounded-lg p-1.5 hover:bg-slate-100 transition"
              aria-label="Đóng"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[80vh]">
          {isMandatoryFirstTime && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              <span>
                Theo quy định an toàn thông tin của bệnh viện, nhân viên cần đổi mật khẩu khởi tạo ở lần đăng nhập đầu tiên trước khi tiếp tục nghiệp vụ.
              </span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-700 animate-in fade-in">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-xs text-emerald-800 animate-in fade-in">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <div className="flex-1 font-semibold">{successMessage}</div>
            </div>
          )}

          {/* 1. Mật khẩu hiện tại */}
          <div>
            <label htmlFor={currentPasswordId} className="block text-xs font-semibold text-slate-700 mb-1">
              Mật khẩu hiện tại <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                id={currentPasswordId}
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Nhập mật khẩu đang sử dụng"
                disabled={loading}
                required
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 pr-10 transition"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((p) => !p)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                tabIndex={-1}
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* 2. Mật khẩu mới */}
          <div>
            <label htmlFor={newPasswordId} className="block text-xs font-semibold text-slate-700 mb-1">
              Mật khẩu mới <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                id={newPasswordId}
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Tối thiểu 8 ký tự, gồm chữ hoa, số & ký tự đặc biệt"
                disabled={loading}
                required
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 pr-10 transition"
              />
              <button
                type="button"
                onClick={() => setShowNew((p) => !p)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                tabIndex={-1}
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* Thanh đo độ mạnh mật khẩu */}
            {newPassword && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Độ mạnh mật khẩu:</span>
                  <span className="font-semibold text-slate-700">{strengthLabels[rules.score]}</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 h-1.5">
                  {[1, 2, 3, 4].map((step) => (
                    <div
                      key={step}
                      className={`h-full rounded-full transition-colors ${
                        rules.score >= step ? strengthColors[rules.score] : 'bg-slate-100'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Tiêu chí an toàn (Checklist) */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5 text-xs">
            <p className="font-semibold text-slate-700 text-[11px] mb-1">Yêu cầu bảo mật mật khẩu:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
              <div className={`flex items-center gap-1.5 ${rules.hasMinLen ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                <CheckCircle2 className={`h-3.5 w-3.5 ${rules.hasMinLen ? 'text-emerald-600' : 'text-slate-300'}`} />
                <span>Tối thiểu 8 ký tự</span>
              </div>
              <div className={`flex items-center gap-1.5 ${rules.hasLowerAndUpper ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                <CheckCircle2 className={`h-3.5 w-3.5 ${rules.hasLowerAndUpper ? 'text-emerald-600' : 'text-slate-300'}`} />
                <span>Chữ hoa (A-Z) & chữ thường (a-z)</span>
              </div>
              <div className={`flex items-center gap-1.5 ${rules.hasNumber ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                <CheckCircle2 className={`h-3.5 w-3.5 ${rules.hasNumber ? 'text-emerald-600' : 'text-slate-300'}`} />
                <span>Chứa ít nhất 1 chữ số (0-9)</span>
              </div>
              <div className={`flex items-center gap-1.5 ${rules.hasSpecial ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                <CheckCircle2 className={`h-3.5 w-3.5 ${rules.hasSpecial ? 'text-emerald-600' : 'text-slate-300'}`} />
                <span>Chứa ký tự đặc biệt (!@#$...)</span>
              </div>
            </div>
            {currentPassword && newPassword && (
              <div className={`flex items-center gap-1.5 pt-1 text-[11px] border-t border-slate-200/60 ${rules.isDifferent ? 'text-emerald-700 font-medium' : 'text-rose-600'}`}>
                <CheckCircle2 className={`h-3.5 w-3.5 ${rules.isDifferent ? 'text-emerald-600' : 'text-rose-400'}`} />
                <span>Khác mật khẩu hiện tại</span>
              </div>
            )}
          </div>

          {/* 3. Xác nhận mật khẩu mới */}
          <div>
            <label htmlFor={confirmPasswordId} className="block text-xs font-semibold text-slate-700 mb-1">
              Xác nhận mật khẩu mới <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                id={confirmPasswordId}
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu mới"
                disabled={loading}
                required
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 pr-10 transition"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((p) => !p)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirmPassword && (
              <p className={`mt-1 text-xs flex items-center gap-1 ${rules.isMatch ? 'text-emerald-600' : 'text-rose-600'}`}>
                {rules.isMatch ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Mật khẩu xác nhận trùng khớp
                  </>
                ) : (
                  'Mật khẩu xác nhận chưa trùng khớp'
                )}
              </p>
            )}
          </div>

          {/* Footer Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
            {!isMandatoryFirstTime && (
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Hủy bỏ
              </button>
            )}
            <button
              type="submit"
              disabled={loading || !rules.allValid}
              className={`flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-xl text-white shadow-xs transition ${
                loading || !rules.allValid
                  ? 'bg-slate-300 cursor-not-allowed text-slate-500'
                  : 'bg-teal-600 hover:bg-teal-700 cursor-pointer'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Đang xử lý mã hóa...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  <span>Xác Nhận Đổi Mật Khẩu</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
