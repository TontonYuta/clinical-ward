/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Cấu hình & Trình tạo Link Kiểm chứng Y tế Thủ công (Manual Verification Links) (<=200 LOC)
 * Cho phép bác sĩ/dược sĩ đối soát 100% dữ liệu với nguồn Bộ Y Tế, NIDQC & US FDA
 */

// Cờ bật/tắt hiển thị link kiểm chứng trên toàn bộ ứng dụng (có thể đổi thành false khi nghiệm thu/hoàn thiện)
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

/**
 * 1. Link tra cứu Cục Quản lý Dược (DAV - Bộ Y tế)
 */
export function getDavRegistryUrl(sdk?: string, drugName?: string): string {
  // Cổng công bố giấy đăng ký thuốc chính thức của Cục Quản lý Dược
  return 'https://dichvucong.dav.gov.vn/congbothuoc/index';
}

/**
 * 2. Link tra cứu chuyên luận Dược thư Quốc gia Việt Nam (Viện Kiểm nghiệm Thuốc TW - NIDQC)
 */
export function getNidqcPharmacopeiaUrl(innOrName: string): string {
  const cleanInn = innOrName.split('(')[0].replace(/hydroclorid|sulfat|tartrat|natri|kali/gi, '').trim();
  return `https://nidqc.org.vn/?s=${encodeURIComponent(cleanInn)}`;
}

/**
 * 3. Link tra cứu nhãn thuốc SPL & Tá dược chuẩn quốc tế (US FDA DailyMed - NLM/NIH)
 */
export function getDailyMedFdaUrl(innOrName: string): string {
  const cleanInn = innOrName.split('(')[0].replace(/hydroclorid|sulfat|tartrat/gi, '').trim();
  return `https://dailymed.nlm.nih.gov/dailymed/search.cfm?labeltype=all&query=${encodeURIComponent(cleanInn)}`;
}

/**
 * 4. Link tra cứu API gốc OpenFDA JSON (đối soát tá dược & boxed warning)
 */
export function getOpenFdaJsonUrl(innOrName: string): string {
  const cleanInn = innOrName.split('(')[0].trim().toLowerCase();
  return `https://api.fda.gov/drug/label.json?search=openfda.substance_name:${encodeURIComponent(cleanInn)}&limit=1`;
}

/**
 * 5. Link văn bản quy phạm pháp luật y tế Bộ Y tế (Thư viện Pháp luật)
 */
export function getRegulatoryLawUrl(basis: string): string {
  const lower = basis.toLowerCase();
  if (lower.includes('20/2017') || lower.includes('thông tư 20')) {
    return 'https://thuvienphapluat.vn/van-ban/The-thao-Y-te/Thong-tu-20-2017-TT-BYT-huong-dan-Luat-duoc-ve-thuoc-va-nguyen-lieu-lam-thuoc-phai-kiem-soat-dac-biet-349884.aspx';
  }
  if (lower.includes('51/2017') || lower.includes('thông tư 51')) {
    return 'https://thuvienphapluat.vn/van-ban/The-thao-Y-te/Thong-tu-51-2017-TT-BYT-huong-dan-phong-chan-doan-va-xu-tri-phan-ve-372138.aspx';
  }
  if (lower.includes('2147') || lower.includes('kháng sinh')) {
    return 'https://kcb.vn/tai-lieu-chuyen-mon/huong-dan-su-dung-khang-sinh-ban-hanh-kem-theo-quyet-dinh-so-2147-qd-byt.html';
  }
  return 'https://dav.gov.vn/van-ban-quy-pham-phap-luat-c315.html';
}
