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
    <div className="space-y-6">
      {/* Banner Tự Động Gửi Real-Time */}
      <div className="bg-teal-50/80 border border-teal-200/90 rounded-xl p-4 sm:p-5 text-teal-950 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="p-1.5 rounded-lg bg-teal-100/80 text-teal-800">
              <Zap className="w-4 h-4 text-teal-700" />
            </span>
            <span className="font-bold text-sm sm:text-base tracking-tight text-teal-950">
              Tự Động Gửi SMS &amp; Email Theo Thời Gian Thực (Active Real-Time Auto Dispatch)
            </span>
            <span className="px-2 py-0.5 rounded-full text-3xs font-bold uppercase tracking-wider bg-emerald-100/90 text-emerald-800 border border-emerald-300 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
              ĐANG HOẠT ĐỘNG
            </span>
          </div>
          <p className="text-xs text-slate-600 max-w-3xl leading-relaxed">
            Khi Bác sĩ ký số đơn thuốc điện tử (TT 26/2025/TT-BYT) hoặc hoàn tất dặn dò, hệ thống tự động phát SMS Brandname (eSMS) và gửi Email chi tiết lịch uống thuốc (Google Apps Script Webhook) ngay lập tức qua tiến trình nền.
          </p>
        </div>
        <div className="flex items-center gap-2 text-2xs font-mono font-semibold shrink-0">
          <div className="px-2.5 py-1.5 bg-white rounded-lg border border-teal-200 text-teal-800 flex items-center gap-1.5 shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-teal-600" />
            <span>Độ trễ: &lt; 20ms</span>
          </div>
          <div className="px-2.5 py-1.5 bg-white rounded-lg border border-teal-200 text-emerald-800 flex items-center gap-1.5 shadow-2xs">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
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
