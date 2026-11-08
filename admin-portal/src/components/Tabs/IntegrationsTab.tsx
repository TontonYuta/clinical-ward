import React, { useEffect, useState, useCallback } from 'react';
import { Zap, Clock, ShieldCheck } from 'lucide-react';
import { EsmsStatusResponse, GasStatusResponse } from '../../types/admin';
import { fetchEsmsStatus, fetchGasStatus } from '../../services/adminApi';
import { IntegrationsHeroCards } from './IntegrationsHeroCards';
import { EsmsGatewayCard } from './EsmsGatewayCard';
import { GasGatewayCard } from './GasGatewayCard';

interface IntegrationsTabProps {
  onRefreshData?: () => void;
}

export const IntegrationsTab: React.FC<IntegrationsTabProps> = () => {
  const [esms, setEsms] = useState<EsmsStatusResponse | null>(null);
  const [gas, setGas] = useState<GasStatusResponse | null>(null);
  const [, setIsLoading] = useState(false);

  const loadIntegrationsData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [eData, gData] = await Promise.all([
        fetchEsmsStatus().catch(() => null),
        fetchGasStatus().catch(() => null),
      ]);
      if (eData) setEsms(eData);
      if (gData) setGas(gData);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIntegrationsData();
  }, [loadIntegrationsData]);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
      {/* Banner Tự Động Gửi Real-Time */}
      <div className="bg-gradient-to-r from-teal-950 via-slate-900 to-slate-900 rounded-2xl p-4 sm:p-5 text-white shadow-xs border border-teal-800/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="p-1.5 rounded-lg bg-teal-500/20 text-teal-300 border border-teal-500/30">
              <Zap className="w-4 h-4 text-teal-400" />
            </span>
            <span className="font-bold text-sm sm:text-base tracking-tight text-white">
              Tự Động Gửi SMS &amp; Email Theo Thời Gian Thực (Active Real-Time Auto Dispatch)
            </span>
            <span className="px-2 py-0.5 rounded-full text-3xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              ĐANG HOẠT ĐỘNG
            </span>
          </div>
          <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
            Khi Bác sĩ ký số đơn thuốc điện tử (TT 26/2025/TT-BYT) hoặc hoàn tất dặn dò, hệ thống tự động phát SMS Brandname (eSMS) và gửi Email chi tiết lịch uống thuốc (Google Apps Script Webhook) ngay lập tức qua tiến trình nền.
          </p>
        </div>
        <div className="flex items-center gap-2 text-2xs font-mono font-medium shrink-0">
          <div className="px-3 py-1.5 bg-slate-800/90 rounded-xl border border-slate-700/80 text-teal-300 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-teal-400" />
            <span>Độ trễ: &lt; 20ms</span>
          </div>
          <div className="px-3 py-1.5 bg-slate-800/90 rounded-xl border border-slate-700/80 text-emerald-300 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>NĐ 130/2018/NĐ-CP</span>
          </div>
        </div>
      </div>

      {/* 4 Thẻ chỉ số tổng quan */}
      <IntegrationsHeroCards esms={esms} gas={gas} />

      {/* Cổng eSMS Brandname Viễn Thông */}
      <EsmsGatewayCard esms={esms} onRefresh={loadIntegrationsData} />

      {/* Cổng Google Apps Script Webhook */}
      <GasGatewayCard gas={gas} onRefresh={loadIntegrationsData} />
    </div>
  );
};
