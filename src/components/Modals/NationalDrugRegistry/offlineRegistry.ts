/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Module nạp và truy vấn danh mục thuốc ngoại tuyến (55k nén Gz hoặc 1.9k thiết yếu)
 */

import { MasterMedication } from '../../../types/medication';
import { resolvePharmacologicalGroup } from '../../../utils/clinical/pharmacologicalClassification';

let cachedRegistry: any[] | null = null;
let cachedGroupStats: Record<string, number> | null = null;

export function getOfflineCachedDrug(code?: string | null): any | null {
  if (!cachedRegistry || !code) return null;
  const norm = code.trim().toLowerCase();
  return cachedRegistry.find((d: any) =>
    [d.national_code, d.nationalCode, d.id, d.registrationNumber].some(
      (val) => typeof val === 'string' && val.trim().toLowerCase() === norm
    )
  ) || null;
}

function computeGroupStats(list: any[]): Record<string, number> {
  const stats: Record<string, number> = {};
  for (const it of list) {
    const g = it.group || 'Thuốc điều trị chuyên khoa';
    stats[g] = (stats[g] || 0) + 1;
  }
  return stats;
}

function normalizeSearch(value: unknown): string {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, ' ').trim();
}

export async function loadOfflineRegistry(): Promise<any[]> {
  if (cachedRegistry && cachedRegistry.length > 0) return cachedRegistry;
  // Fallback an toàn cho client: Ưu tiên nạp danh mục thiết yếu gọn nhẹ (~5MB) thay vì tải file nén 83MB gây cạn kiệt RAM
  try {
    const res = await fetch('/data/vietnam_drug_registry/dav_essential_formulary.json');
    if (res.ok) {
      const local = await res.json();
      if (Array.isArray(local) && local.length > 0) {
        cachedRegistry = local;
        cachedGroupStats = computeGroupStats(cachedRegistry);
        return cachedRegistry;
      }
    }
  } catch {}

  // Dự phòng trường hợp có sẵn file master cục bộ
  try {
    if (typeof DecompressionStream !== 'undefined') {
      const res = await fetch('/data/vietnam_drug_registry/dav_master_registry.json.gz');
      if (res.ok && res.body) {
        const contentEncoding = res.headers.get('content-encoding')?.toLowerCase() || '';
        const text = contentEncoding.includes('gzip')
          ? await res.text()
          : await new Response(res.body.pipeThrough(new DecompressionStream('gzip'))).text();
        const data = JSON.parse(text);
        if (Array.isArray(data) && data.length > 0) {
          cachedRegistry = data;
          cachedGroupStats = computeGroupStats(data);
          return data;
        }
      }
    }
  } catch {}

  cachedRegistry = [];
  cachedGroupStats = {};
  return cachedRegistry;
}

export async function queryOfflineRegistry(
  search: string,
  group: string,
  pharmGroup: string,
  page: number,
  pageSize: number
): Promise<{ items: MasterMedication[]; total: number; registryTotal: number; totalPages: number; groupStats: Record<string, number> }> {
  const fullList = await loadOfflineRegistry();
  const q = normalizeSearch(search);
  const tokens = q.split(' ').filter(Boolean);
  const groupStats = cachedGroupStats || computeGroupStats(fullList);
  const value = (d: any, camel: string, snake: string) => d[camel] ?? d[snake];
  const filtered = fullList.filter((d: any) =>
    (group === 'all' || d.group === group) &&
    (!pharmGroup || pharmGroup === 'all' || resolvePharmacologicalGroup(
      value(d, 'atcCode', 'atc_code'),
      `${value(d, 'brandName', 'brand_name') || ''} ${value(d, 'activeIngredient', 'active_ingredient_raw') || ''}`,
      d.group
    ).key === pharmGroup) &&
    (!q || tokens.every((token) => {
      const haystack = [value(d, 'brandName', 'brand_name'), value(d, 'nationalCode', 'national_code'), value(d, 'activeIngredient', 'active_ingredient_raw'), value(d, 'concentration', 'strength_raw'), value(d, 'dosageForm', 'dosage_form'), d.atcCode, d.atc_code].map(normalizeSearch).join(' ');
      return haystack.includes(token) || haystack.replace(/\s+/g, '').includes(token.replace(/\s+/g, ''));
    }))
  );
  const items: MasterMedication[] = filtered.slice((page - 1) * pageSize, page * pageSize).map((d: any) => ({
    id: d.id, nationalCode: value(d, 'nationalCode', 'national_code'), brandName: value(d, 'brandName', 'brand_name'),
    activeIngredient: value(d, 'activeIngredient', 'active_ingredient_raw'), concentration: d.concentration || d.strength_raw, dosageForm: d.dosageForm || d.dosage_form,
    route: d.route, standardUnit: d.standardUnit || d.standard_unit || 'Viên', group: d.group || 'Thuốc điều trị chuyên khoa',
    isControlled: !!d.isControlled, isHighAlert: !!d.isHighAlert, isCrashCart: !!d.isCrashCart,
    defaultDoseQty: 1, wardStockCount: 0, hospitalStockCount: 0, searchAliases: [String(value(d, 'brandName', 'brand_name') || '').toLowerCase()], note: d.note,
    packagingSpec: d.packagingSpec, standardPharmacopeia: d.standardPharmacopeia, shelfLife: d.shelfLife,
    manufacturer: d.manufacturer, country: d.country, applicantName: d.applicantName, approvalDecision: d.approvalDecision,
    hdsdPath: d.hdsdPath, labelPath: d.labelPath,
    clinicalProfile: d.clinicalProfile,
    atcCode: value(d, 'atcCode', 'atc_code'),
    drugClass: d.drugClass || d.drug_class,
    indications: d.indications,
    contraindications: d.contraindications,
    precautions: d.precautions,
    pregnancyWarning: d.pregnancyWarning || d.pregnancy_warning,
    adultDosage: d.adultDosage || d.adult_dosage,
    pediatricDosage: d.pediatricDosage || d.pediatric_dosage,
    renalAdjustment: d.renalAdjustment || d.renal_adjustment,
    hepaticAdjustment: d.hepaticAdjustment || d.hepatic_adjustment,
    adverseEffects: d.adverseEffects || d.adverse_effects,
    drugInteractions: d.drugInteractions || d.drug_interactions,
    overdoseTreatment: d.overdoseTreatment || d.overdose_treatment,
    antidote: d.antidote,
    clinicalSource: d.clinicalSource || d.clinical_source,
  }));
  return { items, total: filtered.length, registryTotal: fullList.length, totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)), groupStats };
}
