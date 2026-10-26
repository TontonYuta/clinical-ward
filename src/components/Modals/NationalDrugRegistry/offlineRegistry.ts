/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Module nạp và truy vấn danh mục thuốc ngoại tuyến (55k nén Gz hoặc 1.9k thiết yếu)
 */

import { MasterMedication } from '../../../types/medication';

let cachedRegistry: any[] | null = null;
let cachedGroupStats: Record<string, number> | null = null;

function computeGroupStats(list: any[]): Record<string, number> {
  const stats: Record<string, number> = {};
  for (const it of list) {
    const g = it.group || 'Thuốc điều trị chuyên khoa';
    stats[g] = (stats[g] || 0) + 1;
  }
  return stats;
}

export async function loadOfflineRegistry(): Promise<any[]> {
  if (cachedRegistry && cachedRegistry.length > 0) return cachedRegistry;
  try {
    if (typeof DecompressionStream !== 'undefined') {
      const res = await fetch('/data/vietnam_drug_registry/dav_master_registry.json.gz');
      if (res.ok && res.body) {
        const stream = res.body.pipeThrough(new DecompressionStream('gzip'));
        const text = await new Response(stream).text();
        const data = JSON.parse(text);
        if (Array.isArray(data) && data.length > 0) {
          cachedRegistry = data;
          cachedGroupStats = computeGroupStats(data);
          return data;
        }
      }
    }
  } catch {}
  const res = await fetch('/data/vietnam_drug_registry/dav_essential_formulary.json');
  const local = await res.json();
  cachedRegistry = Array.isArray(local) ? local : [];
  cachedGroupStats = computeGroupStats(cachedRegistry);
  return cachedRegistry;
}

export async function queryOfflineRegistry(
  search: string,
  group: string,
  page: number,
  pageSize: number
): Promise<{ items: MasterMedication[]; total: number; totalPages: number; groupStats: Record<string, number> }> {
  const fullList = await loadOfflineRegistry();
  const q = search.toLowerCase().trim();
  const groupStats = cachedGroupStats || computeGroupStats(fullList);
  const filtered = fullList.filter((d: any) =>
    (group === 'all' || d.group === group) &&
    (!q || (d.brandName && d.brandName.toLowerCase().includes(q)) || (d.nationalCode && d.nationalCode.toLowerCase().includes(q)) || (d.activeIngredient && d.activeIngredient.toLowerCase().includes(q)))
  );
  const items: MasterMedication[] = filtered.slice((page - 1) * pageSize, page * pageSize).map((d: any) => ({
    id: d.id, nationalCode: d.nationalCode, brandName: d.brandName,
    activeIngredient: d.activeIngredient, concentration: d.concentration, dosageForm: d.dosageForm,
    route: d.route, standardUnit: d.standardUnit || 'Viên', group: d.group || 'Thuốc điều trị chuyên khoa',
    isControlled: !!d.isControlled, isHighAlert: !!d.isHighAlert, isCrashCart: !!d.isCrashCart,
    defaultDoseQty: 1, wardStockCount: 0, hospitalStockCount: 0, searchAliases: [d.brandName?.toLowerCase() || ''], note: d.note,
    packagingSpec: d.packagingSpec, standardPharmacopeia: d.standardPharmacopeia, shelfLife: d.shelfLife,
    manufacturer: d.manufacturer, country: d.country, applicantName: d.applicantName, approvalDecision: d.approvalDecision,
    clinicalProfile: d.clinicalProfile
  }));
  return { items, total: filtered.length, totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)), groupStats };
}
