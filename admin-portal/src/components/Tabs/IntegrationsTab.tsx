import React, { useEffect, useState, useCallback } from 'react';
import { Zap, Clock, ShieldCheck } from 'lucide-react';
import { EsmsStatusResponse, GasStatusResponse } from '../../types/admin';
import { fetchEsmsStatus, fetchGasStatus } from '../../services/adminApi';
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
            <span className="inline-flex items-center gap-1 text-2xs text-slate-500 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Đang hoạt động
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Tự động gửi SMS Brandname (eSMS) và Email dặn dò (Google Apps Script) khi bác sĩ ký số đơn thuốc điện tử.
          </p>
        </div>

        <div className="text-2xs font-mono text-slate-400 shrink-0">
          Độ trễ &lt; 20ms · NĐ 130/2018
        </div>
      </div>

      {/* Cổng eSMS Brandname Viễn Thông */}
      <EsmsGatewayCard esms={esms} onRefresh={loadIntegrationsData} />

      {/* Cổng Google Apps Script Webhook */}
      <GasGatewayCard gas={gas} onRefresh={loadIntegrationsData} />
    </div>
  );
};
