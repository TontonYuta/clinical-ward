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
    <div className="space-y-5">
      {/* Row 1: 2 Side-by-Side Full-Width Cards (LLM Token Budget & Serper Web Search Budget) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Card 1: Ngân Sách LLM Tokens */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs p-5 sm:p-6 flex flex-col justify-between space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                <Cpu className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-slate-900 tracking-tight">
                  Định mức ngân sách Token LLM
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Kiểm soát chi phí tự động (Google Gemini) — chống vượt trần
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start text-xs font-mono shrink-0">
              {b.throttling_status === 'offline_fallback' && (
                <span className="px-2.5 py-1 rounded-full text-2xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Offline Safe Mode
                </span>
              )}
              {b.throttling_status === 'adaptive_throttling' && (
                <span className="px-2.5 py-1 rounded-full text-2xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Auto Throttling
                </span>
              )}
              {(!b.throttling_status || b.throttling_status === 'normal') && (
                <span className="px-2.5 py-1 rounded-full text-2xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Full Performance
                </span>
              )}
            </div>
          </div>

          {/* Progress LLM Tokens */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Mức tiêu thụ hôm nay</span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">{b.today_usage_pct}% hạn mức</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                style={{ width: `${Math.min(100, b.today_usage_pct)}%` }}
                className={`h-full rounded-full transition-all duration-500 ${
                  b.today_usage_pct >= 90 ? 'bg-rose-500' : b.today_usage_pct >= 70 ? 'bg-amber-500' : 'bg-teal-600'
                }`}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-500 font-mono">
              <span>Đã dùng: <strong className="text-slate-800 tabular-nums">{b.today_tokens_used.toLocaleString('vi-VN')}</strong></span>
              <span>Trần ngày: <strong className="text-slate-800 tabular-nums">{dailyLimit.toLocaleString('vi-VN')}</strong> tokens</span>
            </div>
          </div>

          {/* 2 Chỉ Số Tài Chính */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-slate-100">
            <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/70">
              <span className="text-2xs font-semibold text-slate-500 uppercase tracking-wider block">Chi phí ước tính hôm nay</span>
              <span className="text-xl font-bold font-mono text-slate-900 tabular-nums mt-1 block">
                {b.estimated_cost_vnd.toLocaleString('vi-VN')} <span className="text-xs font-normal text-slate-500 font-sans">₫</span>
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-200/60">
              <span className="text-2xs font-semibold text-emerald-800 uppercase tracking-wider block">Tiết kiệm (Cache &amp; Dược thư)</span>
              <span className="text-xl font-bold font-mono text-emerald-700 tabular-nums mt-1 block">
                +{b.saved_cost_vnd.toLocaleString('vi-VN')} <span className="text-xs font-normal text-emerald-600 font-sans">₫</span>
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Ngân Sách Tìm Kiếm Web Fallback (Google Serper API) */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs p-5 sm:p-6 flex flex-col justify-between space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="w-9 h-9 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center shrink-0">
                <Globe className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-slate-900 tracking-tight">
                  Ngân sách Tìm kiếm Web (Serper API)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Kiểm soát lượt tra cứu ngoài khi Dược thư nội viện chưa có dữ liệu
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start text-xs font-mono shrink-0">
              {isSearchGateOpen ? (
                <span className="px-2.5 py-1 rounded-full text-2xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Cổng mở
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full text-2xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-600" /> Cổng đóng
                </span>
              )}
            </div>
          </div>

          {/* Progress Serper Queries */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Lượt tìm kiếm hôm nay</span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">{searchUsagePct}% hạn mức</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                style={{ width: `${Math.min(100, searchUsagePct)}%` }}
                className={`h-full rounded-full transition-all duration-500 ${
                  searchUsagePct >= 90 ? 'bg-rose-500' : searchUsagePct >= 70 ? 'bg-amber-500' : 'bg-sky-600'
                }`}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-500 font-mono">
              <span>Đã dùng: <strong className="text-slate-800 tabular-nums">{(b.today_search_queries_used || 0).toLocaleString('vi-VN')}</strong></span>
              <span>Hạn mức ngày: <strong className="text-slate-800 tabular-nums">{(b.daily_search_query_limit || dailySearchLimit).toLocaleString('vi-VN')}</strong> queries</span>
            </div>
          </div>

          {/* 2 Chỉ Số Phụ Tìm Kiếm */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-slate-100">
            <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/70">
              <span className="text-2xs font-semibold text-slate-500 uppercase tracking-wider block">Tổng lượt trong tháng</span>
              <span className="text-xl font-bold font-mono text-slate-900 tabular-nums mt-1 block">
                {(b.month_search_queries_used || 0).toLocaleString('vi-VN')}{' '}
                <span className="text-xs font-normal text-slate-500">/ {monthlySearchLimit.toLocaleString('vi-VN')}</span>
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-sky-50/50 border border-sky-200/60">
              <span className="text-2xs font-semibold text-sky-800 uppercase tracking-wider block">Chi phí Serper ước tính</span>
              <span className="text-xl font-bold font-mono text-sky-800 tabular-nums mt-1 block">
                {((b.today_search_queries_used || 0) * 25).toLocaleString('vi-VN')} <span className="text-xs font-normal text-sky-600 font-sans">₫</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Full-Width Form Cài Đặt Hạn Mức (4-Column Input Grid) */}
      <form onSubmit={handleSave} className="bg-white border border-slate-200 rounded-2xl shadow-2xs p-5 sm:p-6 space-y-5">
        <div>
          <h3 className="text-base font-semibold text-slate-900 tracking-tight">
            Thiết lập ngưỡng hạn mức đa dịch vụ
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Cấu hình ngưỡng ngắt mạch độc lập cho cả LLM Gemini và Cổng tìm kiếm Serper API
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Cấu hình LLM */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">
              Trần Token LLM / ngày
            </label>
            <input
              type="number"
              step="50000"
              value={dailyLimit}
              onChange={(e) => setDailyLimit(Number(e.target.value))}
              className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white font-mono text-xs text-slate-800 focus:border-teal-600 focus:outline-none transition"
              required
            />
            <span className="text-2xs text-slate-400 mt-1 block">Khuyến nghị: 500.000 tokens/24h</span>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">
              Trần Token LLM / tháng
            </label>
            <input
              type="number"
              step="500000"
              value={monthlyLimit}
              onChange={(e) => setMonthlyLimit(Number(e.target.value))}
              className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white font-mono text-xs text-slate-800 focus:border-teal-600 focus:outline-none transition"
              required
            />
            <span className="text-2xs text-slate-400 mt-1 block">Khuyến nghị: 10.000.000 tokens/tháng</span>
          </div>

          {/* Cấu hình Serper Web Search */}
          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-sky-600" />
              <span>Trần tìm kiếm Web / ngày</span>
            </label>
            <input
              type="number"
              step="10"
              value={dailySearchLimit}
              onChange={(e) => setDailySearchLimit(Number(e.target.value))}
              className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white font-mono text-xs text-slate-800 focus:border-teal-600 focus:outline-none transition"
              required
            />
            <span className="text-2xs text-slate-400 mt-1 block">Khuyến nghị: 200 lượt/ngày</span>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-sky-600" />
              <span>Trần tìm kiếm Web / tháng</span>
            </label>
            <input
              type="number"
              step="100"
              value={monthlySearchLimit}
              onChange={(e) => setMonthlySearchLimit(Number(e.target.value))}
              className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white font-mono text-xs text-slate-800 focus:border-teal-600 focus:outline-none transition"
              required
            />
            <span className="text-2xs text-slate-400 mt-1 block">Khuyến nghị: 5.000 lượt/tháng</span>
          </div>
        </div>

        {/* Tùy chọn Phòng vệ tự động */}
        <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/70">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={autoFallback}
              onChange={(e) => setAutoFallback(e.target.checked)}
              className="rounded text-teal-700 focus:ring-teal-600 h-4 w-4 mt-0.5 cursor-pointer"
            />
            <div className="text-xs">
              <span className="font-semibold text-slate-900 block">
                Tự động ngắt Cổng tìm kiếm &amp; chuyển về Dược thư nội viện khi chạm 100% hạn mức (0 VNĐ)
              </span>
              <span className="text-xs text-slate-500 mt-0.5 block leading-relaxed">
                Khi chạm trần token hoặc trần tìm kiếm, hệ thống tự động ngắt gọi ngoài để chống phát sinh chi phí và phục vụ hoàn toàn qua Dược thư Quốc gia nội viện.
              </span>
            </div>
          </label>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          {savedSuccess ? (
            <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1.5">
              <Check className="w-4 h-4" /> Đã lưu cấu hình ngân sách thành công!
            </span>
          ) : <span />}

          <button
            type="submit"
            disabled={isSaving}
            className="h-9 px-4 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold transition cursor-pointer disabled:opacity-50 active:scale-[0.98]"
          >
            {isSaving ? 'Đang lưu...' : 'Lưu cấu hình ngân sách'}
          </button>
        </div>
      </form>
    </div>
  );
};
