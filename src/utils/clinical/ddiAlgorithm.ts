/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Clinical DDI & Polypharmacy Triage Engine (Client-side) (<=195 LOC)
 * Căn cứ: QĐ 5948/QĐ-BYT, QĐ 3445/QĐ-BYT (Dược thư QG 2022)
 */

export type DdiSeverity = 'CONTRAINDICATED' | 'MAJOR' | 'MODERATE' | 'SAFE_SYNERGY';

export interface PatientClinicalContext {
  egfr?: number;
  hasHepaticImpairment?: boolean;
  serumPotassium?: number;
  baselineQtc?: number;
  isPregnant?: boolean;
  age?: number;
}

export interface DrugEntity {
  raw: string;
  inn: string;
  display: string;
  classes: string[];
  riskFlags: string[];
}

export interface DdiAlert {
  ruleId: string;
  severity: DdiSeverity;
  title: string;
  drugA: string;
  drugB: string;
  mechanism: string;
  clinicalConsequence: string;
  actionRecommendation: string;
  legalEvidence: string;
  escalated?: boolean;
  escalationReason?: string;
}

const REGISTRY: Record<string, { display: string; aliases: string[]; classes: string[]; risk: string[] }> = {
  clopidogrel: { display: 'Clopidogrel', aliases: ['plavix', 'pidogrel'], classes: ['P2Y12'], risk: ['bleeding'] },
  omeprazol: { display: 'Omeprazol', aliases: ['omeprazol', 'losec', 'omez'], classes: ['PPI_CYP2C19'], risk: [] },
  esomeprazol: { display: 'Esomeprazol', aliases: ['esomeprazol', 'nexium'], classes: ['PPI_CYP2C19'], risk: [] },
  nitroglycerin: { display: 'Nitroglycerin', aliases: ['nitroglycerin', 'nitromint', 'nitro'], classes: ['NITRATE'], risk: [] },
  sildenafil: { display: 'Sildenafil', aliases: ['sildenafil', 'viagra', 'siloflam'], classes: ['PDE5'], risk: [] },
  simvastatin: { display: 'Simvastatin', aliases: ['simvastatin', 'zocor'], classes: ['STATIN_3A4'], risk: [] },
  clarithromycin: { display: 'Clarithromycin', aliases: ['clarithromycin', 'klacid'], classes: ['MACROLIDE_3A4'], risk: ['qt_prolonging'] },
  ketorolac: { display: 'Ketorolac', aliases: ['ketorolac', 'toradol'], classes: ['NSAID'], risk: ['bleeding', 'nephrotoxic'] },
  diclofenac: { display: 'Diclofenac', aliases: ['diclofenac', 'voltaren'], classes: ['NSAID'], risk: ['bleeding', 'nephrotoxic'] },
  ceftriaxon: { display: 'Ceftriaxon', aliases: ['ceftriaxon', 'ceftriaxone', 'rocephin'], classes: ['CEFTRIAXONE'], risk: [] },
  calci: { display: 'Calci / Ringer Lactat', aliases: ['calci', 'canxi', 'ringer lactat', 'calcium'], classes: ['CALCIUM'], risk: [] },
  amiodaron: { display: 'Amiodaron', aliases: ['amiodaron', 'amiodarone', 'cordarone'], classes: ['ANTIARR_III'], risk: ['qt_prolonging'] },
  colchicin: { display: 'Colchicin', aliases: ['colchicin', 'colchicine'], classes: ['COLCHICINE'], risk: [] },
  digoxin: { display: 'Digoxin', aliases: ['digoxin', 'lanoxin'], classes: ['DIGITALIS'], risk: [] },
  ciprofloxacin: { display: 'Ciprofloxacin', aliases: ['ciprofloxacin', 'cifran'], classes: ['QUINOLONE'], risk: ['qt_prolonging'] },
  levofloxacin: { display: 'Levofloxacin', aliases: ['levofloxacin', 'cravit'], classes: ['QUINOLONE'], risk: ['qt_prolonging'] },
  theophyllin: { display: 'Theophyllin', aliases: ['theophyllin', 'theostat'], classes: ['THEOPHYLLINE'], risk: [] },
  tramadol: { display: 'Tramadol', aliases: ['tramadol', 'tramal'], classes: ['OPIOID', 'SEROTONIN'], risk: ['cns_depressant'] },
  linezolid: { display: 'Linezolid', aliases: ['linezolid', 'zyvox'], classes: ['MAOI'], risk: [] },
  morphin: { display: 'Morphin', aliases: ['morphin', 'morphine'], classes: ['OPIOID'], risk: ['cns_depressant'] },
  diazepam: { display: 'Diazepam', aliases: ['diazepam', 'seduxen', 'valium'], classes: ['BENZO'], risk: ['cns_depressant'] },
  paracetamol: { display: 'Paracetamol', aliases: ['paracetamol', 'panadol', 'efferalgan'], classes: ['ANALGESIC'], risk: [] },
  spironolacton: { display: 'Spironolacton', aliases: ['spironolacton', 'aldactone'], classes: ['K_SPARING'], risk: ['hyperkalemia'] },
  enalapril: { display: 'Enalapril', aliases: ['enalapril', 'renitec'], classes: ['RAAS'], risk: ['hyperkalemia'] },
  furosemid: { display: 'Furosemid', aliases: ['furosemid', 'lasix'], classes: ['LOOP_DIURETIC'], risk: ['nephrotoxic'] },
  metformin: { display: 'Metformin', aliases: ['metformin', 'glucophage'], classes: ['BIGUANIDE'], risk: [] },
  can_quang: { display: 'Thuốc cản quang Iod', aliases: ['can quang', 'xenetix', 'omnipaque'], classes: ['CONTRAST'], risk: ['nephrotoxic'] },
};

export function normalizeDrug(raw: string): DrugEntity {
  const norm = raw.toLowerCase().replace(/\b(\d+mg|\d+ml|viên|ống|lọ|uống|tiêm)\b/g, '').trim();
  for (const [inn, data] of Object.entries(REGISTRY)) {
    if (norm.includes(inn) || data.aliases.some(a => norm.includes(a))) {
      return { raw, inn, display: data.display, classes: data.classes, riskFlags: data.risk };
    }
  }
  return { raw, inn: norm, display: raw.trim(), classes: [], riskFlags: [] };
}

const CLASS_RULES = [
  { id: 'NITRATE_PDE5', cA: 'NITRATE', cB: 'PDE5', sev: 'CONTRAINDICATED' as DdiSeverity, title: 'NITRAT + ỨC CHẾ PDE-5: TỤT HUYẾT ÁP TỬ VONG', m: 'Tăng cGMP mạch máu giãn mạch dữ dội.', c: 'Tụt huyết áp kịch phát, tử vong.', a: 'Cấm phối hợp.', s: 'QĐ 5948/QĐ-BYT' },
  { id: 'CEF_CALCIUM', cA: 'CEFTRIAXONE', cB: 'CALCIUM', sev: 'CONTRAINDICATED' as DdiSeverity, title: 'CEFTRIAXONE + CALCI: TỦ TẮC MẠCH PHỔI', m: 'Kết tủa muối tinh thể Ceftriaxone-Calci.', c: 'Tắc mạch phổi, suy thận cấp tử vong.', a: 'CẤM dùng chung trong 48h.', s: 'QĐ 5948/QĐ-BYT' },
  { id: 'STATIN_MACRO', cA: 'STATIN_3A4', cB: 'MACROLIDE_3A4', sev: 'CONTRAINDICATED' as DdiSeverity, title: 'STATIN + MACROLID: TIÊU CƠ VÂN CẤP', m: 'Ức chế CYP3A4 tăng nồng độ Statin gấp 5-10 lần.', c: 'Tiêu cơ vân, suy thận cấp.', a: 'Ngừng statin khi dùng macrolid.', s: 'QĐ 5948/QĐ-BYT' },
  { id: 'PLAVIX_PPI', cA: 'P2Y12', cB: 'PPI_CYP2C19', sev: 'CONTRAINDICATED' as DdiSeverity, title: 'CLOPIDOGREL + OMEPRAZOL: GIẢM HIỆU LỰC CHỐNG ĐÔNG', m: 'Ức chế CYP2C19 ngăn hoạt hóa clopidogrel.', c: 'Tăng huyết khối stent, tái nhồi máu.', a: 'Đổi sang Pantoprazol.', s: 'QĐ 5948/QĐ-BYT' },
  { id: 'DUAL_NSAID', cA: 'NSAID', cB: 'NSAID', sev: 'CONTRAINDICATED' as DdiSeverity, title: 'HAI NSAID: XUẤT HUYẾT TIÊU HÓA Ồ ẠT', m: 'Hiệp đồng ức chế COX-1 bảo vệ niêm mạc.', c: 'Thủng dạ dày, xuất huyết nguy kịch.', a: 'Chống chỉ định dùng 2 NSAID.', s: 'QĐ 5948/QĐ-BYT' },
  { id: 'OPIOID_BENZO', cA: 'OPIOID', cB: 'BENZO', sev: 'CONTRAINDICATED' as DdiSeverity, title: 'OPIOID + BENZODIAZEPINE: ỨC CHẾ HÔ HẤP TỬ VONG', m: 'Hiệp đồng an thần sâu qua thụ thể mu và GABA-A.', c: 'Ngừng thở đột ngột, hôn mê.', a: 'Tránh phối hợp, sẵn sàng Naloxone.', s: 'FDA Black Box' },
  { id: 'SERO_MAOI', cA: 'SEROTONIN', cB: 'MAOI', sev: 'CONTRAINDICATED' as DdiSeverity, title: 'TRAMADOL + LINEZOLID: HỘI CHỨNG SEROTONIN', m: 'Ức chế tái hấp thu & phân hủy Serotonin.', c: 'Sốt cao, co giật, trụy mạch tử vong.', a: 'Cấm phối hợp.', s: 'QĐ 5948/QĐ-BYT' },
  { id: 'QUIN_THEO', cA: 'QUINOLONE', cB: 'THEOPHYLLINE', sev: 'MAJOR' as DdiSeverity, title: 'QUINOLON + THEOPHYLLIN: NGỘ ĐỘC CO GIẬT', m: 'Ức chế CYP1A2 giảm thải trừ theophyllin.', c: 'Loạn nhịp thất, co giật toàn thể.', a: 'Giảm 50% liều theophyllin.', s: 'QĐ 5948/QĐ-BYT' },
  { id: 'AMIOD_COLCH', cA: 'ANTIARR_III', cB: 'COLCHICINE', sev: 'MAJOR' as DdiSeverity, title: 'AMIODARON + COLCHICIN: NGỘ ĐỘC COLCHICIN ĐA TẠNG', m: 'Ức chế P-gp giảm thải trừ Colchicin.', c: 'Tiêu cơ vân, suy đa tạng tử vong.', a: 'Cấm dùng nếu suy gan hoặc suy thận.', s: 'QĐ 5948/QĐ-BYT' },
  { id: 'RAAS_K', cA: 'RAAS', cB: 'K_SPARING', sev: 'MAJOR' as DdiSeverity, title: 'RAAS + LỢI TIỂU GIỮ KALI: TĂNG KALI MÁU CẤP', m: 'Hiệp đồng giảm bài tiết kali tại ống góp.', c: 'Ngừng tim do tăng kali.', a: 'Theo dõi điện giải đồ K+.', s: 'QĐ 5948/QĐ-BYT' },
  { id: 'MET_CONTRAST', cA: 'BIGUANIDE', cB: 'CONTRAST', sev: 'MODERATE' as DdiSeverity, title: 'METFORMIN + CẢN QUANG IOD: NHIỄM TOAN LACTIC', m: 'Thuốc cản quang gây suy thận làm tích lũy metformin.', c: 'Toan lactic tử vong.', a: 'Ngừng metformin 48h nếu eGFR < 60.', s: 'ESUR' }
];

export function evaluatePairDdi(rawA: string, rawB: string, p?: PatientClinicalContext): DdiAlert | null {
  const a = normalizeDrug(rawA);
  const b = normalizeDrug(rawB);
  if (a.inn === b.inn) return null;

  // 1. Safe synergy
  if ((a.inn === 'morphin' && b.inn === 'paracetamol') || (a.inn === 'paracetamol' && b.inn === 'morphin')) {
    return {
      ruleId: 'SYN_MORPH_PARA', severity: 'SAFE_SYNERGY', title: 'MORPHIN + PARACETAMOL: GIẢM ĐAU ĐA MÔ THỨC AN TOÀN',
      drugA: a.display, drugB: b.display, mechanism: 'Giảm đau đa tầng qua thụ thể mu và COX trung ương.',
      clinicalConsequence: 'Tiết kiệm 20-30% liều morphin, giảm suy hô hấp.',
      actionRecommendation: 'Phối hợp được khuyến cáo (Paracetamol <= 4g/ngày).', legalEvidence: 'Dược thư QG 2022 & WHO'
    };
  }

  // 2. Class rules & patient context escalation
  for (const r of CLASS_RULES) {
    const match = (a.classes.includes(r.cA) && b.classes.includes(r.cB)) || (b.classes.includes(r.cA) && a.classes.includes(r.cB));
    if (match) {
      let sev = r.sev;
      let esc = false;
      let reason: string | undefined;
      if (p) {
        if (r.id === 'AMIOD_COLCH' && ((p.egfr && p.egfr < 60) || p.hasHepaticImpairment)) {
          sev = 'CONTRAINDICATED'; esc = true; reason = `Leo thang do eGFR=${p.egfr} < 60 hoặc suy gan.`;
        } else if (r.id === 'MET_CONTRAST' && (p.egfr && p.egfr < 45)) {
          sev = 'CONTRAINDICATED'; esc = true; reason = `Leo thang do eGFR=${p.egfr} < 45.`;
        } else if (r.id === 'RAAS_K' && ((p.egfr && p.egfr < 30) || (p.serumPotassium && p.serumPotassium >= 5.0))) {
          sev = 'CONTRAINDICATED'; esc = true; reason = `Leo thang do Kali=${p.serumPotassium} hoặc eGFR < 30.`;
        }
      }
      return {
        ruleId: r.id, severity: sev, title: r.title, drugA: a.display, drugB: b.display,
        mechanism: r.m, clinicalConsequence: r.c, actionRecommendation: r.a,
        legalEvidence: r.s, escalated: esc, escalationReason: reason
      };
    }
  }
  return null;
}

export function auditPrescriptionList(drugs: string[], p?: PatientClinicalContext): { alerts: DdiAlert[]; poly: DdiAlert[] } {
  const entities = Array.from(new Set(drugs.map(d => normalizeDrug(d)).filter(d => d.inn)));
  const alerts: DdiAlert[] = [];
  const poly: DdiAlert[] = [];

  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      const alt = evaluatePairDdi(entities[i].raw, entities[j].raw, p);
      if (alt) alerts.push(alt);
    }
  }

  // Polypharmacy: Cumulative QTc
  const qt = entities.filter(e => e.riskFlags.includes('qt_prolonging'));
  if (qt.length >= 2) {
    poly.push({
      ruleId: 'POLY_QT', severity: qt.length >= 3 || (p?.baselineQtc && p.baselineQtc >= 480) ? 'CONTRAINDICATED' : 'MAJOR',
      title: `CỘNG DỒN KÉO DÀI QT (${qt.length} THUỐC): NGUY CƠ XOẮN ĐỈNH`, drugA: qt.map(d => d.display).join(', '), drugB: '',
      mechanism: 'Ức chế dòng IKr cộng dồn làm chậm tái cực cơ tim.', clinicalConsequence: 'Xoắn đỉnh, ngừng tim đột ngột.',
      actionRecommendation: 'Đo ECG 12 chuyển đạo, theo dõi QTc.', legalEvidence: 'Dược Thư QG 2022'
    });
  }

  // Polypharmacy: Triple Whammy
  const hasRaas = entities.some(e => e.classes.includes('RAAS'));
  const hasDiuretic = entities.some(e => e.classes.includes('LOOP_DIURETIC') || e.classes.includes('K_SPARING'));
  const hasNsaid = entities.some(e => e.classes.includes('NSAID'));
  if (hasRaas && hasDiuretic && hasNsaid) {
    poly.push({
      ruleId: 'POLY_TRIPLE_WHAMMY', severity: (p?.egfr && p.egfr < 60) ? 'CONTRAINDICATED' : 'MAJOR',
      title: 'HỘI CHỨNG TRIPLE WHAMMY: NGUY CƠ SUY THẬN CẤP ĐE DỌA TÍNH MẠNG',
      drugA: 'RAAS + Lợi tiểu + NSAID', drugB: '', mechanism: 'Co tiểu động mạch vào + giãn tiểu động mạch ra + giảm thể tích tuần hoàn.',
      clinicalConsequence: 'Sụt giảm cấp tính mức lọc cầu thận, hoại tử ống thận.',
      actionRecommendation: 'Cấm phối hợp đồng thời. Đổi NSAID sang Paracetamol.', legalEvidence: 'QĐ 5948/QĐ-BYT & KDIGO'
    });
  }

  return { alerts, poly };
}
