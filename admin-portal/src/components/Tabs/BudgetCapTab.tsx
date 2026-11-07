import React, { useState } from 'react';
import { Coins, ShieldAlert, Check, RefreshCw, AlertCircle } from 'lucide-react';
import { BudgetCapResponse, BudgetCapConfig } from '../../types/admin';
import { updateBudgetConfig } from '../../services/adminApi';

interface BudgetCapTabProps {
  budget: BudgetCapResponse | null;
  onRefresh: () => void;
}

export const BudgetCapTab: React.FC<BudgetCapTabProps> = ({ budget, onRefresh }) => {
  const currentCfg = budget?.config || {
    daily_token_limit: 500000,
    monthly_token_limit: 10000000,
    auto_offline_fallback: true,
    alert_on_threshold_pct: 80,
  };

  const [dailyLimit, setDailyLimit] = useState(currentCfg.daily_token_limit);
  const [monthlyLimit, setMonthlyLimit] = useState(currentCfg.monthly_token_limit);
  const [autoFallback, setAutoFallback] = useState(currentCfg.auto_offline_fallback);
  const [thresholdPct, setThresholdPct] = useState(currentCfg.alert_on_threshold_pct);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSavedSuccess(false);
    try {
      await updateBudgetConfig({
        daily_token_limit: Number(dailyLimit),
        monthly_token_limit: Number(monthlyLimit),
        auto_offline_fallback: autoFallback,
        alert_on_threshold_pct: Number(thresholdPct),
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
      onRefresh();
    } catch (err: any) {
      alert(`Lỗi lưu ngân sách: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const b = budget || {
    today_tokens_used: 0,
    month_tokens_used: 0,
    today_usage_pct: 0.0,
    estimated_cost_vnd: 0,
    saved_cost_vnd: 0,
    throttling_status: 'normal',
  };

  return (
    <div className="space-y-6">
      {/* Thẻ Thống Kê Tiến Độ Ngân Sách */}
      <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg lg:text-xl font-bold text-slate-900 flex items-center gap-2.5">
              <Coins className="w-6 h-6 text-teal-700" />
              Tiến Độ Ngân Sách Token Hôm Nay
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Định mức an toàn tài chính — Chống hiện tượng trừ tiền bất ngờ (Bill Shock)
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {b.throttling_status === 'offline_fallback' && (
              <span className="text-xs font-bold text-rose-700 bg-rose-50 px-3 py-1 rounded-lg border border-rose-200">
                Offline Safe Mode (0 đ)
              </span>
            )}
            {b.throttling_status === 'adaptive_throttling' && (
              <span className="text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-lg border border-amber-200">
                Auto Throttling (Nén Sâu)
              </span>
            )}
            {(!b.throttling_status || b.throttling_status === 'normal') && (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
                Full Performance
              </span>
            )}
            <span className="text-sm font-mono font-bold text-teal-900 bg-teal-50 px-3 py-1 rounded-lg border border-teal-200">
              {b.today_usage_pct}% Hạn Mức
            </span>
          </div>
        </div>

        {/* Thanh Progress */}
        <div className="space-y-2">
          <div className="w-full h-4 rounded-full bg-slate-100 overflow-hidden p-0.5 border border-slate-200/60">
            <div
              style={{ width: `${Math.min(100, b.today_usage_pct)}%` }}
              className={`h-full rounded-full transition-all duration-500 ${
                b.today_usage_pct > 80 ? 'bg-rose-500' : 'bg-teal-600'
              }`}
            />
          </div>
          <div className="flex justify-between text-xs sm:text-sm text-slate-600 font-mono font-medium">
            <span>Đã dùng: <strong className="text-slate-900">{b.today_tokens_used.toLocaleString('vi-VN')}</strong> tokens</span>
            <span>Trần ngày: <strong className="text-slate-900">{dailyLimit.toLocaleString('vi-VN')}</strong> tokens</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-slate-500 block mb-1">
              Chi phí API ước tính hôm nay
            </span>
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-slate-900">
              {b.estimated_cost_vnd.toLocaleString('vi-VN')} đ
            </span>
          </div>
          <div className="p-4 bg-emerald-50/80 rounded-xl border border-emerald-200">
            <span className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-emerald-800 block mb-1">
              Số tiền đã tiết kiệm nhờ Cache L1/L2
            </span>
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-700">
              +{b.saved_cost_vnd.toLocaleString('vi-VN')} đ
            </span>
          </div>
        </div>
      </div>

      {/* Form Cài Đặt Hạn Mức */}
      <form onSubmit={handleSave} className="p-6 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-5">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900">
            Thiết Lập Ngưỡng Hạn Mức & Phòng Vệ
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Cấu hình ngưỡng ngắt mạch và tự động kích hoạt bảo vệ khi quá tải
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">
              Trần Token Tối Đa Mỗi Ngày (Tokens/Day)
            </label>
            <input
              type="number"
              step="50000"
              value={dailyLimit}
              onChange={(e) => setDailyLimit(Number(e.target.value))}
              className="w-full text-sm sm:text-base px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono focus:outline-teal-600 focus:ring-1 focus:ring-teal-600"
              required
            />
            <span className="text-xs text-slate-400 mt-1 block">Khuyến nghị: 500.000 tokens cho ca trực 24h</span>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">
              Trần Token Tối Đa Mỗi Tháng (Tokens/Month)
            </label>
            <input
              type="number"
              step="500000"
              value={monthlyLimit}
              onChange={(e) => setMonthlyLimit(Number(e.target.value))}
              className="w-full text-sm sm:text-base px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono focus:outline-teal-600 focus:ring-1 focus:ring-teal-600"
              required
            />
            <span className="text-xs text-slate-400 mt-1 block">Khuyến nghị: 10.000.000 tokens/tháng</span>
          </div>
        </div>

        {/* Tùy chọn Phòng vệ tự động */}
        <div className="p-4 bg-teal-50/70 rounded-xl border border-teal-200/80 space-y-1.5">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={autoFallback}
              onChange={(e) => setAutoFallback(e.target.checked)}
              className="rounded-sm text-teal-800 focus:ring-teal-700 h-4.5 w-4.5 cursor-pointer"
            />
            <span className="text-sm font-bold text-teal-950">
              Tự động trượt về Chế độ Local Dược thư 100% khi chạm 100% hạn mức (0 VNĐ)
            </span>
          </label>
          <p className="text-xs text-slate-600 pl-7.5 leading-relaxed">
            Khi chạm trần, hệ thống không báo lỗi đứt quãng mà sẽ dùng cơ sở dữ liệu Dược thư Quốc gia V nội viện SQLite để phục vụ bác sĩ miễn phí.
          </p>
        </div>

        <div className="flex items-center justify-between pt-1">
          {savedSuccess ? (
            <span className="text-sm text-emerald-700 font-semibold flex items-center gap-1.5">
              <Check className="w-5 h-5" /> Đã lưu cấu hình thành công!
            </span>
          ) : <span />}

          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl bg-teal-800 hover:bg-teal-900 text-white text-sm font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
          >
            {isSaving ? 'Đang lưu...' : 'Lưu Cấu Hình Ngân Sách'}
          </button>
        </div>
      </form>
    </div>
  );
};
