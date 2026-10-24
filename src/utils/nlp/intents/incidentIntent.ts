/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AgentActionCard, ChatMessage, EquipmentTicket } from '../../../types/clinical';
import { anyKeyword, ProcessedQueryResult } from '../types';
import { DEVICE_CATALOG, findMatchedDevice } from '../entityCatalog';

export function matchEquipmentIntent(lower: string): boolean {
  const hasEquipmentKeyword = anyKeyword(lower, [
    'hỏng', 'báo hỏng', 'sự cố', 'báo lỗi', 'lỗi máy', 'xì khí', 'nứt bẫy', 'rách', 'chập', 'hư',
    'mất tín hiệu', 'mất nguồn', 'không nạp', 'không lên', 'hết pin', 'pin chai', 'chai pin', 'chai',
    'kẹt', 'chập chờn', 'rò điện', 'đơ', 'treo', 'kêu', 'hỏng máy', 'sửa máy', 'lỗi kẹt', 'nứt', 'trục trặc'
  ]);
  const matchedDevice = findMatchedDevice(lower);
  return (hasEquipmentKeyword && (matchedDevice !== undefined || anyKeyword(lower, ['máy', 'thiết bị', 'bơm tiêm điện', 'monitor', 'sensor', 'dây thở']))) ||
    (lower.includes('hỏng') && anyKeyword(lower, ['máy', 'thiết bị']));
}

export function handleEquipmentIntent(text: string, lower: string, nowStr: string): ProcessedQueryResult {
  const matchedDevice = findMatchedDevice(lower);
  const device = matchedDevice || DEVICE_CATALOG[0];

  let location = 'Phòng mổ 2 - Khu Phẫu thuật';
  const locMatch = text.match(/(phòng mổ\s*\d*|buồng\s*[A-Za-z0-9\-]+|khoa\s*[A-Za-z0-9\s\-]+|icu)/i);
  if (locMatch) {
    location = locMatch[0].trim();
  } else if (lower.includes('cấp cứu') || lower.includes('a9')) {
    location = 'Khoa Cấp Cứu A9 - Buồng Hồi sức 1';
  } else if (lower.includes('icu') || lower.includes('hồi sức')) {
    location = 'Khoa Hồi sức tích cực ICU';
  } else if (lower.includes('buồng 3') || lower.includes('cc3')) {
    location = 'Buồng Cấp Cứu 3';
  }

  let issue = 'Dây thở silicon nứt bẫy nước rách sensor O2, áp lực Ppeak tụt';
  if (lower.includes('pin') || lower.includes('nguồn') || lower.includes('mất nguồn') || lower.includes('chai')) {
    issue = 'Lỗi pin dự phòng chai, mất nguồn khi ngắt điện lưới 220V';
  } else if (lower.includes('dòng rò') || lower.includes('giật') || lower.includes('rò điện')) {
    issue = 'Nghi ngờ rò điện vỏ máy, không đạt chuẩn an toàn IEC 60601-1';
  } else if (lower.includes('nạp năng lượng') || lower.includes('không nạp')) {
    issue = 'Không nạp được năng lượng tụ điện, lỗi mạch nạp xả sốc tim';
  } else if (lower.includes('kẹt') || lower.includes('pít-tông') || lower.includes('pit-tong') || lower.includes('piston')) {
    issue = 'Kẹt cơ cấu pít-tông đẩy bơm tiêm, motor bước không truyền động';
  } else if (lower.includes('mất tín hiệu') || lower.includes('ecg') || lower.includes('spo2') || lower.includes('tín hiệu')) {
    issue = 'Mất tín hiệu cảm biến theo dõi, chập chờn cáp kết nối module';
  } else if (lower.includes('xì khí') || lower.includes('nứt') || lower.includes('áp lực')) {
    issue = 'Xì khí nứt bẫy nước, tụt áp lực đường thở Ppeak';
  } else if (lower.includes('báo lỗi') || lower.includes('lỗi')) {
    issue = 'Hệ thống báo mã lỗi kỹ thuật, cần kỹ sư phòng TBYT kiểm tra';
  }

  const urgency = device.risk === 'D' ? 'urgent' : 'warning';
  const code = `SC-2026-${Math.floor(100 + Math.random() * 900)}`;

  const newTicket: EquipmentTicket = {
    id: `eq-${Date.now()}`,
    code,
    deviceName: device.name,
    deviceModel: device.model,
    serialNumber: device.serial,
    riskClass: device.risk as any,
    accessoryIssue: issue,
    location,
    urgency: urgency as any,
    assignedEngineer: 'KS. Đặng Văn Nam (Phòng Vật tư - TBYT)',
    status: 'pending',
    reportTime: `${nowStr} - Báo qua AI Copilot`,
    lastInspectionDate: '15/04/2026',
    nextInspectionDue: '15/04/2027',
    inspectionUnit: 'Quatest 1',
    legalBasis: `Điều 34 Nghị định 98/2021/NĐ-CP - Quản lý thiết bị loại ${device.risk}`
  };

  const card: AgentActionCard = {
    cardType: 'incident_confirm',
    title: `Phiếu Báo Hỏng Thiết Bị Y Tế (${code})`,
    summary: `Thiết bị Loại ${device.risk} (${device.name}) gặp sự cố tại ${location}`,
    data: {
      device_name: device.name,
      device_model: device.model,
      serial_number: device.serial,
      risk_class: device.risk,
      location,
      accessory_issue: issue,
      urgency,
      ticket: newTicket
    },
    primaryActionLabel: `Gắn Cờ LOTO & Gửi Báo Hỏng (${code})`,
    primaryActionType: 'EXECUTE_INCIDENT',
    targetTab: 'equipment',
    status: 'pending'
  };

  const replyMessage: ChatMessage = {
    id: `msg-agent-${Date.now()}`,
    sender: 'agent',
    text: `Đã thiết lập dự thảo **Phiếu Báo Hỏng Sự Cố TBYT (${code})**:\n\n` +
          `• **Thiết bị:** ${device.name} (Model: *${device.model}* - SN: \`${device.serial}\`)\n` +
          `• **Mức độ rủi ro:** Phân loại **Loại ${device.risk}** theo Nghị định 98/2021/NĐ-CP (${urgency === 'urgent' ? '🔴 Ưu tiên khẩn cấp P1 can thiệp sự sống' : '🟡 Ưu tiên tiêu chuẩn'})\n` +
          `• **Vị trí:** ${location}\n` +
          `• **Hiện tượng lỗi:** ${issue}\n` +
          `• **Điều phối kỹ thuật:** Gửi cảnh báo Telegram Bot đến KS. Đặng Văn Nam (Đội TBYT trực ca).\n\n` +
          `Nhấn nút bên dưới để gắn nhãn cảnh báo đỏ **Lockout/Tagout (LOTO)** ngăn ngừa việc sử dụng nhầm trên người bệnh.`,
    timestamp: nowStr,
    legalReference: {
      lawCode: 'Nghị định 98/2021/NĐ-CP & TT 05/2022/TT-BYT',
      title: 'Quản lý Trang thiết bị y tế',
      clause: `Điều 34 & Điều 40 - Phân loại loại ${device.risk}`
    },
    card,
    suggestedChips: [
      'Kiểm định máy thở PB840',
      'Biên bản nghiệm thu an toàn TBYT',
      'Mượn khẩn 2 ống Morphin buồng CC3'
    ]
  };

  return { replyMessage };
}
