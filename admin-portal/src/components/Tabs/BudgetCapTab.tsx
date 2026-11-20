import React, { useState } from 'react';
import { Check } from 'lucide-react';
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
    <div className="bg-white border border-slate-200/90 rounded-lg overflow-hidden divide-y divide-slate-100">
      {/* 1. Thanh Tiến Độ Ngân Sách Liền Mạch */}
      <div className="p-3 sm:px-4 sm:py-3.5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
              Định Mức Ngân Sách Token Hôm Nay
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Kiểm soát chi phí tự động — Chống hiện tượng trừ tiền bất ngờ (Bill Shock)
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto text-xs font-mono">
            {b.throttling_status === 'offline_fallback' && (
              <span className="font-bold text-rose-700 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Offline Safe Mode
              </span>
            )}
            {b.throttling_status === 'adaptive_throttling' && (
              <span className="font-bold text-amber-700 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Auto Throttling
              </span>
            )}
            {(!b.throttling_status || b.throttling_status === 'normal') && (
              <span className="text-slate-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Full Performance
              </span>
            )}
            <span className="text-slate-400">
              · {b.today_usage_pct}% Hạn Mức
            </span>
          </div>
        </div>

        {/* Thanh Progress Dẹt */}
        <div className="space-y-1">
          <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              style={{ width: `${Math.min(100, b.today_usage_pct)}%` }}
              className={`h-full rounded-full transition-all duration-500 ${
                b.today_usage_pct >= 90 ? 'bg-rose-500' : b.today_usage_pct >= 70 ? 'bg-amber-500' : 'bg-teal-600'
              }`}
            />
          </div>
          <div className="flex justify-between text-2xs text-slate-500 font-mono">
            <span>Đã dùng: <strong className="text-slate-800">{b.today_tokens_used.toLocaleString('vi-VN')}</strong> tokens</span>
            <span>Trần ngày: <strong className="text-slate-800">{dailyLimit.toLocaleString('vi-VN')}</strong> tokens</span>
          </div>
        </div>

        {/* 2 Chỉ Số Tài Chính Tinh Gọn (Không thẻ bao bọc) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
          <div>
            <span className="text-2xs font-semibold text-slate-500 uppercase tracking-wider block">Chi phí API ước tính hôm nay</span>
            <span className="text-base sm:text-lg font-bold font-mono text-slate-900">
              {b.estimated_cost_vnd.toLocaleString('vi-VN')} <span className="text-xs font-normal text-slate-400">₫</span>
            </span>
          </div>
          <div>
            <span className="text-2xs font-semibold text-slate-500 uppercase tracking-wider block">Tiết kiệm đã xác nhận</span>
            <span className="text-base sm:text-lg font-bold font-mono text-emerald-700">
              +{b.saved_cost_vnd.toLocaleString('vi-VN')} <span className="text-xs font-normal text-emerald-600">₫</span>
            </span>
          </div>
        </div>
      </div>

      {/* 2. Form Cài Đặt Hạn Mức Phẳng */}
      <form onSubmit={handleSave} className="p-3 sm:px-4 sm:py-3.5 space-y-3.5">
        <div>
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">
            Thiết Lập Ngưỡng Hạn Mức &amp; Phòng Vệ
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Cấu hình ngưỡng ngắt mạch và tự động kích hoạt bảo vệ khi quá tải
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Trần Token Tối Đa Mỗi Ngày (Tokens/Day)
            </label>
            <input
              type="number"
              step="50000"
              value={dailyLimit}
              onChange={(e) => setDailyLimit(Number(e.target.value))}
              className="w-full h-8 px-2.5 rounded-md border border-slate-300 font-mono text-xs text-slate-800 focus:border-teal-600 focus:outline-none"
              required
            />
            <span className="text-3xs text-slate-400 mt-0.5 block">Khuyến nghị: 500.000 tokens cho ca trực 24h</span>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Trần Token Tối Đa Mỗi Tháng (Tokens/Month)
            </label>
            <input
              type="number"
              step="500000"
              value={monthlyLimit}
              onChange={(e) => setMonthlyLimit(Number(e.target.value))}
              className="w-full h-8 px-2.5 rounded-md border border-slate-300 font-mono text-xs text-slate-800 focus:border-teal-600 focus:outline-none"
              required
            />
            <span className="text-3xs text-slate-400 mt-0.5 block">Khuyến nghị: 10.000.000 tokens/tháng</span>
          </div>
        </div>

        {/* Tùy chọn Phòng vệ tự động (Không thẻ bao bọc) */}
        <div className="pt-1">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoFallback}
              onChange={(e) => setAutoFallback(e.target.checked)}
              className="rounded text-teal-700 focus:ring-teal-600 h-3.5 w-3.5 mt-0.5 cursor-pointer"
            />
            <div className="text-xs">
              <span className="font-semibold text-slate-900 block">
                Tự động trượt về Chế độ Local Dược thư 100% khi chạm 100% hạn mức (0 VNĐ)
              </span>
              <span className="text-2xs text-slate-500 mt-0.5 block">
                Khi chạm trần, hệ thống không báo lỗi đứt quãng mà sẽ dùng cơ sở dữ liệu Dược thư Quốc gia V nội viện SQLite để phục vụ bác sĩ miễn phí.
              </span>
            </div>
          </label>
        </div>

        <div className="flex items-center justify-between pt-1">
          {savedSuccess ? (
            <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" /> Đã lưu cấu hình thành công!
            </span>
          ) : <span />}

          <button
            type="submit"
            disabled={isSaving}
            className="px-3.5 py-1.5 rounded-md bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold transition cursor-pointer disabled:opacity-50"
          >
            {isSaving ? 'Đang lưu...' : 'Lưu Cấu Hình Ngân Sách'}
          </button>
        </div>
      </form>
    </div>
  );
};
