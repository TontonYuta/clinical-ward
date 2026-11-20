import React from 'react';
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
    <div className="bg-white border border-slate-200/90 rounded-lg grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
      {/* 1. Số dư eSMS thật */}
      <div className="p-3 sm:px-4 sm:py-3 flex items-center justify-between">
        <div>
          <div className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">Số Dư eSMS</div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tabular-nums">
            {balance.toLocaleString('vi-VN')} <span className="text-xs font-normal text-slate-400 font-sans">₫</span>
          </div>
        </div>
        <span className={`text-2xs font-mono px-2 py-0.5 rounded font-medium ${
          isEsmsOnline ? 'text-emerald-800 bg-emerald-50' : 'text-slate-500 bg-slate-100'
        }`}>
          {isEsmsOnline ? 'Đã kết nối' : 'Chưa kết nối'}
        </span>
      </div>

      {/* 2. Brandname Tin Nhắn */}
      <div className="p-3 sm:px-4 sm:py-3 flex items-center justify-between">
        <div>
          <div className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">Brandname</div>
          <div className="text-base sm:text-lg font-bold font-mono text-slate-900 truncate max-w-[140px]">
            {esms?.brandname || 'BV_LAMSANG'}
          </div>
        </div>
        <span className={`text-2xs font-mono px-2 py-0.5 rounded font-medium ${
          esms?.is_sandbox ? 'text-amber-800 bg-amber-50' : 'text-emerald-800 bg-emerald-50'
        }`}>
          {esms?.is_sandbox ? 'Sandbox' : 'Live'}
        </span>
      </div>

      {/* 3. Tin Nhắn Đã Gửi */}
      <div className="p-3 sm:px-4 sm:py-3 flex items-center justify-between">
        <div>
          <div className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">SMS Đã Gửi</div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tabular-nums">
            {esms?.total_sms ?? 0} <span className="text-xs font-normal text-slate-400 font-sans">lượt</span>
          </div>
        </div>
        <span className="text-2xs font-mono text-slate-500">
          {esms?.delivered_count ?? 0} phát thành công
        </span>
      </div>

      {/* 4. Google Apps Script */}
      <div className="p-3 sm:px-4 sm:py-3 flex items-center justify-between">
        <div>
          <div className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">Email Dặn Dò (GAS)</div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tabular-nums">
            {gas?.total_advices ?? 0} <span className="text-xs font-normal text-slate-400 font-sans">email</span>
          </div>
        </div>
        <span className={`text-2xs font-mono px-2 py-0.5 rounded font-medium ${
          isGasOnline ? 'text-emerald-800 bg-emerald-50' : 'text-amber-800 bg-amber-50'
        }`}>
          {isGasOnline ? 'Sẵn sàng' : 'Chưa webhook'}
        </span>
      </div>
    </div>
  );
};
