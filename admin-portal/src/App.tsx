import React, { useState, useEffect, useCallback } from 'react';
import { AdminHeader } from './components/AdminHeader';
import { AdminSidebar } from './components/AdminSidebar';
import { TelemetryTab } from './components/Tabs/TelemetryTab';
import { KeyVaultTab } from './components/Tabs/KeyVaultTab';
import { IntegrationsTab } from './components/Tabs/IntegrationsTab';
import { BudgetCapTab } from './components/Tabs/BudgetCapTab';
import { AuditTab } from './components/Tabs/AuditTab';
import { AdminTab, TelemetryOverviewResponse, ApiKeyItem, BudgetCapResponse } from './types/admin';
import { fetchTelemetryOverview, fetchApiKeys, fetchBudgetStatus, fetchEsmsStatus } from './services/adminApi';

export default function App() {
  const [currentTab, setCurrentTab] = useState<AdminTab>('telemetry');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [telemetry, setTelemetry] = useState<TelemetryOverviewResponse | null>(null);
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [budget, setBudget] = useState<BudgetCapResponse | null>(null);
  const [esmsBalance, setEsmsBalance] = useState<number | undefined>(undefined);

  const loadAllData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [tData, kData, bData, eData] = await Promise.allSettled([
        fetchTelemetryOverview(),
        fetchApiKeys(),
        fetchBudgetStatus(),
        fetchEsmsStatus(),
      ]);
      if (tData.status === 'fulfilled') setTelemetry(tData.value);
      if (kData.status === 'fulfilled') setKeys(kData.value);
      if (bData.status === 'fulfilled') setBudget(bData.value);
      if (eData.status === 'fulfilled' && eData.value?.balance_vnd !== undefined) {
        setEsmsBalance(eData.value.balance_vnd);
      }
    } catch {
      // Ignored for polling
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Chu kỳ tự động làm mới mỗi 10 giây
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadAllData();
    }, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadAllData]);

  const activeKeyCount = keys.filter((k) => k.is_active).length;
  const todayUsagePct = budget?.today_usage_pct || 0;
  const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const clinicalAppUrl = (import.meta.env.VITE_CLINICAL_APP_URL as string) || (isLocal
    ? `${window.location.protocol}//${window.location.hostname}:3000`
    : 'https://clinical-ward.vercel.app');

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50 text-slate-800">
      <AdminHeader
        autoRefresh={autoRefresh}
        onToggleAutoRefresh={() => setAutoRefresh(!autoRefresh)}
        onManualRefresh={loadAllData}
        isRefreshing={isRefreshing}
        clinicalAppUrl={clinicalAppUrl}
      />

      <div className="flex flex-1 overflow-hidden">
        <AdminSidebar
          currentTab={currentTab}
          onTabChange={setCurrentTab}
          activeKeyCount={activeKeyCount}
          todayUsagePct={todayUsagePct}
          esmsBalance={esmsBalance}
        />

        <main className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6 xl:p-8">
          <div className="w-full max-w-[1920px] mx-auto">
            {currentTab === 'telemetry' && (
              <TelemetryTab data={telemetry} loading={isRefreshing && !telemetry} />
            )}
            {currentTab === 'key_vault' && (
              <KeyVaultTab keys={keys} onRefresh={loadAllData} />
            )}
            {currentTab === 'integrations' && (
              <IntegrationsTab onRefreshData={loadAllData} />
            )}
            {currentTab === 'budget_cap' && (
              <BudgetCapTab budget={budget} onRefresh={loadAllData} />
            )}
            {currentTab === 'safety_audit' && (
              <AuditTab data={telemetry} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
