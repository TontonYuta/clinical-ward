/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface MedCatalogItem {
  name: string;
  type: string;
  unit: string;
  isNarcotic: boolean;
  aliases: string[];
}

export interface DeviceCatalogItem {
  name: string;
  model: string;
  serial: string;
  risk: string;
  aliases: string[];
}

export const MED_CATALOG: MedCatalogItem[] = [
  { name: 'Morphin sulfat 10mg/1ml', type: 'Thuốc gây nghiện', unit: 'ống', isNarcotic: true, aliases: ['morphin', 'moocphin', 'morfin', 'morphine', 'dolophine'] },
  { name: 'Fentanyl 0.1mg/2ml', type: 'Thuốc gây nghiện', unit: 'ống', isNarcotic: true, aliases: ['fentanyl', 'fentanin'] },
  { name: 'Diazepam 10mg/2ml', type: 'Thuốc gây nghiện', unit: 'ống', isNarcotic: true, aliases: ['diazepam', 'seduxen', 'valium'] },
  { name: 'Midazolam 5mg/ml', type: 'Thuốc gây nghiện', unit: 'ống', isNarcotic: true, aliases: ['midazolam', 'mida'] },
  { name: 'Adrenalin 1mg/1ml (Hadunalin / Epinephrin)', type: 'Thuốc cấp cứu', unit: 'ống', isNarcotic: false, aliases: ['hadunalin', 'adrenalin', 'adre', 'adr', 'epinephrine', 'epinephrin'] },
  { name: 'Noradrenalin 4mg/4ml', type: 'Thuốc cấp cứu', unit: 'ống', isNarcotic: false, aliases: ['noradrenalin', 'norepinephrine', 'vận mạch'] },
  { name: 'Atropin sulfat 0.25mg/ml', type: 'Thuốc cấp cứu', unit: 'ống', isNarcotic: false, aliases: ['atropin', 'nhịp chậm'] },
  { name: 'Cordarone 150mg/3ml', type: 'Thuốc cấp cứu', unit: 'ống', isNarcotic: false, aliases: ['cordarone', 'amiodarone', 'chống loạn nhịp'] },
  { name: 'Kháng sinh Ceftriaxone 1g (Rocephin)', type: 'Thuốc cấp cứu', unit: 'lọ', isNarcotic: false, aliases: ['ceftriaxone', 'ceftriaxon', 'rocephin', 'cefmex'] },
  { name: 'Kháng sinh Augmentin 1g (Amoxicillin + Clavulanic)', type: 'Kháng sinh', unit: 'viên', isNarcotic: false, aliases: ['augmentin', 'amoxicillin', 'clavulanic'] },
  { name: 'Kháng sinh Ciprofloxacin 500mg', type: 'Kháng sinh', unit: 'viên', isNarcotic: false, aliases: ['ciprofloxacin', 'cipro', 'konfixin'] },
  { name: 'Kháng sinh Vancomycin 1g', type: 'Thuốc cấp cứu', unit: 'lọ', isNarcotic: false, aliases: ['vancomycin', 'vanco'] },
  { name: 'Paracetamol 1000mg/100ml (Panadol / Efferalgan)', type: 'Thuốc cấp cứu', unit: 'chai', isNarcotic: false, aliases: ['paracetamol', 'panadol', 'efferalgan', 'acetaminophen'] },
  { name: 'Kháng sinh Meropenem 1g (Meronem)', type: 'Thuốc cấp cứu', unit: 'lọ', isNarcotic: false, aliases: ['meropenem', 'meronem'] },
  { name: 'Nhũ dịch Lipid 20% Lipofundin 100ml', type: 'Thuốc cấp cứu', unit: 'chai', isNarcotic: false, aliases: ['lipid', 'lipofundin'] },
  { name: 'Kali Clorid 10% (KCl 10ml)', type: 'Thuốc cấp cứu', unit: 'ống', isNarcotic: false, aliases: ['kali', 'kcl', 'kali clorid'] },
  { name: 'Gây tê Lidocain 2% (Xylocaine)', type: 'Thuốc cấp cứu', unit: 'ống', isNarcotic: false, aliases: ['lidocain', 'lidocaine', 'xylocaine'] },
  { name: 'Omeprazol 20mg', type: 'Thuốc điều trị chuyên khoa', unit: 'viên', isNarcotic: false, aliases: ['omeprazol', 'omeprazole'] },
  { name: 'Vắc xin phòng dại Verorab 0.5ml', type: 'Thuốc cấp cứu', unit: 'liều', isNarcotic: false, aliases: ['verorab', 'dại'] },
  { name: 'Huyết thanh kháng uốn ván SAT 1500 UI', type: 'Thuốc cấp cứu', unit: 'liều', isNarcotic: false, aliases: ['sat', 'uốn ván'] },
  { name: 'Dây truyền dịch có bầu đếm giọt', type: 'Vật tư tiêu hao', unit: 'bộ', isNarcotic: false, aliases: ['dây truyền', 'dây truyền dịch', 'bầu đếm giọt'] },
  { name: 'Chỉ phẫu thuật Catgut 3/0', type: 'Vật tư tiêu hao', unit: 'hộp', isNarcotic: false, aliases: ['catgut', 'chỉ phẫu thuật', 'chỉ khâu'] },
  { name: 'Bơm tiêm 5ml Vinahankook tiệt trùng', type: 'Vật tư tiêu hao', unit: 'cái', isNarcotic: false, aliases: ['bơm tiêm 5ml', 'bơm tiêm', 'kim tiêm'] },
  { name: 'Catheter tĩnh mạch trung tâm 3 nòng CVC', type: 'Vật tư tiêu hao', unit: 'bộ', isNarcotic: false, aliases: ['cvc', 'catheter'] },
  { name: 'Kim luồn tĩnh mạch ngoại vi 20G', type: 'Vật tư tiêu hao', unit: 'cái', isNarcotic: false, aliases: ['kim luồn', 'kim luồn 20g'] }
];

export const DEVICE_CATALOG: DeviceCatalogItem[] = [
  { name: 'Máy thở Puritan Bennett 840 (PB840)', model: 'PB840 Ventilator - Medtronic', serial: 'PB840-VN-2021-998', risk: 'D', aliases: ['pb840', 'pb 840', 'puritan bennett', 'bennett', 'máy thở'] },
  { name: 'Máy sốc tim Zoll R Series', model: 'Zoll R Series ALS Defibrillator', serial: 'ZOLL-R-8831', risk: 'D', aliases: ['zoll', 'sốc tim', 'máy sốc tim', 'phá rung'] },
  { name: 'Hệ thống lọc máu liên tục CRRT Prismaflex', model: 'Prismaflex v8.0 - Baxter', serial: 'PRISMA-VN-2022-014', risk: 'D', aliases: ['crrt', 'lọc máu', 'prismaflex'] },
  { name: 'Máy theo dõi bệnh nhân Philips MP50', model: 'IntelliVue MP50 Monitor', serial: 'PHI-MP50-4102', risk: 'C', aliases: ['mp50', 'mp 50', 'monitor', 'philips'] },
  { name: 'Bơm tiêm điện B.Braun Perfusor Space', model: 'Perfusor Space - B.Braun', serial: 'BBR-PERF-9921', risk: 'C', aliases: ['bơm tiêm điện', 'perfusor', 'b.braun', 'bbraun'] },
  { name: 'Máy thở Maquet Servo-i Universal', model: 'Servo-i - Getinge', serial: 'MAQ-SERVOI-3104', risk: 'D', aliases: ['servo-i', 'servo i', 'maquet'] },
  { name: 'Máy phá rung tim Philips HeartStart XL', model: 'HeartStart XL M4735A', serial: 'PHI-HSXL-7712', risk: 'D', aliases: ['heartstart', 'heartstart xl', 'phá rung'] },
  { name: 'Máy đo khí máu Radiometer ABL90 FLEX', model: 'ABL90 FLEX - Radiometer', serial: 'RAD-ABL90-5541', risk: 'C', aliases: ['abl90', 'abl 90', 'khí máu', 'máy khí máu', 'radiometer'] },
  { name: 'Bình làm ẩm thở máy Fisher & Paykel MR850', model: 'MR850 Humidifier', serial: 'FP-MR850-8802', risk: 'C', aliases: ['mr850', 'bình làm ẩm'] },
  { name: 'Máy điện tim 12 cần Nihon Kohden', model: 'Cardiofax M ECG-1250K', serial: 'NK-ECG12-1089', risk: 'B', aliases: ['ecg', 'điện tim', 'nihon kohden'] }
];

const dynamicMeds: MedCatalogItem[] = [];
const dynamicDevices: DeviceCatalogItem[] = [];

export function registerDynamicMed(item: MedCatalogItem): void {
  if (!dynamicMeds.some(m => m.name.toLowerCase() === item.name.toLowerCase())) {
    dynamicMeds.push(item);
  }
}

export function registerDynamicMeds(items: MedCatalogItem[]): void {
  for (const it of items) registerDynamicMed(it);
}

export function getDynamicMeds(): MedCatalogItem[] {
  return [...dynamicMeds];
}

export function findMatchedMed(lowerText: string): MedCatalogItem | undefined {
  const isElectricPump = lowerText.includes('bơm tiêm điện');
  // 1. Khớp nhanh trong danh mục nòng cốt thiết yếu
  for (const m of MED_CATALOG) {
    if (m.name.includes('Bơm tiêm') && isElectricPump) continue;
    if (m.aliases.some(alias => {
      if (alias === 'bơm tiêm' && isElectricPump) return false;
      return lowerText.includes(alias);
    })) {
      return m;
    }
  }

  // 2. Khớp trong danh mục động đã được đăng ký hoặc nạp
  for (const m of dynamicMeds) {
    if (m.aliases.some(alias => lowerText.includes(alias))) {
      return m;
    }
  }

  return undefined;
}

export function findMatchedDevice(lowerText: string): DeviceCatalogItem | undefined {
  // 1. Khớp thiết bị nòng cốt
  const exact = DEVICE_CATALOG.find(d => d.aliases.some(alias => lowerText.includes(alias)));
  if (exact) return exact;

  // 2. Khớp thiết bị động đã đăng ký
  const dyn = dynamicDevices.find(d => d.aliases.some(alias => lowerText.includes(alias)));
  if (dyn) return dyn;

  // 3. Khớp thiết bị y tế theo danh mục chung
  const commonDevices: Array<{ pattern: RegExp; name: string; model: string; risk: string; aliases: string[] }> = [
    { pattern: /\bmáy thở\b/, name: 'Máy thở Hồi sức Cấp cứu', model: 'Ventilator Standard', risk: 'D', aliases: ['máy thở'] },
    { pattern: /\bmáy sốc tim\b|\bphá rung\b/, name: 'Máy sốc tim & Phá rung', model: 'Defibrillator Standard', risk: 'D', aliases: ['máy sốc tim', 'phá rung'] },
    { pattern: /\bbơm tiêm điện\b|\bperfusor\b/, name: 'Bơm tiêm điện chính xác', model: 'Precision Syringe Pump', risk: 'C', aliases: ['bơm tiêm điện', 'perfusor'] },
    { pattern: /\bmáy lọc máu\b|\bcrrt\b/, name: 'Hệ thống lọc máu liên tục CRRT', model: 'Continuous Dialysis System', risk: 'D', aliases: ['máy lọc máu', 'crrt'] },
    { pattern: /\bmonitor\b|\bmáy theo dõi\b/, name: 'Máy theo dõi bệnh nhân đa thông số', model: 'Patient Monitor Standard', risk: 'C', aliases: ['monitor', 'máy theo dõi'] },
    { pattern: /\bmáy đo khí máu\b|\bkhí máu\b/, name: 'Máy phân tích khí máu', model: 'Blood Gas Analyzer', risk: 'C', aliases: ['máy đo khí máu', 'khí máu'] },
    { pattern: /\bmáy điện tim\b|\becg\b/, name: 'Máy điện tim ECG', model: 'ECG Multi-channel', risk: 'B', aliases: ['máy điện tim', 'ecg'] },
    { pattern: /\bmáy hút dịch\b/, name: 'Máy hút dịch áp lực âm', model: 'Suction Unit Standard', risk: 'B', aliases: ['máy hút dịch'] },
  ];
  for (const dev of commonDevices) {
    if (dev.pattern.test(lowerText)) {
      return {
        name: dev.name,
        model: dev.model,
        serial: 'EQ-GENERIC',
        risk: dev.risk,
        aliases: dev.aliases
      };
    }
  }

  return undefined;
}
