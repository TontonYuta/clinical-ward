import React from 'react';
import { Radio, MessageSquare, Send, CheckCircle2, ShieldCheck, Zap } from 'lucide-react';
import { EsmsStatusResponse, GasStatusResponse } from '../../types/admin';

interface IntegrationsHeroCardsProps {
  esms: EsmsStatusResponse | null;
  gas: GasStatusResponse | null;
}

export const IntegrationsHeroCards: React.FC<IntegrationsHeroCardsProps> = ({ esms, gas }) => {
  const balance = Number(esms?.balance_vnd) || 0;
  const isEsmsOnline = esms?.status === 'connected';
  const isGasOnline = gas?.status === 'ready';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Số dư eSMS thật */}
      <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-2xs space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
          <span>Số Dư Viễn Thông eSMS</span>
          <Radio className="w-4 h-4 text-teal-700" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
            {balance.toLocaleString('vi-VN')}
          </span>
          <span className="text-xs font-semibold text-slate-500">VNĐ</span>
        </div>
        <div className="flex items-center gap-1.5 text-2xs font-semibold text-emerald-800">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>{isEsmsOnline ? 'Tài Khoản Thật Sẵn Sàng' : 'Chưa Kết Nối'}</span>
          {esms?.user_id && <span className="text-slate-400 font-mono font-normal">#{esms.user_id}</span>}
        </div>
      </div>

      {/* 2. Brandname & Chế độ */}
      <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-2xs space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
          <span>Brandname &amp; Tự Động</span>
          <ShieldCheck className="w-4 h-4 text-teal-700" />
        </div>
        <div className="text-xl font-bold font-mono text-teal-900 truncate">
          {esms?.brandname || 'BV_LAMSANG'}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap text-2xs">
          <span className={`px-2 py-0.5 rounded-md font-semibold ${esms?.is_sandbox ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
            {esms?.is_sandbox ? 'Sandbox (0đ)' : 'Live'}
          </span>
          <span className="px-2 py-0.5 rounded-md font-semibold bg-teal-50 text-teal-800 flex items-center gap-0.5">
            <Zap className="w-3 h-3 text-teal-600" /> Auto-SMS
          </span>
        </div>
      </div>

      {/* 3. Tổng lượt SMS cấp cứu / đơn thuốc */}
      <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-2xs space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
          <span>Tin Nhắn Cấp Cứu / Đơn</span>
          <MessageSquare className="w-4 h-4 text-teal-700" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
            {esms?.total_sms ?? 0}
          </span>
          <span className="text-xs text-slate-500 font-normal">lượt gửi</span>
        </div>
        <div className="text-2xs text-slate-500 truncate">
          Đã phát: <strong className="text-emerald-700 font-semibold">{esms?.delivered_count ?? 0}</strong> • Lỗi: <strong className="text-rose-700 font-semibold">{esms?.failed_count ?? 0}</strong>
        </div>
      </div>

      {/* 4. Google Apps Script Webhook */}
      <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-2xs space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
          <span>Google Apps Script</span>
          <Send className="w-4 h-4 text-teal-700" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
            {gas?.total_advices ?? 0}
          </span>
          <span className="text-xs text-slate-500 font-normal">email dặn dò</span>
        </div>
        <div className="flex items-center gap-1.5 text-2xs">
          {isGasOnline ? (
            <span className="text-emerald-800 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Auto-Email Sẵn Sàng
            </span>
          ) : (
            <span className="text-amber-800 font-semibold">Chưa Cấu Hình Webhook</span>
          )}
        </div>
      </div>
    </div>
  );
};
