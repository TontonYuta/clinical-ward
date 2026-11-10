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

const CACHE_KEY_TELEMETRY = 'clinical_ai_monitor_telemetry_cache_v2';
const CACHE_KEY_BUDGET = 'clinical_ai_monitor_budget_cache_v2';

function getCachedItem<T>(key: string): T | null {
  try {
    // Tự động dọn sạch cache phiên bản cũ v1 để đồng bộ tức thì trên mọi máy
    localStorage.removeItem('clinical_ai_monitor_telemetry_cache');
    localStorage.removeItem('clinical_ai_monitor_budget_cache');
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [currentTab, setCurrentTab] = useState<AdminTab>('telemetry');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Khởi tạo ngay lập tức từ Local Cache để giao diện xuất hiện trong 0ms (Zero-Delay UX)
  const [telemetry, setTelemetry] = useState<TelemetryOverviewResponse | null>(() => getCachedItem<TelemetryOverviewResponse>(CACHE_KEY_TELEMETRY));
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [budget, setBudget] = useState<BudgetCapResponse | null>(() => getCachedItem<BudgetCapResponse>(CACHE_KEY_BUDGET));
  const [esmsBalance, setEsmsBalance] = useState<number | undefined>(undefined);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const loadAllData = useCallback(async () => {
    setIsRefreshing(true);
    // Tách biệt luồng fetch Telemetry: không bị chặn bởi eSMS hay Key Vault
    const pTelemetry = fetchTelemetryOverview()
      .then((data) => {
        setTelemetry(data);
        try { localStorage.setItem(CACHE_KEY_TELEMETRY, JSON.stringify(data)); } catch {}
      })
      .catch((err) => console.warn('Telemetry poll warn:', err));

    const pKeys = fetchApiKeys()
      .then(setKeys)
      .catch((err) => console.warn('Keys poll warn:', err));

    const pBudget = fetchBudgetStatus()
      .then((b) => {
        setBudget(b);
        try { localStorage.setItem(CACHE_KEY_BUDGET, JSON.stringify(b)); } catch {}
      })
      .catch((err) => console.warn('Budget poll warn:', err));

    const pEsms = fetchEsmsStatus()
      .then((e) => {
        if (typeof e?.balance_vnd === 'number') {
          setEsmsBalance(e.balance_vnd);
        } else {
          setEsmsBalance(undefined);
        }
      })
      .catch(() => setEsmsBalance(undefined));

    try {
      await Promise.allSettled([pTelemetry, pKeys, pBudget, pEsms]);
      setLastUpdated(new Date().toLocaleTimeString('vi-VN'));
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
        lastUpdated={lastUpdated}
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
