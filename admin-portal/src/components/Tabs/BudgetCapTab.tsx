import React, { useState } from 'react';
import { Check, Globe, Cpu, ShieldAlert, Sparkles } from 'lucide-react';
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
    daily_search_query_limit: 200,
    monthly_search_query_limit: 5000,
    auto_offline_fallback: true,
    alert_on_threshold_pct: 80,
  };

  const [dailyLimit, setDailyLimit] = useState(currentCfg.daily_token_limit);
  const [monthlyLimit, setMonthlyLimit] = useState(currentCfg.monthly_token_limit);
  const [dailySearchLimit, setDailySearchLimit] = useState(currentCfg.daily_search_query_limit || 200);
  const [monthlySearchLimit, setMonthlySearchLimit] = useState(currentCfg.monthly_search_query_limit || 5000);
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
        daily_search_query_limit: Number(dailySearchLimit),
        monthly_search_query_limit: Number(monthlySearchLimit),
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
    today_search_queries_used: 0,
    month_search_queries_used: 0,
    daily_search_query_limit: 200,
    today_search_usage_pct: 0.0,
    search_budget_gate_open: true,
    search_throttling_status: 'normal',
    estimated_cost_vnd: 0,
    saved_cost_vnd: 0,
    throttling_status: 'normal',
  };

  const isSearchGateOpen = b.search_budget_gate_open !== false;
  const searchUsagePct = b.today_search_usage_pct || 0.0;

  return (
    <div className="bg-white border border-slate-200/90 rounded-lg overflow-hidden divide-y divide-slate-100">
      {/* 1. Ngân Sách LLM Tokens */}
      <div className="p-3 sm:px-4 sm:py-3.5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-teal-700 shrink-0" />
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                Định Mức Ngân Sách Token LLM (Google Gemini)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Kiểm soát chi phí tự động — Chống hiện tượng trừ tiền bất ngờ (Bill Shock)
              </p>
            </div>
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

        {/* Thanh Progress LLM Tokens */}
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

        {/* 2 Chỉ Số Tài Chính Tinh Gọn */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
          <div>
            <span className="text-2xs font-semibold text-slate-500 uppercase tracking-wider block">Chi phí LLM ước tính hôm nay</span>
            <span className="text-base sm:text-lg font-bold font-mono text-slate-900">
              {b.estimated_cost_vnd.toLocaleString('vi-VN')} <span className="text-xs font-normal text-slate-400">₫</span>
            </span>
          </div>
          <div>
            <span className="text-2xs font-semibold text-slate-500 uppercase tracking-wider block">Tiết kiệm đã xác nhận (Cache &amp; Dược thư)</span>
            <span className="text-base sm:text-lg font-bold font-mono text-emerald-700">
              +{b.saved_cost_vnd.toLocaleString('vi-VN')} <span className="text-xs font-normal text-emerald-600">₫</span>
            </span>
          </div>
        </div>
      </div>

      {/* 2. Ngân Sách Tìm Kiếm Web Fallback (Google Serper API) */}
      <div className="p-3 sm:px-4 sm:py-3.5 space-y-3 bg-slate-50/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-indigo-700 shrink-0" />
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                Ngân Sách Tìm Kiếm Web Fallback (Google Serper API)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Cổng kiểm soát lượt truy vấn ngoài khi Dược thư nội viện không có thuốc
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto text-xs font-mono">
            {isSearchGateOpen ? (
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Cổng mở (Active Gate)
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                <ShieldAlert className="w-3 h-3 text-rose-600" /> Cổng đóng (Circuit Tripped)
              </span>
            )}
            <span className="text-slate-400">
              · {searchUsagePct}% Hạn Mức
            </span>
          </div>
        </div>

        {/* Thanh Progress Serper Queries */}
        <div className="space-y-1">
          <div className="w-full h-1.5 rounded-full bg-slate-200/80 overflow-hidden">
            <div
              style={{ width: `${Math.min(100, searchUsagePct)}%` }}
              className={`h-full rounded-full transition-all duration-500 ${
                searchUsagePct >= 90 ? 'bg-rose-500' : searchUsagePct >= 70 ? 'bg-amber-500' : 'bg-indigo-600'
              }`}
            />
          </div>
          <div className="flex justify-between text-2xs text-slate-500 font-mono">
            <span>
              Lượt search hôm nay: <strong className="text-indigo-900">{(b.today_search_queries_used || 0).toLocaleString('vi-VN')}</strong> queries
            </span>
            <span>
              Hạn mức ngày: <strong className="text-slate-800">{(b.daily_search_query_limit || dailySearchLimit).toLocaleString('vi-VN')}</strong> queries
            </span>
          </div>
        </div>

        {/* 2 Chỉ Số Phụ Tìm Kiếm */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 text-xs">
          <div className="flex items-center justify-between p-2 rounded-md bg-white border border-slate-200/80">
            <span className="text-slate-600 font-medium">Tổng lượt tìm kiếm trong tháng:</span>
            <span className="font-mono font-bold text-slate-900">
              {(b.month_search_queries_used || 0).toLocaleString('vi-VN')} / {monthlySearchLimit.toLocaleString('vi-VN')} queries
            </span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-md bg-white border border-slate-200/80">
            <span className="text-slate-600 font-medium">Chi phí Serper ước tính:</span>
            <span className="font-mono font-bold text-indigo-700">
              {((b.today_search_queries_used || 0) * 25).toLocaleString('vi-VN')} ₫ <span className="text-3xs text-slate-400 font-normal">(~0.001$/query)</span>
            </span>
          </div>
        </div>
      </div>

      {/* 3. Form Cài Đặt Hạn Mức Phẳng */}
      <form onSubmit={handleSave} className="p-3 sm:px-4 sm:py-3.5 space-y-3.5">
        <div>
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">
            Thiết Lập Ngưỡng Hạn Mức Đa Dịch Vụ
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Cấu hình ngưỡng ngắt mạch độc lập cho cả LLM Gemini và Cổng tìm kiếm Serper API
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Cấu hình LLM */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Trần Token LLM Mỗi Ngày (Tokens/Day)
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
              Trần Token LLM Mỗi Tháng (Tokens/Month)
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

          {/* Cấu hình Serper Web Search */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1 flex items-center gap-1">
              <Globe className="w-3.5 h-3.5 text-indigo-600" />
              <span>Trần Tìm Kiếm Serper Mỗi Ngày (Queries/Day)</span>
            </label>
            <input
              type="number"
              step="10"
              value={dailySearchLimit}
              onChange={(e) => setDailySearchLimit(Number(e.target.value))}
              className="w-full h-8 px-2.5 rounded-md border border-slate-300 font-mono text-xs text-slate-800 focus:border-indigo-600 focus:outline-none"
              required
            />
            <span className="text-3xs text-slate-400 mt-0.5 block">Khuyến nghị: 200 lượt tìm kiếm/ngày</span>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1 flex items-center gap-1">
              <Globe className="w-3.5 h-3.5 text-indigo-600" />
              <span>Trần Tìm Kiếm Serper Mỗi Tháng (Queries/Month)</span>
            </label>
            <input
              type="number"
              step="100"
              value={monthlySearchLimit}
              onChange={(e) => setMonthlySearchLimit(Number(e.target.value))}
              className="w-full h-8 px-2.5 rounded-md border border-slate-300 font-mono text-xs text-slate-800 focus:border-indigo-600 focus:outline-none"
              required
            />
            <span className="text-3xs text-slate-400 mt-0.5 block">Khuyến nghị: 5.000 lượt tìm kiếm/tháng</span>
          </div>
        </div>

        {/* Tùy chọn Phòng vệ tự động */}
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
                Tự động ngắt Cổng Tìm Kiếm &amp; Trượt về Chế độ Local Dược thư khi chạm 100% hạn mức (0 VNĐ)
              </span>
              <span className="text-2xs text-slate-500 mt-0.5 block">
                Khi chạm trần token hoặc trần tìm kiếm, hệ thống ngắt mạch gọi ngoài để chống phát sinh chi phí, chuyển sang phục vụ qua cơ sở dữ liệu Dược thư Quốc gia V nội viện SQLite hoàn toàn miễn phí.
              </span>
            </div>
          </label>
        </div>

        <div className="flex items-center justify-between pt-1">
          {savedSuccess ? (
            <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" /> Đã lưu cấu hình ngân sách thành công!
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
