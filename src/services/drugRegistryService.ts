/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Service Đồng bộ & Tra cứu Dữ liệu Dược Quốc gia (DAV Registry) (<=200 LOC)
 * Căn cứ: Cổng Dịch vụ công Cục Quản lý Dược - Bộ Y tế (dichvucong.dav.gov.vn)
 */

import { MasterMedication, MedicationGroup } from '../types/medication';

export interface DavRawDrugItem {
  id: number;
  tenThuoc: string;
  soDangKy: string;
  thongTinDangKyThuoc?: {
    ngayCapSoDangKy?: string;
    ngayHetHanSoDangKy?: string;
    soQuyetDinh?: string;
    dotCap?: string;
  };
  thongTinThuocCoBan?: {
    hoatChatChinh?: string;
    hamLuong?: string;
    dangBaoChe?: string;
    dongGoi?: string;
    tieuChuan?: string;
    tuoiTho?: string;
  };
  thongTinTaiLieu?: {
    urlHuongDanSuDung?: string;
    urlNhan?: string;
  };
  congTySanXuat?: {
    tenCongTySanXuat?: string;
    diaChiSanXuat?: string;
    nuocSanXuat?: string;
  };
  thuocKiemSoatDacBiet?: Record<string, any>;
}

export const DAV_API_ENDPOINT = 'https://dichvucong.dav.gov.vn/api/services/app/soDangKy/GetAllPublicServerPaging';

export async function fetchDavDrugsPage(params: {
  skipCount: number;
  maxResultCount: number;
  filterText?: string;
  timeoutMs?: number;
}): Promise<{ totalCount: number; items: DavRawDrugItem[] }> {
  const { skipCount, maxResultCount, filterText = '', timeoutMs = 12000 } = params;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(DAV_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': 'ClinicalWard-DavClient/1.0',
      },
      body: JSON.stringify({
        skipCount,
        maxResultCount,
        filterText,
        SoDangKyThuoc: {},
        KichHoat: true,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) throw new Error(`DAV API trả về mã lỗi HTTP: ${res.status}`);
    const data = await res.json();
    return {
      totalCount: data?.result?.totalCount || 0,
      items: data?.result?.items || [],
    };
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

export function classifyMedicationGroup(
  name: string,
  activeInn: string,
  hasSpecialControl?: boolean
): { group: MedicationGroup; isControlled: boolean; isHighAlert: boolean; isCrashCart: boolean } {
  const text = `${name} ${activeInn}`.toLowerCase();

  const isOpioid = /morphin|fentanyl|oxycodon|pethidin|methadon|tramadol|codein|buprenorphin/.test(text);
  const isSedative = /diazepam|seduxen|midazolam|lorazepam|clonazepam|phenobarbital|zolpidem|alprazolam/.test(text);
  const isEmergency = /adrenalin|epinephrin|noradrenalin|atropin|amiodaron|lidocain|dopamin|dobutamin|nitroglycerin/.test(text);
  const isHighAlertElec = /kali clorid|kcl|calcium gluconat|magnesi sulfat|insulin|heparin|warfarin|enoxaparin/.test(text);
  const isAntibiotic = /ceftriaxon|vancomycin|meropenem|ciprofloxacin|augmentin|ampicillin|cef|cillin|mycin|penem|oxacin|metronidazol/.test(text);
  const isInfusion = /ringer lactat|natri clorid|glucose|dextrose|haes-steril|bicarbonat/.test(text);

  if (isOpioid) {
    return { group: 'Thuốc gây nghiện', isControlled: true, isHighAlert: true, isCrashCart: true };
  }
  if (isSedative) {
    return { group: 'Thuốc hướng thần', isControlled: true, isHighAlert: false, isCrashCart: false };
  }
  if (isEmergency) {
    return { group: 'Thuốc cấp cứu', isControlled: false, isHighAlert: true, isCrashCart: true };
  }
  if (isHighAlertElec) {
    return { group: 'Thuốc nguy cơ cao', isControlled: false, isHighAlert: true, isCrashCart: true };
  }
  if (isAntibiotic) {
    return { group: 'Kháng sinh', isControlled: false, isHighAlert: false, isCrashCart: false };
  }
  if (isInfusion) {
    return { group: 'Dịch truyền', isControlled: false, isHighAlert: false, isCrashCart: false };
  }
  if (hasSpecialControl) {
    return { group: 'Thuốc hướng thần', isControlled: true, isHighAlert: false, isCrashCart: false };
  }

  return { group: 'Thuốc điều trị chuyên khoa', isControlled: false, isHighAlert: false, isCrashCart: false };
}

export function transformDavToMasterMedication(item: DavRawDrugItem): MasterMedication {
  const cleanName = (item.tenThuoc || 'Chưa đặt tên').replace(/\n/g, ' ').trim();
  const rawInn = item.thongTinThuocCoBan?.hoatChatChinh || cleanName;
  const strength = item.thongTinThuocCoBan?.hamLuong || 'Theo tiêu chuẩn';
  const dosageForm = item.thongTinThuocCoBan?.dangBaoChe || 'Dung dịch tiêm';
  const packageSpec = item.thongTinThuocCoBan?.dongGoi || 'Hộp 10 ống';

  const hasSpecial = !!(item.thuocKiemSoatDacBiet && (item.thuocKiemSoatDacBiet.isHoSoACTD || item.thuocKiemSoatDacBiet.isControlled || item.thuocKiemSoatDacBiet.ngayQuyetDinhCongVan));
  const classification = classifyMedicationGroup(cleanName, rawInn, hasSpecial);

  let unit = 'Ống';
  const lowerPack = packageSpec.toLowerCase();
  if (lowerPack.includes('viên')) unit = 'Viên';
  else if (lowerPack.includes('lọ')) unit = 'Lọ';
  else if (lowerPack.includes('chai')) unit = 'Chai';
  else if (lowerPack.includes('gói')) unit = 'Gói';

  return {
    id: `dav-${item.soDangKy || item.id}`,
    nationalCode: item.soDangKy || `DAV-${item.id}`,
    brandName: cleanName,
    activeIngredient: rawInn,
    concentration: strength,
    dosageForm,
    route: dosageForm.toLowerCase().includes('tiêm') ? 'Đường tiêm' : dosageForm.toLowerCase().includes('uống') ? 'Đường uống' : 'Theo dạng bào chế',
    standardUnit: unit,
    defaultDoseQty: 1,
    group: classification.group,
    isControlled: classification.isControlled,
    isHighAlert: classification.isHighAlert,
    isCrashCart: classification.isCrashCart,
    wardStockCount: 0,
    hospitalStockCount: 0,
    searchAliases: [cleanName.toLowerCase(), rawInn.toLowerCase().split(' ')[0]],
    note: `SĐK: ${item.soDangKy} | NSX: ${item.congTySanXuat?.tenCongTySanXuat || 'Cục QLD cấp'} | Tiêu chuẩn: ${item.thongTinThuocCoBan?.tieuChuan || 'NSX'} | Hạn dùng: ${item.thongTinThuocCoBan?.tuoiTho || 'N/A'}`,
    clinicalProfile: undefined,
  };
}
