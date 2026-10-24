/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export function maskClinicalPII(text: string): { maskedText: string; piiMap: Record<string, string> } {
  let maskedText = text;
  const piiMap: Record<string, string> = {};

  // Mask mã bệnh án / số hồ sơ (e.g., BN-8820, BN-8825, BA-2026-99)
  const idRegex = /(?:BN|BA|HSBA)[-_ ]?[0-9]+/gi;
  let idIndex = 1;
  maskedText = maskedText.replace(idRegex, match => {
    const placeholder = `[PID_ANON_${idIndex++}]`;
    piiMap[placeholder] = match;
    return placeholder;
  });

  // Mask tên bệnh nhân
  const patMatch = text.match(/(?:cho\s+)?(?:bệnh nhân|bn|chị|anh|bác)\s+([A-ZÀ-Ỹa-zà-ỹ0-9\s\-]+?)(?=\s+(?:ở|tại|buồng|giường|phòng|khoa|cần|tiêm|dùng|$))/i);
  if (patMatch && patMatch[1].trim().length > 2) {
    const originalName = patMatch[1].trim();
    const placeholder = `[PATIENT_ANON_01]`;
    piiMap[placeholder] = originalName;
    maskedText = maskedText.replace(originalName, placeholder);
  }

  return { maskedText, piiMap };
}

export function unmaskClinicalPII(text: string, piiMap: Record<string, string>): string {
  let result = text;
  for (const [placeholder, original] of Object.entries(piiMap)) {
    result = result.replace(new RegExp(placeholder.replace(/[\[\]]/g, '\\$&'), 'g'), original);
  }
  return result;
}
