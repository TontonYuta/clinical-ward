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

  const isOpioid = /morphin|fentanyl|oxycodon|pethidin|methadon|tramadol|codein/.test(text);
  const isSedative = /diazepam|seduxen|midazolam|lorazepam|clonazepam|phenobarbital/.test(text);
  const isEmergency = /adrenalin|epinephrin|noradrenalin|atropin|amiodaron|lidocain/.test(text);
  const isHighAlertElec = /kali clorid|kcl|calcium gluconat|magnesi sulfat/.test(text);
  const isAntibiotic = /ceftriaxon|vancomycin|meropenem|ciprofloxacin|augmentin|ampicillin/.test(text);
  const isInfusion = /ringer lactat|natri clorid 0\.9%|glucose|dextrose|haes-steril/.test(text);

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

  return { group: 'Thuốc cấp cứu', isControlled: false, isHighAlert: false, isCrashCart: false };
}

export function transformDavToMasterMedication(item: DavRawDrugItem): MasterMedication {
  const cleanName = (item.tenThuoc || 'Chưa đặt tên').replace(/\n/g, ' ').trim();
  const rawInn = item.thongTinThuocCoBan?.hoatChatChinh || cleanName;
  const strength = item.thongTinThuocCoBan?.hamLuong || 'Theo tiêu chuẩn';
  const dosageForm = item.thongTinThuocCoBan?.dangBaoChe || 'Dung dịch tiêm';
  const packageSpec = item.thongTinThuocCoBan?.dongGoi || 'Hộp 10 ống';

  const classification = classifyMedicationGroup(cleanName, rawInn, !!item.thuocKiemSoatDacBiet);

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
    route: dosageForm.toLowerCase().includes('tiêm') ? 'Tiêm bắp / Tiêm tĩnh mạch' : 'Đường uống',
    standardUnit: unit,
    defaultDoseQty: 1,
    group: classification.group,
    isControlled: classification.isControlled,
    isHighAlert: classification.isHighAlert,
    isCrashCart: classification.isCrashCart,
    wardStockCount: 10,
    hospitalStockCount: 200,
    searchAliases: [cleanName.toLowerCase(), rawInn.toLowerCase().split(' ')[0]],
    note: `SĐK: ${item.soDangKy} | NSX: ${item.congTySanXuat?.tenCongTySanXuat || 'Cục QLD cấp'}`,
    clinicalProfile: {
      officialSource: {
        documentName: `QĐ Cấp SĐK ${item.thongTinDangKyThuoc?.soQuyetDinh || 'Bộ Y tế'}`,
        registrationNumber: item.soDangKy,
        manufacturer: item.congTySanXuat?.tenCongTySanXuat || 'Cơ sở sản xuất công bố',
        approvalAuthority: 'Cục Quản lý Dược - Bộ Y Tế',
        standardPharmacopeia: item.thongTinThuocCoBan?.tieuChuan || 'DĐVN V / USP',
      },
      targetPopulation: 'Theo chỉ định của Bác sĩ điều trị.',
      contraindications: ['Quá mẫn với hoạt chất hoặc bất kỳ tá dược nào của thuốc'],
      patientVerificationChecklist: ['Đối soát vòng tay người bệnh', 'Kiểm tra 5 đúng'],
      standardDosing: `Khởi đầu theo hàm lượng ${strength} hoặc theo phác đồ điều trị của Bộ Y tế`,
      maxDailyDose: 'Không tự ý tăng liều, tuân thủ hướng dẫn của Dược sĩ lâm sàng và Bác sĩ',
      administrationRouteDetails: `${dosageForm} (${packageSpec})`,
      compatibleDiluents: ['NaCl 0.9%', 'Glucose 5%'],
      timingAndFrequency: 'Theo y lệnh bác sĩ',
      mealRelation: 'Theo hướng dẫn sử dụng đính kèm',
      clinicalMonitoring: 'Theo dõi sinh hiệu, tri giác và phản ứng quá mẫn',
      adverseReactions: ['Dị ứng, mẩn ngứa, phát ban, buồn nôn'],
      ddiWarnings: ['Kiểm tra tương tác trước khi phối hợp với thuốc khác'],
      pregnancyLactation: 'Tham khảo ý kiến bác sĩ chuyên khoa',
      storageAndHandling: `Bảo quản dưới 30°C, tránh ánh sáng. Hạn dùng: ${item.thongTinThuocCoBan?.tuoiTho || '36 tháng'}.`,
    },
  };
}
