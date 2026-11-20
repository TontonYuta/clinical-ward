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
    <div className="space-y-4">
      {/* Header Toolbar Phẳng */}
      <div className="bg-white border border-slate-200/90 rounded-lg p-3 sm:px-4 sm:py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm sm:text-base font-bold tracking-tight text-slate-900">
              Cổng Tích Hợp Viễn Thông SMS &amp; Email Dặn Dò
            </h1>
            <span className="px-2 py-0.5 rounded-full text-3xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Đang hoạt động
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Tự động gửi SMS Brandname (eSMS) và Email dặn dò (Google Apps Script) khi bác sĩ ký số đơn thuốc điện tử.
          </p>
        </div>

        <div className="flex items-center gap-2 text-2xs font-mono font-medium shrink-0">
          <span className="px-2 py-1 bg-slate-100 rounded border border-slate-200 text-slate-600">
            Độ trễ: &lt; 20ms
          </span>
          <span className="px-2 py-1 bg-teal-50 rounded border border-teal-200 text-teal-800">
            NĐ 130/2018/NĐ-CP
          </span>
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
