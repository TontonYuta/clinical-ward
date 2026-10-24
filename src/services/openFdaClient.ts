/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * OpenFDA Clinical Label Client & MCP Tool Wrapper (<=200 LOC)
 * Căn cứ: openfda.substance_name REST API (US FDA SPL Regulatory Data)
 */

export interface OpenFdaDrugLabel {
  substanceName: string;
  brandNames: string[];
  activeIngredients: string[];
  inactiveIngredients: string[];
  indications: string[];
  dosageAndAdministration: string[];
  boxedWarnings: string[];
  contraindications: string[];
  drugInteractions: string[];
  lastUpdated?: string;
  sourceUrl: string;
}

const OPENFDA_ENDPOINT = 'https://api.fda.gov/drug/label.json';

function sanitizeSplText(list?: string[]): string[] {
  if (!list || !Array.isArray(list)) return [];
  return list
    .map((item) => item.replace(/\s+/g, ' ').replace(/\u00a0/g, ' ').trim())
    .filter((item) => item.length > 0);
}

export async function searchOpenFdaDrug(substanceName: string, timeoutMs: number = 4000): Promise<OpenFdaDrugLabel | null> {
  const query = encodeURIComponent(`openfda.substance_name:"${substanceName.trim().toLowerCase()}"`);
  const url = `${OPENFDA_ENDPOINT}?search=${query}&limit=1`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'ClinicalWard-OpenFdaClient/1.0',
      },
    });

    clearTimeout(timer);

    if (!res.ok) {
      return null;
    }

    const data: any = await res.json();
    const result = data?.results?.[0];
    if (!result) return null;

    const openfdaMeta = result.openfda || {};

    return {
      substanceName: substanceName.toUpperCase(),
      brandNames: sanitizeSplText(openfdaMeta.brand_name),
      activeIngredients: sanitizeSplText(result.active_ingredient || openfdaMeta.substance_name),
      inactiveIngredients: sanitizeSplText(result.inactive_ingredient || result.spl_product_data_elements),
      indications: sanitizeSplText(result.indications_and_usage),
      dosageAndAdministration: sanitizeSplText(result.dosage_and_administration),
      boxedWarnings: sanitizeSplText(result.boxed_warning),
      contraindications: sanitizeSplText(result.contraindications),
      drugInteractions: sanitizeSplText(result.drug_interactions),
      lastUpdated: data?.meta?.last_updated,
      sourceUrl: url,
    };
  } catch {
    clearTimeout(timer);
    return null;
  }
}

export function formatLabelSummary(label: OpenFdaDrugLabel): string {
  const activeStr = label.activeIngredients.join(', ') || label.substanceName;
  const excipientStr = label.inactiveIngredients.slice(0, 5).join('; ') || 'Xem hồ sơ chi tiết';
  const boxedStr = label.boxedWarnings.length > 0 ? `⛔ **Cảnh báo hộp đen:** ${label.boxedWarnings[0].slice(0, 160)}...` : '';

  return `### Thông Tin Dược Học OpenFDA: **${label.substanceName}**
• **Hoạt chất chính:** ${activeStr}
• **Tá dược công bố:** ${excipientStr}
• **Chỉ định FDA:** ${label.indications[0]?.slice(0, 180) || 'Theo chỉ định bác sĩ'}
${boxedStr}
🔗 *Nguồn cấp phép:* FDA SPL Database (${label.lastUpdated || '2024'})`;
}
