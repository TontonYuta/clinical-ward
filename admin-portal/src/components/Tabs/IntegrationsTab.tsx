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
    <div className="space-y-5">
      {/* Header Toolbar */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-base font-semibold tracking-tight text-slate-900">
              Cổng tích hợp viễn thông SMS &amp; Email dặn dò
            </h2>
            <span className="inline-flex items-center gap-1.5 text-2xs text-emerald-700 bg-emerald-50 border border-emerald-200/70 px-2 py-0.5 rounded-full font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Đang hoạt động
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Tự động gửi SMS Brandname (eSMS) và Email dặn dò (Google Apps Script) khi bác sĩ ký số đơn thuốc điện tử.
          </p>
        </div>

        <div className="text-xs font-mono text-slate-500 shrink-0 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-xl">
          Độ trễ &lt; 20ms · NĐ 130/2018
        </div>
      </div>

      {/* 2 Gateways Side-by-Side on Wide Screens, Stacked on Medium/Mobile */}
      <div className="grid grid-cols-1 2xl:grid-cols-2 gap-5 items-start">
        <EsmsGatewayCard esms={esms} onRefresh={loadIntegrationsData} />
        <GasGatewayCard gas={gas} onRefresh={loadIntegrationsData} />
      </div>
    </div>
  );
};
