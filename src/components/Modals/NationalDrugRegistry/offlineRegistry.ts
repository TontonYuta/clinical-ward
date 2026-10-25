/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Module nạp và truy vấn danh mục thuốc ngoại tuyến (55k nén Gz hoặc 1.9k thiết yếu)
 */

import { MasterMedication } from '../../../types/medication';

let cachedRegistry: any[] | null = null;

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
          return data;
        }
      }
    }
  } catch {}
  const res = await fetch('/data/vietnam_drug_registry/dav_essential_formulary.json');
  const local = await res.json();
  cachedRegistry = Array.isArray(local) ? local : [];
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
  const groupStats: Record<string, number> = {};
  for (const it of fullList) {
    const g = it.group || 'Thuốc điều trị chuyên khoa';
    groupStats[g] = (groupStats[g] || 0) + 1;
  }
  const filtered = fullList.filter((d: any) =>
    (group === 'all' || d.group === group) &&
    (!q || (d.brandName && d.brandName.toLowerCase().includes(q)) || (d.nationalCode && d.nationalCode.toLowerCase().includes(q)) || (d.activeIngredient && d.activeIngredient.toLowerCase().includes(q)))
  );
  const items: MasterMedication[] = filtered.slice((page - 1) * pageSize, page * pageSize).map((d: any) => ({
    id: d.id, nationalCode: d.nationalCode, brandName: d.brandName,
    activeIngredient: d.activeIngredient, concentration: d.concentration, dosageForm: d.dosageForm,
    route: d.route, standardUnit: d.standardUnit || 'Viên', group: d.group || 'Thuốc điều trị chuyên khoa',
    isControlled: !!d.isControlled, isHighAlert: !!d.isHighAlert, isCrashCart: !!d.isCrashCart,
    defaultDoseQty: 1, wardStockCount: 0, hospitalStockCount: 0, searchAliases: [d.brandName?.toLowerCase() || ''], note: d.note
  }));
  return { items, total: filtered.length, totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)), groupStats };
}
