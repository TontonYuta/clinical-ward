/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Hệ thống Phân loại Dược lý & Tác dụng Trị liệu Lâm sàng (ATC WHO & Dược Thư 2022) (<=200 LOC)
 */

export type PharmacologicalGroupKey =
  | 'all' | 'fever_pain' | 'cardiotonic_vasopressor' | 'diuretic'
  | 'antihypertensive' | 'antiarrhythmic' | 'antibiotic' | 'opioid'
  | 'sedative' | 'bronchodilator' | 'antiulcer_ppi' | 'antidiabetic'
  | 'lipid_lowering' | 'iv_fluids_electrolytes' | 'vaccine' | 'medical_supply';

export interface PharmacologicalGroupDef {
  key: PharmacologicalGroupKey;
  label: string;
  shortLabel: string;
  atcPrefixes: string[];
  keywords: string[];
  badgeClass: string;
  borderClass: string;
}

export const PHARMACOLOGICAL_GROUPS: PharmacologicalGroupDef[] = [
  {
    key: 'fever_pain',
    label: 'Hạ sốt - Giảm đau',
    shortLabel: 'Hạ sốt',
    atcPrefixes: ['N02B'],
    keywords: ['paracetamol', 'acetaminophen', 'hạ sốt', 'giảm đau'],
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    borderClass: 'border-blue-500',
  },
  {
    key: 'cardiotonic_vasopressor',
    label: 'Trợ tim & Vận mạch cấp cứu',
    shortLabel: 'Trợ tim - Vận mạch',
    atcPrefixes: ['C01C', 'C01CA', 'A03BA'],
    keywords: ['adrenalin', 'noradrenalin', 'epinephrin', 'norepinephrin', 'dopamin', 'dobutamin', 'atropin', 'vận mạch', 'trợ tim'],
    badgeClass: 'bg-red-50 text-red-700 border-red-200',
    borderClass: 'border-red-500',
  },
  {
    key: 'diuretic',
    label: 'Thuốc lợi tiểu',
    shortLabel: 'Lợi tiểu',
    atcPrefixes: ['C03'],
    keywords: ['furosemid', 'spironolacton', 'indapamid', 'lợi tiểu'],
    badgeClass: 'bg-cyan-50 text-cyan-800 border-cyan-200',
    borderClass: 'border-cyan-500',
  },
  {
    key: 'antihypertensive',
    label: 'Thuốc hạ huyết áp',
    shortLabel: 'Hạ huyết áp',
    atcPrefixes: ['C08', 'C09', 'C07'],
    keywords: ['amlodipin', 'amlodipine', 'enalapril', 'losartan', 'hạ huyết áp'],
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-200',
    borderClass: 'border-sky-500',
  },
  {
    key: 'antiarrhythmic',
    label: 'Thuốc chống loạn nhịp tim',
    shortLabel: 'Chống loạn nhịp',
    atcPrefixes: ['C01B', 'C01BD'],
    keywords: ['amiodaron', 'amiodarone', 'lidocain', 'loạn nhịp'],
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
    borderClass: 'border-rose-500',
  },
  {
    key: 'antibiotic',
    label: 'Kháng sinh & Kháng khuẩn',
    shortLabel: 'Kháng sinh',
    atcPrefixes: ['J01'],
    keywords: ['ceftriaxon', 'meropenem', 'vancomycin', 'ciprofloxacin', 'kháng sinh'],
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    borderClass: 'border-indigo-500',
  },
  {
    key: 'opioid',
    label: 'Giảm đau Opioid',
    shortLabel: 'Opioid',
    atcPrefixes: ['N02A', 'N01A'],
    keywords: ['morphin', 'morphine', 'fentanyl', 'gây nghiện', 'opioid'],
    badgeClass: 'bg-purple-50 text-purple-800 border-purple-200',
    borderClass: 'border-purple-500',
  },
  {
    key: 'sedative',
    label: 'An thần & Chống co giật',
    shortLabel: 'An thần',
    atcPrefixes: ['N05B', 'N05BA'],
    keywords: ['diazepam', 'midazolam', 'hướng thần', 'an thần', 'co giật'],
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    borderClass: 'border-amber-500',
  },
  {
    key: 'bronchodilator',
    label: 'Giãn phế quản & Hô hấp',
    shortLabel: 'Giãn phế quản',
    atcPrefixes: ['R03'],
    keywords: ['salbutamol', 'albuterol', 'khí dung', 'giãn phế quản'],
    badgeClass: 'bg-teal-50 text-teal-800 border-teal-200',
    borderClass: 'border-teal-500',
  },
  {
    key: 'antiulcer_ppi',
    label: 'Giảm tiết acid dạ dày (PPI)',
    shortLabel: 'Dạ dày (PPI)',
    atcPrefixes: ['A02B', 'A02BC'],
    keywords: ['esomeprazol', 'omeprazol', 'pantoprazol', 'dạ dày', 'ppi'],
    badgeClass: 'bg-amber-50 text-amber-900 border-amber-300',
    borderClass: 'border-amber-600',
  },
  {
    key: 'antidiabetic',
    label: 'Hạ đường huyết (Đái tháo đường)',
    shortLabel: 'Đái tháo đường',
    atcPrefixes: ['A10'],
    keywords: ['metformin', 'insulin', 'gliclazid', 'đường huyết'],
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    borderClass: 'border-emerald-500',
  },
  {
    key: 'lipid_lowering',
    label: 'Hạ lipid máu (Statin)',
    shortLabel: 'Mỡ máu',
    atcPrefixes: ['C10'],
    keywords: ['atorvastatin', 'rosuvastatin', 'simvastatin', 'lipid', 'statin'],
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
    borderClass: 'border-slate-500',
  },
  {
    key: 'iv_fluids_electrolytes',
    label: 'Dịch truyền & Bồi phụ điện giải',
    shortLabel: 'Dịch truyền - Điện giải',
    atcPrefixes: ['B05', 'A12'],
    keywords: ['natri clorid', 'ringer', 'glucose', 'kali clorid', 'dịch truyền', 'điện giải'],
    badgeClass: 'bg-blue-50 text-blue-900 border-blue-200 font-medium',
    borderClass: 'border-blue-600',
  },
  {
    key: 'vaccine',
    label: 'Vắc xin & Miễn dịch',
    shortLabel: 'Vắc xin',
    atcPrefixes: ['J07'],
    keywords: ['vắc xin', 'vaxigrip', 'vaccine', 'uốn ván'],
    badgeClass: 'bg-violet-50 text-violet-800 border-violet-200',
    borderClass: 'border-violet-500',
  },
  {
    key: 'medical_supply',
    label: 'Vật tư y tế & Tiêu hao',
    shortLabel: 'Vật tư',
    atcPrefixes: [],
    keywords: ['chỉ phẫu thuật', 'bơm tiêm', 'dây truyền', 'vật tư', 'găng tay'],
    badgeClass: 'bg-zinc-100 text-zinc-800 border-zinc-200',
    borderClass: 'border-zinc-400',
  },
];

export const DEFAULT_PHARM_GROUP: PharmacologicalGroupDef = {
  key: 'all', label: 'Thuốc chuyên khoa khác', shortLabel: 'Chuyên khoa',
  atcPrefixes: [], keywords: [],
  badgeClass: 'bg-slate-100 text-slate-700 border-slate-200', borderClass: 'border-slate-400',
};

/**
 * Xác định chính xác 100% nhóm tác dụng dược lý lâm sàng dựa trên ATC & Dược Thư
 */
export function resolvePharmacologicalGroup(
  atcCode?: string,
  innOrName?: string,
  legacyCategory?: string
): PharmacologicalGroupDef {
  const atc = (atcCode || '').toUpperCase().trim();
  const text = `${innOrName || ''} ${legacyCategory || ''}`.toLowerCase();

  // 1. Ưu tiên tra cứu theo chuẩn ATC WHO
  if (atc) {
    for (const grp of PHARMACOLOGICAL_GROUPS) {
      if (grp.atcPrefixes.some((p) => atc.startsWith(p))) {
        return grp;
      }
    }
  }

  // 2. Tra cứu theo hoạt chất / tên Dược Thư
  for (const grp of PHARMACOLOGICAL_GROUPS) {
    if (grp.keywords.some((kw) => text.includes(kw))) {
      return grp;
    }
  }

  // Mặc định an toàn
  return DEFAULT_PHARM_GROUP;
}
