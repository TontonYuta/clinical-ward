/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Cấu hình & Trình tạo Link Kiểm chứng Y tế Chuẩn hóa (Official Regulatory & Clinical Grounding) (<=200 LOC)
 * 100% nguồn cơ quan chính thống: Cục Quản lý Dược, NIDQC, Cổng TTĐT Chính Phủ, US FDA DailyMed, WHO
 * Tuyệt đối KHÔNG dùng link tìm kiếm Google hoặc các trang không xác thực
 */

export let SHOW_MANUAL_VERIFICATION_LINKS = true;

export function setVerificationLinksVisibility(visible: boolean) {
  SHOW_MANUAL_VERIFICATION_LINKS = visible;
  if (typeof window !== 'undefined') {
    localStorage.setItem('CLINICAL_SHOW_VERIFICATION_LINKS', visible ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('clinical-verification-toggle', { detail: visible }));
  }
}

export function isVerificationLinksVisible(): boolean {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('CLINICAL_SHOW_VERIFICATION_LINKS');
    if (saved !== null) return saved === 'true';
  }
  return SHOW_MANUAL_VERIFICATION_LINKS;
}

const VIETNAMESE_TO_ENGLISH_INN: Record<string, string> = {
  morphin: 'morphine',
  fentanyl: 'fentanyl',
  pethidin: 'meperidine',
  adrenalin: 'epinephrine',
  adrenaline: 'epinephrine',
  noradrenalin: 'norepinephrine',
  norepinephrine: 'norepinephrine',
  diazepam: 'diazepam',
  midazolam: 'midazolam',
  'kali clorid': 'potassium chloride',
  'natri clorid': 'sodium chloride',
  ceftriaxone: 'ceftriaxone',
  ceftriaxon: 'ceftriaxone',
  atropin: 'atropine',
  atropine: 'atropine',
  amiodaron: 'amiodarone',
  amiodarone: 'amiodarone',
  lidocain: 'lidocaine',
  dobutamin: 'dobutamine',
  dopamin: 'dopamine',
  vancomycin: 'vancomycin',
  metronidazol: 'metronidazole',
  ciprofloxacin: 'ciprofloxacin',
  paracetamol: 'acetaminophen',
  clorhexidin: 'chlorhexidine',
  furosemid: 'furosemide',
  insulin: 'insulin',
  heparin: 'heparin',
  propofol: 'propofol',
};

export function toEnglishInn(vietnameseInn: string): string {
  const lower = vietnameseInn.split('(')[0].trim().toLowerCase();
  for (const [vi, en] of Object.entries(VIETNAMESE_TO_ENGLISH_INN)) {
    if (lower.includes(vi)) return en;
  }
  return lower
    .replace(/\b(hydrochloride|hydroclorid|sulfate|sulfat|tartrate|tartrat|trihydrate|trihydrat|phosphate|phosphat|acetate|acetat|chloride|clorid|sodium|natri|potassium|kali|calcium|calci)\b/gi, '')
    .trim();
}

/**
 * 1. Cục Quản lý Dược - Bộ Y tế (DAV): Cổng Đăng ký thuốc & Công bố nguyên liệu làm thuốc
 */
export function getDavRegistryUrl(_sdk?: string, _drugName?: string): string {
  return 'https://dav.gov.vn/dang-ki-thuoc---cong-bo-nguyen-lieu-c311.html';
}

/**
 * 2. Cổng Thông tin Viện Kiểm nghiệm Thuốc Trung ương (NIDQC - Bộ Y Tế):
 * Cơ quan quốc gia đầu ngành biên soạn & ban hành Dược thư Quốc gia Việt Nam
 */
export function getNidqcPharmacopeiaUrl(_innOrName?: string): string {
  return 'https://nidqc.gov.vn';
}

/**
 * 3. US FDA DailyMed (National Library of Medicine - NIH):
 * Hệ thống cơ sở dữ liệu nhãn thuốc SPL & Tá dược chuẩn quốc tế
 */
export function getDailyMedFdaUrl(innOrName: string): string {
  const en = toEnglishInn(innOrName);
  return `https://dailymed.nlm.nih.gov/dailymed/search.cfm?labeltype=all&query=${encodeURIComponent(en)}`;
}

/**
 * 4. Danh mục Thuốc Thiết yếu Tổ chức Y tế Thế giới (WHO eEML)
 */
export function getWhoEssentialMedsUrl(): string {
  return 'https://list.essentialmeds.org';
}

/**
 * 5. Cổng Thông tin Điện tử Chính Phủ (vanban.chinhphu.vn) & Cục Quản lý Khám chữa bệnh (kcb.vn):
 * Liên kết trực tiếp toàn văn văn bản quy phạm pháp luật theo đúng mã định danh
 */
export function getRegulatoryLawUrl(basis: string): string {
  const lower = basis.toLowerCase();
  if (lower.includes('20/2017') || lower.includes('thông tư 20')) {
    return 'https://vanban.chinhphu.vn/?pageid=27160&docid=189732';
  }
  if (lower.includes('51/2017') || lower.includes('thông tư 51')) {
    return 'https://vanban.chinhphu.vn/?pageid=27160&docid=192461';
  }
  if (lower.includes('98/2021') || lower.includes('nghị định 98')) {
    return 'https://vanban.chinhphu.vn/?pageid=27160&docid=204558';
  }
  if (lower.includes('26/2025') || lower.includes('thông tư 26') || lower.includes('kê đơn')) {
    return 'https://kcb.vn';
  }
  return 'https://dav.gov.vn/van-ban-quy-pham-phap-luat-c315.html';
}
