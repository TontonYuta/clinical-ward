import React, { useState, useEffect, useCallback } from 'react';
import { AdminHeader } from './components/AdminHeader';
import { AdminSidebar } from './components/AdminSidebar';
import { AdminMobileBottomNav } from './components/AdminMobileBottomNav';
import { TelemetryTab } from './components/Tabs/TelemetryTab';
import { StaffManagementTab } from './components/Tabs/Staff/StaffManagementTab';
import { AuditTab } from './components/Tabs/AuditTab';
import { DocumentIngestionTab } from './components/Tabs/DocumentIngestionTab';
import { SettingsIntegrationsTab } from './components/Tabs/SettingsIntegrationsTab';
import { AdminTab, TelemetryOverviewResponse, ApiKeyItem, BudgetCapResponse } from './types/admin';
import { fetchTelemetryOverview, fetchApiKeys, fetchBudgetStatus, fetchEsmsStatus, fetchFeatureFlags } from './services/adminApi';
import type { FeatureFlagResponse } from './types/admin';
import { AdminLoginGate } from './components/AdminLoginGate';

const CACHE_KEY_TELEMETRY = 'clinical_ai_monitor_telemetry_cache_v3';
const CACHE_KEY_BUDGET = 'clinical_ai_monitor_budget_cache_v3';

function getCachedItem<T>(key: string): T | null {
  try {
    // Tự động dọn sạch cache phiên bản cũ để đồng bộ tức thì các trường Serper mới
    localStorage.removeItem('clinical_ai_monitor_telemetry_cache');
    localStorage.removeItem('clinical_ai_monitor_budget_cache');
    localStorage.removeItem('clinical_ai_monitor_telemetry_cache_v2');
    localStorage.removeItem('clinical_ai_monitor_budget_cache_v2');
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
}

function MonitorApp({ authenticatedUsername, authenticatedName, onLogout, authEnabled, canConfigureAuth, onToggleAuth }: { authenticatedUsername?: string; authenticatedName?: string; onLogout?: () => Promise<void>; authEnabled: boolean; canConfigureAuth: boolean; onToggleAuth: () => void }) {
  const [currentTab, setCurrentTab] = useState<AdminTab>('telemetry');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Khởi tạo ngay lập tức từ Local Cache để giao diện xuất hiện trong 0ms (Zero-Delay UX)
  const [telemetry, setTelemetry] = useState<TelemetryOverviewResponse | null>(() => getCachedItem<TelemetryOverviewResponse>(CACHE_KEY_TELEMETRY));
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [budget, setBudget] = useState<BudgetCapResponse | null>(() => getCachedItem<BudgetCapResponse>(CACHE_KEY_BUDGET));
  const [esmsBalance, setEsmsBalance] = useState<number | undefined>(undefined);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [featureFlags, setFeatureFlags] = useState<FeatureFlagResponse | null>(null);

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

  useEffect(() => {
    fetchFeatureFlags().then(setFeatureFlags).catch((err) => console.warn('Feature flags load warn:', err));
  }, []);

  // Chu kỳ tự động làm mới mỗi 30 giây (tạm ngắt khi ẩn tab để tiết kiệm CPU)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadAllData();
      }
    }, 30000);

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        loadAllData();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
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
        authenticatedUsername={authenticatedUsername}
        authenticatedName={authenticatedName}
        onLogout={onLogout}
        authEnabled={authEnabled}
        canConfigureAuth={canConfigureAuth}
        onToggleAuth={onToggleAuth}
        onOpenMobileMenu={() => setIsMobileNavOpen(true)}
      />

      {/* Mobile Off-Canvas Drawer (Slide-Over) */}
      {isMobileNavOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setIsMobileNavOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer content */}
          <div className="relative z-50 animate-in slide-in-from-left duration-250">
            <AdminSidebar
              currentTab={currentTab}
              onTabChange={setCurrentTab}
              activeKeyCount={activeKeyCount}
              todayUsagePct={todayUsagePct}
              esmsBalance={esmsBalance}
              isMobileDrawer
              onCloseMobile={() => setIsMobileNavOpen(false)}
              authenticatedUsername={authenticatedUsername}
              onLogout={onLogout}
            />
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden relative">
        {/* Desktop Sidebar (collapsible, matching main Clinical Ward app) */}
        <AdminSidebar
          currentTab={currentTab}
          onTabChange={setCurrentTab}
          activeKeyCount={activeKeyCount}
          todayUsagePct={todayUsagePct}
          esmsBalance={esmsBalance}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((v) => !v)}
        />

        <main className="flex-1 overflow-y-auto bg-slate-50/70 p-4 sm:p-6 pb-20 lg:pb-10">
          <div className="w-full">
            {(currentTab === 'telemetry' || currentTab === 'budget_cap') && (
              <TelemetryTab
                data={telemetry}
                loading={isRefreshing && !telemetry}
                budget={budget}
                onRefreshBudget={loadAllData}
              />
            )}
            {(currentTab === 'bhyt_audit' || currentTab === 'safety_audit') && (
              <AuditTab data={telemetry} />
            )}
            {currentTab === 'staff_management' && (
              <StaffManagementTab />
            )}
            {currentTab === 'document_ingestion' && (
              <DocumentIngestionTab />
            )}
            {(currentTab === 'settings_integrations' ||
              currentTab === 'key_vault' ||
              currentTab === 'integrations' ||
              currentTab === 'feature_flags') && (
              <SettingsIntegrationsTab
                keys={keys}
                onRefresh={loadAllData}
                featureFlags={featureFlags}
                onFeatureFlagsSaved={setFeatureFlags}
                initialSubTab={
                  currentTab === 'integrations'
                    ? 'telecom'
                    : currentTab === 'feature_flags'
                    ? 'flags'
                    : 'keys'
                }
              />
            )}
          </div>
        </main>
      </div>

      {/* Mobile Sticky Bottom Nav Bar */}
      <AdminMobileBottomNav
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        onOpenMenu={() => setIsMobileNavOpen(true)}
        activeKeyCount={activeKeyCount}
        todayUsagePct={todayUsagePct}
      />
    </div>
  );
}

export default function App() {
  return (
    <AdminLoginGate>
      {context => (
        <MonitorApp
          key={context.username ?? 'anonymous'}
          authenticatedUsername={context.username}
          authenticatedName={context.name}
          onLogout={context.logout}
          authEnabled={context.authEnabled}
          canConfigureAuth={context.canConfigureAuth}
          onToggleAuth={context.onToggleAuth}
        />
      )}
    </AdminLoginGate>
  );
}
