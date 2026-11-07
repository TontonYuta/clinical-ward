import React, { useEffect, useState, useCallback } from 'react';
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
  const [isLoading, setIsLoading] = useState(false);

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
      {/* 4 Thẻ chỉ số tổng quan */}
      <IntegrationsHeroCards esms={esms} gas={gas} />

      {/* Cổng eSMS Brandname Viễn Thông */}
      <EsmsGatewayCard esms={esms} onRefresh={loadIntegrationsData} />

      {/* Cổng Google Apps Script Webhook */}
      <GasGatewayCard gas={gas} onRefresh={loadIntegrationsData} />
    </div>
  );
};
