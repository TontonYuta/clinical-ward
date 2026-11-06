import { apiRequest } from './client';
import { INITIAL_COLD_CHAIN_STATE } from '../../data/initialData';
import type { ColdChainMonitorState } from '../../types/clinical';

interface BackendColdChainState {
  id?: number;
  current_temp: number;
  is_outage: boolean;
  is_quarantined: boolean;
  vvm_level: number;
  mkt_temp: number;
  outage_minutes: number;
  total_vaccine_doses: number;
  logs: Array<{ timestamp: string; temperature: number }>;
}

export const coldchainApi = {
  async fetchStatus(): Promise<ColdChainMonitorState> {
    const raw = await apiRequest<BackendColdChainState>('/coldchain/status');
    return {
      ...INITIAL_COLD_CHAIN_STATE,
      storageId: raw.id,
      storageName: raw.id != null ? `Thiết bị bảo quản #${raw.id}` : 'Chưa có định danh thiết bị bảo quản',
      outageMinutes: raw.outage_minutes,
      currentHumidity: Number.NaN,
      currentTemp: raw.current_temp,
      powerStatus: raw.is_outage ? 'outage_critical' : 'main_power',
      compressorStatus: raw.is_outage ? 'fault' : 'running',
      alarmActive: raw.is_outage || !Number.isFinite(raw.current_temp) || raw.current_temp < 2 || raw.current_temp > 8,
      alarmMessage: raw.is_outage ? 'Mô phỏng mất điện chuỗi lạnh' : undefined,
      quarantineStatus: raw.is_quarantined ? 'quarantined' : 'normal',
      quarantineReason: raw.is_quarantined ? `Biệt trữ sau sự cố nhiệt độ (${raw.outage_minutes} phút). Chờ thẩm định.` : undefined,
      totalVaccineDoses: raw.total_vaccine_doses,
      vvmStage: raw.vvm_level,
      mktTemperature: raw.mkt_temp,
      logs: raw.logs.map(log => ({ ...log, humidity: Number.NaN, status: log.temperature < 2 || log.temperature > 8 ? 'critical' : 'normal' })),
    };
  },
  async simulateOutage(): Promise<ColdChainMonitorState> {
    await apiRequest('/coldchain/simulate-outage', { method: 'POST' });
    return coldchainApi.fetchStatus();
  },
  async restorePower(): Promise<ColdChainMonitorState> {
    await apiRequest('/coldchain/restore-power', { method: 'POST' });
    return coldchainApi.fetchStatus();
  },
  async releaseQuarantine(signerName: string, witnessName: string, vvm: number, mkt: number): Promise<ColdChainMonitorState> {
    await apiRequest('/coldchain/release-quarantine', {
      method: 'POST',
      body: JSON.stringify({ signer_name: signerName, pharmacist_name: witnessName, vvm_level_confirmed: vvm, mkt_confirmed: mkt }),
    });
    return coldchainApi.fetchStatus();
  },
};
