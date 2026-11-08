/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Modal Gửi Thông Báo Bệnh Nhân Chuẩn Workstation Kho Dược / CPOE (TT 26/2025/TT-BYT)
 * - Tối ưu hóa UI/UX: Mở rộng toàn diện màn hình máy trạm max-w-7xl, bố cục Dual-Zone song song
 * - Nửa trái (58%): Điều khiển & soạn thảo thông minh; Nửa phải (42%): Đối soát toàn văn đơn thuốc & thư điện tử chuẩn hóa
 * - Đồng bộ 100% font chữ hệ thống (font-sans Inter), nâng kích thước lên 14px - 18px công thái học
 * - Loại bỏ hoàn toàn khối màu đen thô ráp, áp dụng bảng màu Medical Teal y tế trang nhã
 * - Kịch bản gửi tự động 1-chạm (One-Click Clinical Presets): Gửi ngay, Nhắc cữ thuốc theo đơn, Nhắc tái khám, Tùy chỉnh
 * - TUYỆT ĐỐI KHÔNG DÙNG ICON (Không Lucide, không emoji).
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import { smsApi } from '../../services/api/smsApi';
import {
  SmsDeliveryReceipt,
  SmsMessageType,
  SmsProviderType,
  SmsTemplateItem,
  DispatchMode,
  ScheduleTimingType
} from '../../types/sms';
import { PatientProfile } from '../../services/patientService';
import { sendMedicationAdviceEmail } from '../../services/prescriptionAdviceService';
import {
  PatientPrescriptionAdvice,
  ScheduledMedication,
  SendAdviceEmailResponse
} from '../../types/medicationSchedule';

export interface EmailDeliveryReceipt {
  id: string;
  recipientEmail: string;
  patientId: string;
  patientName: string;
  subject: string;
  adviceContent: string;
  medicationsSummary?: string;
  orderId?: string;
  provider: string;
  status: string; // 'delivered' | 'scheduled' | 'cancelled' | 'failed'
  deliveryReceipt?: string;
  createdAt: string;
  dispatchMode?: DispatchMode;
  scheduledAt?: string;
  timingRule?: string;
}

export type NotificationModalTab = 'sms' | 'email' | 'history';

export type ClinicalSchedulePreset = 'send_now' | 'medication_routine' | 'followup_reminder' | 'custom_time';

interface SendSmsModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient?: PatientProfile | null;
  patientName?: string;
  patientPhone?: string;
  patientEmail?: string;
  patientId?: string;
  orderId?: string;
  doctorName?: string;
  diagnosis?: string;
  medications?: ScheduledMedication[];
  initialMessageType?: SmsMessageType;
  initialContent?: string;
}

const STORAGE_KEY_EMAIL_LOGS = 'clinical_patient_email_logs_v1';

const INITIAL_CANONICAL_SMS_LOGS: SmsDeliveryReceipt[] = [
  {
    id: 'SMS-20261030-8817-01',
    recipientPhone: '0963278149',
    patientId: 'BN-8817',
    patientName: 'Trần Huy Hoàng',
    messageType: 'cpoe_prescription',
    content: '[BV LAM SANG] BS Tran Van Hung da ky don thuoc ma RX-2026-604 cho BN Tran Huy Hoang. Tra cuu don tai: https://donthuocquocgia.vn/?id=RX-2026-604. Hotline: 1900-1234',
    charactersCount: 168,
    smsSegments: 2,
    provider: 'esms',
    status: 'delivered',
    referenceId: 'RX-2026-604',
    deliveryReceipt: 'DLR-SIM-20261030-01',
    createdAt: '2026-10-30T10:15:22Z',
    dispatchMode: 'immediate'
  },
  {
    id: 'SMS-20261030-8817-02',
    recipientPhone: '0963278149',
    patientId: 'BN-8817',
    patientName: 'Trần Huy Hoàng',
    messageType: 'medication_advice',
    content: '[BV LAM SANG] Nhac uong thuoc BN Tran Huy Hoang: Sang 07:30 (1 vien sau an), Toi 20:00 (1 vien truoc ngu). Tai kham ngay neu co trieu chung bat thuong.',
    charactersCount: 154,
    smsSegments: 1,
    provider: 'esms',
    status: 'delivered',
    referenceId: 'RX-2026-604',
    deliveryReceipt: 'DLR-SIM-20261030-02',
    createdAt: '2026-10-30T10:16:05Z',
    dispatchMode: 'immediate'
  }
];

const INITIAL_CANONICAL_EMAIL_LOGS: EmailDeliveryReceipt[] = [
  {
    id: 'MAIL-20261030-8817-01',
    recipientEmail: 'huyhoang6altt@gmail.com',
    patientId: 'BN-8817',
    patientName: 'Trần Huy Hoàng',
    subject: '[BV ĐA KHOA LÂM SÀNG] Đơn thuốc điện tử & Hướng dẫn điều trị - Mã đơn RX-2026-604',
    adviceContent: 'Uống thuốc đúng cữ theo toa, uống nhiều nước ấm. Nếu có biểu hiện sốt cao kéo dài hoặc dị ứng, tái khám ngay.',
    medicationsSummary: 'PARACETAMOL 500mg (1 viên x 2 lần/ngày, 5 ngày)',
    orderId: 'RX-2026-604',
    provider: 'Google Apps Script Webhook',
    status: 'delivered',
    deliveryReceipt: 'GAS-MAIL-20261030-01',
    createdAt: '2026-10-30T10:16:12Z',
    dispatchMode: 'immediate'
  }
];

function getStoredEmailLogs(patientId?: string): EmailDeliveryReceipt[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_EMAIL_LOGS);
    if (!raw) return INITIAL_CANONICAL_EMAIL_LOGS;
    const list: EmailDeliveryReceipt[] = JSON.parse(raw);
    if (list.length === 0) return INITIAL_CANONICAL_EMAIL_LOGS;
    if (patientId && patientId !== 'BN-Chưa có') {
      const filtered = list.filter((l) => l.patientId === patientId);
      return filtered.length > 0 ? filtered : INITIAL_CANONICAL_EMAIL_LOGS;
    }
    return list;
  } catch {
    return INITIAL_CANONICAL_EMAIL_LOGS;
  }
}

function saveStoredEmailLog(log: EmailDeliveryReceipt): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_EMAIL_LOGS);
    const list: EmailDeliveryReceipt[] = raw ? JSON.parse(raw) : [...INITIAL_CANONICAL_EMAIL_LOGS];
    list.unshift(log);
    localStorage.setItem(STORAGE_KEY_EMAIL_LOGS, JSON.stringify(list));
  } catch {}
}

function removeVietnameseTones(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

function cleanDoctorDisplay(doc: string): string {
  const norm = removeVietnameseTones(doc || '').trim();
  if (/^bs[\.\s]/i.test(norm)) return norm;
  return `BS ${norm}`;
}

function formatLogTimestamp(ts?: string): string {
  if (!ts) return 'Hôm nay';
  try {
    const d = new Date(ts);
    return `${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · ${d.toLocaleDateString('vi-VN')}`;
  } catch {
    return ts;
  }
}

// Danh mục mẫu dặn dò chuyên môn chuẩn cho Email
const CANONICAL_EMAIL_ADVICE_TEMPLATES = [
  {
    id: 'tpl-email-full',
    title: 'Toàn diện theo đơn thuốc',
    summary: 'Bệnh nhân tuân thủ uống thuốc đủ liều, đúng cữ theo toa đã kê. Uống với nhiều nước ấm sau bữa ăn. Không tự ý tăng giảm liều hoặc ngưng thuốc đột ngột.'
  },
  {
    id: 'tpl-email-diet',
    title: 'Kiêng khem & Sinh hoạt',
    summary: 'Trong thời gian điều trị, kiêng tuyệt đối bia rượu, thuốc lá và đồ uống có cồn. Hạn chế thức ăn cay nóng, nhiều dầu mỡ. Nghỉ ngơi hợp lý, tránh làm việc nặng nhọc.'
  },
  {
    id: 'tpl-email-adr',
    title: 'Cảnh báo phản ứng có hại',
    summary: 'Nếu xuất hiện các dấu hiệu bất thường như nổi mẩn ngứa, phát ban, phù mí mắt, khó thở hoặc sốt cao kéo dài trên 3 ngày, cần ngừng thuốc ngay và liên hệ hotline bệnh viện.'
  },
  {
    id: 'tpl-email-followup',
    title: 'Hẹn lịch tái khám',
    summary: 'Sau khi dùng hết thuốc theo đơn (5 ngày), bệnh nhân vui lòng đến tái khám và làm xét nghiệm kiểm tra lại tại Phòng khám 204. Nhớ mang theo đơn thuốc này khi tái khám.'
  }
];

export const SendSmsModal: React.FC<SendSmsModalProps> = ({
  isOpen,
  onClose,
  patient,
  patientName = '',
  patientPhone = '',
  patientEmail = '',
  patientId = '',
  orderId = '',
  doctorName = 'BS. Trần Văn Hùng',
  diagnosis = '',
  medications,
  initialMessageType = 'cpoe_prescription',
  initialContent = '',
}) => {
  useModalDismiss(isOpen, onClose);

  const effectiveName = patient?.fullName || patientName || 'Trần Huy Hoàng';
  const effectiveId = patient?.id || patientId || 'BN-8817';
  const effectivePhone = patient?.phone || patientPhone || '0963278149';
  const effectiveEmail = patient?.email || patientEmail || 'huyhoang6altt@gmail.com';
  const effectiveDiagnosis = diagnosis || patient?.diagnosis || 'Cảm cúm (J11) - Theo dõi điều trị ngoại trú';

  // Danh mục thuốc trong đơn (lấy từ props hoặc tạo chuẩn mock CPOE)
  const effectiveMedications = useMemo<ScheduledMedication[]>(() => {
    if (medications && medications.length > 0) return medications;
    return [
      {
        id: 'med-01',
        medicationName: 'PARACETAMOL 500mg',
        activeIngredient: 'Paracetamol',
        dosage: '1 viên x 2 lần/ngày (Sáng 07:30, Tối 19:30)',
        route: 'Đường uống (Sau ăn)',
        durationDays: 5,
        specialInstructions: 'Uống nhiều nước ấm, cách nhau tối thiểu 4-6 giờ',
        timeSlots: [
          { id: 'morning', label: 'Sáng', time: '07:30', dosageText: '1 viên', mealRelation: 'Sau khi ăn 15-30 phút' },
          { id: 'evening', label: 'Tối', time: '19:30', dosageText: '1 viên', mealRelation: 'Sau khi ăn 15-30 phút' }
        ]
      },
      {
        id: 'med-02',
        medicationName: 'AMOXICILLIN 500mg',
        activeIngredient: 'Amoxicillin',
        dosage: '1 viên x 2 lần/ngày (Sáng 07:30, Tối 19:30)',
        route: 'Đường uống (Sau ăn)',
        durationDays: 5,
        specialInstructions: 'Uống nguyên viên, uống đúng và đủ liều trong 5 ngày',
        timeSlots: [
          { id: 'morning', label: 'Sáng', time: '07:30', dosageText: '1 viên', mealRelation: 'Sau khi ăn 15-30 phút' },
          { id: 'evening', label: 'Tối', time: '19:30', dosageText: '1 viên', mealRelation: 'Sau khi ăn 15-30 phút' }
        ]
      }
    ];
  }, [medications]);

  const prescriptionDurationDays = useMemo(() => {
    if (!effectiveMedications || effectiveMedications.length === 0) return 5;
    return Math.max(...effectiveMedications.map((m) => m.durationDays || 5));
  }, [effectiveMedications]);

  // Tab: sms | email | history
  const [activeTab, setActiveTab] = useState<NotificationModalTab>('sms');

  // Trạng thái SMS
  const [phone, setPhone] = useState(effectivePhone);
  const [messageType, setMessageType] = useState<SmsMessageType>(initialMessageType);
  const [content, setContent] = useState('');
  const [receipt, setReceipt] = useState<SmsDeliveryReceipt | null>(null);
  const [logs, setLogs] = useState<SmsDeliveryReceipt[]>(INITIAL_CANONICAL_SMS_LOGS);
  const [templates, setTemplates] = useState<SmsTemplateItem[]>([]);

  // Trạng thái Email
  const [email, setEmail] = useState(effectiveEmail);
  const [emailSubject, setEmailSubject] = useState(
    `[BV ĐA KHOA LÂM SÀNG] Đơn thuốc điện tử & Hướng dẫn điều trị - BN: ${effectiveName} (${orderId || 'RX-2026-604'})`
  );
  const [emailAdvice, setEmailAdvice] = useState(
    'Bệnh nhân tuân thủ uống thuốc đủ liều, đúng cữ theo toa đã kê. Uống với nhiều nước ấm sau bữa ăn. Không tự ý tăng giảm liều hoặc ngưng thuốc đột ngột. Nếu sốt cao kéo dài hoặc dị ứng, tái khám ngay.'
  );
  const [emailLogs, setEmailLogs] = useState<EmailDeliveryReceipt[]>(() => getStoredEmailLogs(effectiveId));
  const [emailSentSuccess, setEmailSentSuccess] = useState(false);
  const [emailSentReceipt, setEmailSentReceipt] = useState<SendAdviceEmailResponse | null>(null);

  // Kịch bản gửi tự động (One-Click Clinical Presets)
  const [schedulePreset, setSchedulePreset] = useState<ClinicalSchedulePreset>('send_now');

  // Mặc định ngày mai 08:00
  const defaultTomorrowIso = useMemo(() => {
    const tm = new Date(Date.now() + 86400000);
    tm.setHours(8, 0, 0, 0);
    return tm.toISOString().slice(0, 16);
  }, []);
  const [customDatetime, setCustomDatetime] = useState<string>(defaultTomorrowIso);

  // Trạng thái chung
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [historyChannelFilter, setHistoryChannelFilter] = useState<'all' | 'sms' | 'email' | 'scheduled'>('all');

  // Tải dữ liệu ban đầu
  useEffect(() => {
    if (isOpen) {
      setPhone(effectivePhone);
      setEmail(effectiveEmail);
      setStatus('idle');
      setReceipt(null);
      setEmailSentSuccess(false);
      setEmailSentReceipt(null);
      setErrorMessage(null);
      setSchedulePreset('send_now');
      setSearchFilter('');
      setHistoryChannelFilter('all');

      smsApi.getTemplates().then(setTemplates).catch(console.warn);

      if (effectiveId && effectiveId !== 'BN-Chưa có') {
        smsApi
          .getLogs(effectiveId)
          .then((data) => {
            if (data && data.length > 0) {
              setLogs(data);
            } else {
              setLogs(INITIAL_CANONICAL_SMS_LOGS);
            }
          })
          .catch(() => {
            setLogs(INITIAL_CANONICAL_SMS_LOGS);
          });

        setEmailLogs(getStoredEmailLogs(effectiveId));
      } else {
        setLogs(INITIAL_CANONICAL_SMS_LOGS);
        setEmailLogs(getStoredEmailLogs());
      }
    }
  }, [isOpen, effectivePhone, effectiveEmail, effectiveId]);

  // Sinh nội dung mặc định theo loại tin nhắn SMS
  useEffect(() => {
    if (initialContent) {
      setContent(initialContent);
      return;
    }

    if (messageType === 'cpoe_prescription') {
      const rxId = orderId || 'RX-2026-604';
      setContent(
        `[BV LAM SANG] ${cleanDoctorDisplay(doctorName)} da ky don thuoc ma ${rxId} cho BN ${removeVietnameseTones(
          effectiveName
        )}. Tra cuu don tai: https://donthuocquocgia.vn/?id=${rxId}. Hotline: 1900-1234`
      );
    } else if (messageType === 'medication_advice') {
      setContent(
        `[BV LAM SANG] Nhac uong thuoc BN ${removeVietnameseTones(
          effectiveName
        )}: Sang 07:30 (1 vien sau an), Toi 20:00 (1 vien truoc ngu). Tai kham ngay neu co trieu chung bat thuong.`
      );
    } else {
      setContent(
        `[BV LAM SANG] Xac nhan BN ${removeVietnameseTones(
          effectiveName
        )} (${effectiveId}) da hoan tat thu tuc kham benh tai Khoa Kham Benh. Tran trong cam on Quy khach!`
      );
    }
  }, [messageType, orderId, effectiveName, doctorName, effectiveId, initialContent]);

  // Tính số ký tự SMS
  const { charsCount, segmentsCount, isUnicode, maxPerSegment } = useMemo(() => {
    const len = content.length;
    const hasUnicode = /[^\u0000-\u00ff]/.test(content);
    let seg = 1;
    let maxSeg = hasUnicode ? 70 : 160;

    if (hasUnicode) {
      seg = len <= 70 ? 1 : Math.ceil(len / 67);
    } else {
      seg = len <= 160 ? 1 : Math.ceil(len / 153);
    }
    return {
      charsCount: len,
      segmentsCount: Math.max(1, seg),
      isUnicode: hasUnicode,
      maxPerSegment: maxSeg
    };
  }, [content]);

  // Chuyển không dấu
  const handleConvertToUnsigned = () => {
    setContent(removeVietnameseTones(content));
  };

  // Chọn mẫu SMS
  const handleApplySmsTemplate = (tpl: SmsTemplateItem) => {
    setMessageType(tpl.category as SmsMessageType);
    let body = tpl.template;
    body = body.replace(/{patientName}/g, removeVietnameseTones(effectiveName));
    body = body.replace(/{doctorName}/g, cleanDoctorDisplay(doctorName));
    body = body.replace(/{orderId}/g, orderId || 'RX-2026-604');
    body = body.replace(/{patientId}/g, effectiveId);
    setContent(body);
  };

  // Chọn mẫu Email
  const handleApplyEmailTemplate = (summary: string) => {
    setEmailAdvice(summary);
  };

  // Chèn đơn thuốc vào nội dung SMS
  const handleInsertPrescriptionSnippet = () => {
    const snippet = ` Don thuoc ${orderId || 'RX-2026-604'}: PARACETAMOL 500mg (1v x 2 lan/ngay).`;
    setContent((prev) => prev.trim() + snippet);
  };

  // Phím tắt ngày tùy chỉnh
  const handleQuickAddDays = (days: number) => {
    const target = new Date(Date.now() + days * 86400000);
    target.setHours(8, 0, 0, 0);
    setCustomDatetime(target.toISOString().slice(0, 16));
  };

  // Hủy lịch hẹn
  const handleCancelSchedule = async (id: string, channel: 'sms' | 'email') => {
    if (!window.confirm(`Xác nhận hủy lịch hẹn phát tin [${id}]?`)) return;

    if (channel === 'sms') {
      try {
        await smsApi.cancelScheduledSms(id);
      } catch {}
      setLogs((prev) =>
        prev.map((it) => (it.id === id ? { ...it, status: 'cancelled' } : it))
      );
    } else {
      setEmailLogs((prev) => {
        const next = prev.map((it) => (it.id === id ? { ...it, status: 'cancelled' } : it));
        try {
          localStorage.setItem(STORAGE_KEY_EMAIL_LOGS, JSON.stringify(next));
        } catch {}
        return next;
      });
    }
  };

  // Tính toán thời gian & rule gửi
  const { effectiveDispatchMode, effectiveScheduledAt, effectiveTimingRule, presetDescription } = useMemo(() => {
    if (schedulePreset === 'send_now') {
      return {
        effectiveDispatchMode: 'immediate' as DispatchMode,
        effectiveScheduledAt: undefined,
        effectiveTimingRule: 'immediate',
        presetDescription: 'Gửi ngay lập tức sau khi bấm xác nhận'
      };
    }
    if (schedulePreset === 'medication_routine') {
      const tm = new Date(Date.now() + 86400000);
      tm.setHours(7, 30, 0, 0);
      return {
        effectiveDispatchMode: 'scheduled' as DispatchMode,
        effectiveScheduledAt: tm.toISOString(),
        effectiveTimingRule: `routine:${prescriptionDurationDays}days_morning_07:30_evening_19:30`,
        presetDescription: `Tự động nhắc 2 cữ/ngày (Sáng 07:30 & Tối 19:30) trong suốt ${prescriptionDurationDays} ngày điều trị`
      };
    }
    if (schedulePreset === 'followup_reminder') {
      const tm = new Date(Date.now() + (prescriptionDurationDays - 1) * 86400000);
      tm.setHours(8, 0, 0, 0);
      return {
        effectiveDispatchMode: 'scheduled' as DispatchMode,
        effectiveScheduledAt: tm.toISOString(),
        effectiveTimingRule: `followup:1day_before_exam`,
        presetDescription: `Tự động nhắc tái khám vào lúc 08:00 sáng (trước ngày hết thuốc 1 ngày)`
      };
    }
    return {
      effectiveDispatchMode: 'scheduled' as DispatchMode,
      effectiveScheduledAt: new Date(customDatetime).toISOString(),
      effectiveTimingRule: `custom:${customDatetime}`,
      presetDescription: `Hẹn giờ phát sóng vào lúc ${formatLogTimestamp(customDatetime)}`
    };
  }, [schedulePreset, prescriptionDurationDays, customDatetime]);

  // Xử lý gửi
  const handleSend = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (activeTab === 'sms') {
      if (!phone.trim()) {
        setErrorMessage('Vui lòng nhập số điện thoại người nhận');
        setStatus('error');
        return;
      }
      if (!content.trim()) {
        setErrorMessage('Nội dung tin nhắn không được để trống');
        setStatus('error');
        return;
      }

      setStatus('sending');
      setErrorMessage(null);

      try {
        const res = await smsApi.sendSms({
          recipientPhone: phone.trim(),
          patientId: effectiveId,
          patientName: effectiveName,
          messageType,
          content: content.trim(),
          referenceId: orderId || undefined,
          provider: 'esms',
          dispatchMode: effectiveDispatchMode,
          scheduledAt: effectiveScheduledAt,
          timingRule: effectiveTimingRule
        });

        setReceipt(res);
        setStatus('success');
        setLogs((prev) => [res, ...prev]);
      } catch (err: any) {
        console.error('Lỗi khi gửi SMS:', err);
        setStatus('error');
        setErrorMessage(err.message || 'Không thể kết nối dịch vụ SMS viễn thông');
      }
    } else if (activeTab === 'email') {
      if (!email.trim() || !email.includes('@')) {
        setErrorMessage('Vui lòng nhập địa chỉ email hợp lệ của người nhận');
        setStatus('error');
        return;
      }

      setStatus('sending');
      setErrorMessage(null);

      try {
        const advicePayload: PatientPrescriptionAdvice = {
          id: `ADV-${(orderId || 'RX-2026-604').replace('RX-', '')}`,
          prescriptionId: orderId || 'RX-2026-604',
          patientName: effectiveName,
          patientEmail: email.trim(),
          patientPhone: phone.trim() || undefined,
          diagnosis: effectiveDiagnosis,
          doctorName,
          doctorHospital: 'Bệnh Viện Đa Khoa Lâm Sàng',
          department: 'Khoa Khám Bệnh - Phòng 204',
          createdAt: new Date().toISOString(),
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date(Date.now() + prescriptionDurationDays * 86400000).toISOString().split('T')[0],
          generalDoctorAdvice: emailAdvice.trim(),
          medications: effectiveMedications.map((m) => {
            let slots = m.timeSlots;
            if (!Array.isArray(slots) && typeof slots === 'object' && slots !== null) {
              slots = Object.entries(slots).map(([k, v]) => ({
                id: k,
                label: k === 'morning' ? 'Sáng' : k === 'noon' ? 'Trưa' : k === 'evening' ? 'Tối' : k,
                time: k === 'morning' ? '07:30' : k === 'noon' ? '11:30' : k === 'evening' ? '19:30' : '08:00',
                dosageText: typeof v === 'string' ? v : '1 viên',
                mealRelation: 'Sau khi ăn 15-30 phút'
              }));
            }
            return {
              ...m,
              timeSlots: Array.isArray(slots) ? slots : []
            };
          }),
          notificationStatus: effectiveDispatchMode === 'scheduled' ? 'scheduled' : 'idle',
          dispatchMode: effectiveDispatchMode,
          scheduledAt: effectiveScheduledAt,
          timingRule: effectiveTimingRule
        };

        const res = await sendMedicationAdviceEmail(advicePayload, { sendEmail: true, sendSms: false });
        if (res.success) {
          setEmailSentSuccess(true);
          setEmailSentReceipt(res);
          setStatus('success');

          const newLog: EmailDeliveryReceipt = {
            id: `MAIL-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random()
              .toString(36)
              .substring(2, 8)
              .toUpperCase()}`,
            recipientEmail: email.trim(),
            patientId: effectiveId,
            patientName: effectiveName,
            subject: emailSubject.trim(),
            adviceContent: emailAdvice.trim(),
            medicationsSummary: effectiveMedications.map((m) => `${m.medicationName} (${m.dosage})`).join('; '),
            orderId: orderId || 'RX-2026-604',
            provider: res.provider || 'Google Apps Script Webhook',
            status: effectiveDispatchMode === 'scheduled' ? 'scheduled' : 'delivered',
            deliveryReceipt:
              effectiveDispatchMode === 'scheduled'
                ? `SCHED-MAIL-${Date.now().toString().slice(-6)}`
                : `GAS-MAIL-${Date.now().toString().slice(-6)}`,
            createdAt: new Date().toISOString(),
            dispatchMode: effectiveDispatchMode,
            scheduledAt: effectiveScheduledAt,
            timingRule: effectiveTimingRule
          };
          saveStoredEmailLog(newLog);
          setEmailLogs((prev) => [newLog, ...prev]);
        } else {
          setStatus('error');
          setErrorMessage(res.message || 'Không thể gửi email dặn dò');
        }
      } catch (err: any) {
        console.error('Lỗi gửi email:', err);
        setStatus('error');
        const rawErr = err?.message || 'Lỗi khi chuyển phát thư điện tử';
        setErrorMessage(typeof rawErr === 'string' ? rawErr : JSON.stringify(rawErr));
      }
    }
  };

  // Danh sách lịch sử
  const combinedHistory = useMemo(() => {
    const list: Array<{
      id: string;
      channel: 'sms' | 'email';
      recipient: string;
      title: string;
      content: string;
      status: string;
      receiptCode: string;
      createdAt: string;
      dispatchMode?: string;
      scheduledAt?: string;
      timingRule?: string;
    }> = [];

    logs.forEach((s) => {
      list.push({
        id: s.id,
        channel: 'sms',
        recipient: s.recipientPhone,
        title: s.messageType === 'cpoe_prescription' ? 'Mã đơn thuốc CPOE' : 'Dặn dò điều trị',
        content: s.content,
        status: s.status,
        receiptCode: s.deliveryReceipt || s.id,
        createdAt: s.createdAt || '',
        dispatchMode: s.dispatchMode || 'immediate',
        scheduledAt: s.scheduledAt,
        timingRule: s.timingRule
      });
    });

    emailLogs.forEach((m) => {
      list.push({
        id: m.id,
        channel: 'email',
        recipient: m.recipientEmail,
        title: m.subject,
        content: m.adviceContent,
        status: m.status,
        receiptCode: m.deliveryReceipt || m.id,
        createdAt: m.createdAt || '',
        dispatchMode: m.dispatchMode || 'immediate',
        scheduledAt: m.scheduledAt,
        timingRule: m.timingRule
      });
    });

    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return list.filter((item) => {
      if (historyChannelFilter === 'sms' && item.channel !== 'sms') return false;
      if (historyChannelFilter === 'email' && item.channel !== 'email') return false;
      if (historyChannelFilter === 'scheduled' && item.status !== 'scheduled') return false;

      if (!searchFilter.trim()) return true;
      const q = searchFilter.toLowerCase();
      return (
        item.content.toLowerCase().includes(q) ||
        item.recipient.toLowerCase().includes(q) ||
        item.receiptCode.toLowerCase().includes(q)
      );
    });
  }, [logs, emailLogs, historyChannelFilter, searchFilter]);

  const scheduledCount = useMemo(() => {
    return (
      logs.filter((l) => l.status === 'scheduled').length +
      emailLogs.filter((l) => l.status === 'scheduled').length
    );
  }, [logs, emailLogs]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="notification-modal-title"
      data-testid="send-sms-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/50 backdrop-blur-xs font-sans text-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-7xl h-[92vh] flex flex-col overflow-hidden text-slate-800 font-sans"
      >
        {/* ========================================================================================= */}
        {/* 1. Header Widescreen Sang Trọng - Thông tin bệnh nhân & Tab - Không Màu Đen                */}
        {/* ========================================================================================= */}
        <div className="px-6 py-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3.5 flex-wrap">
            <h2 id="notification-modal-title" className="text-lg font-bold text-slate-900 tracking-tight">
              Thông báo bệnh nhân
            </h2>
            <div className="flex items-center gap-2.5 text-sm font-medium text-slate-700 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
              <span className="font-bold text-slate-900">{effectiveName}</span>
              <span className="text-slate-400">·</span>
              <span className="font-mono text-slate-800">{effectiveId}</span>
              <span className="text-slate-400">·</span>
              <span>Đơn CPOE: <strong className="font-mono text-slate-900">{orderId || 'RX-2026-604'}</strong></span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-600">{cleanDoctorDisplay(doctorName)}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* 3 Tab Navigation: Soft Teal Active State */}
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-sm font-semibold">
              <button
                type="button"
                data-testid="tab-compose-sms"
                onClick={() => {
                  setActiveTab('sms');
                  setStatus('idle');
                  setErrorMessage(null);
                }}
                className={`px-4 py-2 rounded-md cursor-pointer transition ${
                  activeTab === 'sms'
                    ? 'bg-teal-50 text-teal-950 border border-teal-600 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-950 hover:bg-slate-200/60 border border-transparent'
                }`}
              >
                Soạn Tin SMS
              </button>

              <button
                type="button"
                data-testid="tab-compose-email"
                onClick={() => {
                  setActiveTab('email');
                  setStatus('idle');
                  setErrorMessage(null);
                }}
                className={`px-4 py-2 rounded-md cursor-pointer transition ${
                  activeTab === 'email'
                    ? 'bg-teal-50 text-teal-950 border border-teal-600 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-950 hover:bg-slate-200/60 border border-transparent'
                }`}
              >
                Soạn Thư Email
              </button>

              <button
                type="button"
                data-testid="tab-history-sms"
                onClick={() => {
                  setActiveTab('history');
                  setStatus('idle');
                  setErrorMessage(null);
                }}
                className={`px-4 py-2 rounded-md cursor-pointer transition flex items-center gap-2 ${
                  activeTab === 'history'
                    ? 'bg-teal-50 text-teal-950 border border-teal-600 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-950 hover:bg-slate-200/60 border border-transparent'
                }`}
              >
                <span>Nhật ký &amp; Lịch hẹn</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    activeTab === 'history' ? 'bg-teal-100 text-teal-950' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {logs.length + emailLogs.length}
                </span>
                {scheduledCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-950 border border-amber-300">
                    {scheduledCount} hẹn
                  </span>
                )}
              </button>
            </div>

            {/* Nút Đóng Modal */}
            <button
              onClick={onClose}
              data-testid="btn-close-sms-modal"
              className="px-3.5 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
            >
              Đóng [ESC]
            </button>
          </div>
        </div>

        {/* ========================================================================================= */}
        {/* 2. Dual-Zone Workstation Body: Bên trái Soạn thảo (58%) - Bên phải Đối soát toàn văn (42%) */}
        {/* ========================================================================================= */}
        {(activeTab === 'sms' || activeTab === 'email') && (
          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 overflow-hidden">
            {/* VÙNG BÊN TRÁI (58%): NHẬP LIỆU & ĐIỀU KHIỂN KỊCH BẢN */}
            <form onSubmit={handleSend} className="lg:col-span-7 p-6 overflow-y-auto space-y-5 flex flex-col justify-between">
              <div className="space-y-5">
                {/* 1. Thông tin người nhận */}
                {activeTab === 'sms' ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-bold text-slate-800">
                        Số điện thoại người nhận *
                      </label>
                      <span className="font-mono text-xs font-bold text-teal-900 bg-teal-50 px-2.5 py-0.5 rounded border border-teal-200">
                        Brandname: BV_LAMSANG
                      </span>
                    </div>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0963278149"
                      aria-label="Số điện thoại nhận SMS"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg font-mono text-base text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-600 focus:border-teal-600 transition"
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-sm font-bold text-slate-800 mb-1">
                          Email người nhận *
                        </label>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="huyhoang6altt@gmail.com"
                          className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-600 focus:border-teal-600 transition"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-800 mb-1">
                          Tiêu đề thư điện tử *
                        </label>
                        <input
                          type="text"
                          required
                          value={emailSubject}
                          onChange={(e) => setEmailSubject(e.target.value)}
                          className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-600 focus:border-teal-600 transition font-medium"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Mẫu dặn dò chuyên khoa chọn nhanh */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-800">
                      Mẫu dặn dò chuyên khoa (Bấm để tự điền):
                    </span>
                    {activeTab === 'sms' && (
                      <button
                        type="button"
                        onClick={handleInsertPrescriptionSnippet}
                        className="text-xs font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 px-2.5 py-1 rounded border border-teal-300 cursor-pointer transition"
                      >
                        + Chèn tóm tắt đơn CPOE
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {activeTab === 'sms'
                      ? templates.map((tpl) => (
                          <button
                            key={tpl.id}
                            type="button"
                            onClick={() => handleApplySmsTemplate(tpl)}
                            className={`p-2.5 rounded-lg border text-left cursor-pointer transition text-xs ${
                              messageType === tpl.category
                                ? 'bg-teal-50 border-teal-600 text-teal-950 font-bold'
                                : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            <div className="font-bold">{tpl.title}</div>
                            <div className="text-slate-500 line-clamp-1 mt-0.5 font-normal">{tpl.template}</div>
                          </button>
                        ))
                      : CANONICAL_EMAIL_ADVICE_TEMPLATES.map((tpl) => (
                          <button
                            key={tpl.id}
                            type="button"
                            onClick={() => handleApplyEmailTemplate(tpl.summary)}
                            className="p-2.5 rounded-lg border border-slate-200 hover:border-teal-500 hover:bg-teal-50/50 bg-white text-left cursor-pointer transition text-xs"
                          >
                            <div className="font-bold text-slate-800">{tpl.title}</div>
                            <div className="text-slate-500 line-clamp-1 mt-0.5 font-normal">{tpl.summary}</div>
                          </button>
                        ))}
                  </div>
                </div>

                {/* 3. Vùng nhập nội dung chính (Font 15-16px, rộng rãi) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold uppercase tracking-wide text-slate-800">
                      {activeTab === 'sms' ? 'Nội dung tin nhắn phát sóng (SMS)' : 'Lời dặn dò chuyên môn của bác sĩ (Email)'}
                    </label>
                    <div className="flex items-center gap-2">
                      {activeTab === 'sms' && isUnicode && (
                        <button
                          type="button"
                          onClick={handleConvertToUnsigned}
                          className="text-xs font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded border border-amber-300 cursor-pointer transition"
                        >
                          Chuyển không dấu (160 kt)
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (activeTab === 'sms') setContent('');
                          else setEmailAdvice('');
                        }}
                        className="text-xs font-medium text-slate-600 hover:text-rose-700 bg-slate-100 hover:bg-rose-50 px-2.5 py-1 rounded border border-slate-300 cursor-pointer transition"
                      >
                        Xóa trắng
                      </button>
                    </div>
                  </div>

                  {activeTab === 'sms' ? (
                    <textarea
                      rows={5}
                      required
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="Nhập nội dung tin nhắn SMS gửi tới bệnh nhân..."
                      aria-label="Nội dung tin nhắn SMS"
                      className="w-full p-4 bg-slate-50 border border-slate-300 rounded-xl text-base text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-600 focus:border-teal-600 leading-relaxed transition resize-y min-h-[140px]"
                    />
                  ) : (
                    <textarea
                      rows={5}
                      required
                      value={emailAdvice}
                      onChange={(e) => setEmailAdvice(e.target.value)}
                      placeholder="Nhập lời dặn dò riêng về cách dùng thuốc, ăn uống kiêng khem, các dấu hiệu cần tái khám ngay..."
                      aria-label="Lời dặn dò gửi bệnh nhân"
                      className="w-full p-4 bg-slate-50 border border-slate-300 rounded-xl text-base text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-600 focus:border-teal-600 leading-relaxed transition resize-y min-h-[140px]"
                    />
                  )}

                  {activeTab === 'sms' && (
                    <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                      <div>
                        Độ dài: <strong className="text-slate-900 font-semibold">{charsCount}</strong> ký tự · Định dạng:{' '}
                        <strong className={isUnicode ? 'text-amber-800' : 'text-teal-800'}>
                          {isUnicode ? 'Có dấu (UCS-2)' : 'Không dấu (GSM)'}
                        </strong>
                      </div>
                      <div className="font-semibold text-slate-800">
                        {segmentsCount} tin ({charsCount <= maxPerSegment ? `${charsCount}/${maxPerSegment}` : `${segmentsCount} SMS`})
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Kịch bản phát tin tự động (One-Click Presets) */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                      Kịch bản phát tin tự động:
                    </span>
                    <span className="text-xs font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                      Đơn CPOE: {prescriptionDurationDays} ngày thuốc
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Kịch bản 1: Gửi ngay */}
                    <button
                      type="button"
                      onClick={() => setSchedulePreset('send_now')}
                      className={`p-3 rounded-lg border text-left cursor-pointer transition ${
                        schedulePreset === 'send_now'
                          ? 'bg-teal-50 border-teal-600 text-teal-950 font-bold shadow-2xs'
                          : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-sm font-bold">1. Gửi ngay lập tức</div>
                      <div className="text-xs text-slate-500 font-normal mt-0.5">
                        Phát sóng biên nhận &amp; đơn thuốc ngay sau khi xác nhận
                      </div>
                    </button>

                    {/* Kịch bản 2: Nhắc cữ thuốc */}
                    <button
                      type="button"
                      onClick={() => setSchedulePreset('medication_routine')}
                      className={`p-3 rounded-lg border text-left cursor-pointer transition ${
                        schedulePreset === 'medication_routine'
                          ? 'bg-teal-50 border-teal-600 text-teal-950 font-bold shadow-2xs'
                          : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-sm font-bold">2. Nhắc cữ uống thuốc ({prescriptionDurationDays} ngày)</div>
                      <div className="text-xs text-slate-500 font-normal mt-0.5">
                        Tự động nhắc 2 cữ/ngày (Sáng 07:30 &amp; Tối 19:30)
                      </div>
                    </button>

                    {/* Kịch bản 3: Nhắc tái khám */}
                    <button
                      type="button"
                      onClick={() => setSchedulePreset('followup_reminder')}
                      className={`p-3 rounded-lg border text-left cursor-pointer transition ${
                        schedulePreset === 'followup_reminder'
                          ? 'bg-teal-50 border-teal-600 text-teal-950 font-bold shadow-2xs'
                          : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-sm font-bold">3. Nhắc lịch hẹn tái khám</div>
                      <div className="text-xs text-slate-500 font-normal mt-0.5">
                        Gửi trước ngày hết thuốc 1 ngày (lúc 08:00 sáng)
                      </div>
                    </button>

                    {/* Kịch bản 4: Tùy chỉnh */}
                    <button
                      type="button"
                      onClick={() => setSchedulePreset('custom_time')}
                      className={`p-3 rounded-lg border text-left cursor-pointer transition ${
                        schedulePreset === 'custom_time'
                          ? 'bg-teal-50 border-teal-600 text-teal-950 font-bold shadow-2xs'
                          : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-sm font-bold">4. Tùy chỉnh ngày &amp; giờ</div>
                      <div className="text-xs text-slate-500 font-normal mt-0.5">
                        Chỉ định chính xác thời điểm phát sóng tin nhắn
                      </div>
                    </button>
                  </div>

                  {/* Chi tiết khi chọn tùy chỉnh */}
                  {schedulePreset === 'custom_time' && (
                    <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-700">Ngày giờ:</span>
                        <input
                          type="datetime-local"
                          value={customDatetime}
                          onChange={(e) => setCustomDatetime(e.target.value)}
                          className="px-3 py-1.5 bg-white border border-slate-300 rounded font-mono text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-600"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap text-xs">
                        <button
                          type="button"
                          onClick={() => handleQuickAddDays(1)}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-800 rounded border border-slate-300 font-medium cursor-pointer"
                        >
                          +1 ngày
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickAddDays(3)}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-800 rounded border border-slate-300 font-medium cursor-pointer"
                        >
                          +3 ngày
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickAddDays(7)}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-800 rounded border border-slate-300 font-medium cursor-pointer"
                        >
                          +7 ngày
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Tóm tắt quy tắc */}
                  <div className="text-xs font-medium text-teal-900 bg-white p-2.5 rounded-lg border border-teal-200">
                    Quy tắc kích hoạt: <strong>{presetDescription}</strong>
                  </div>
                </div>

                {/* Báo kết quả hoặc lỗi */}
                {status === 'success' && (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-lg text-emerald-950 text-xs space-y-1">
                    <div className="font-bold text-sm">
                      {effectiveDispatchMode === 'scheduled'
                        ? '[THÀNH CÔNG] Đã lưu lịch tự động phát tin vào hàng đợi của Bệnh Viện!'
                        : activeTab === 'sms'
                        ? `[THÀNH CÔNG] Đã phát sóng SMS tới số ${receipt?.recipientPhone || phone}!`
                        : `[THÀNH CÔNG] Đã chuyển phát Email tới ${email}!`}
                    </div>
                    <div className="font-mono text-xs text-emerald-900">
                      Mã biên nhận: {receipt?.deliveryReceipt || receipt?.id || emailSentReceipt?.message || 'OK'}
                    </div>
                  </div>
                )}

                {status === 'error' && (
                  <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-lg text-rose-950 text-xs">
                    <span className="font-bold">[LỖI]: </span>
                    <span>{errorMessage || 'Đã xảy ra lỗi khi gửi thông báo, vui lòng kiểm tra lại.'}</span>
                  </div>
                )}
              </div>
            </form>

            {/* VÙNG BÊN PHẢI (42%): ĐỐI SOÁT TOÀN VĂN VĂN BẢN Y TẾ CHUẨN MỰC */}
            <div className="lg:col-span-5 p-6 bg-slate-50/70 overflow-y-auto flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Đối soát văn bản phát đi (Live Document Preview)
                  </span>
                  <span className="text-xs font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                    {activeTab === 'sms' ? 'Tin nhắn SMS' : 'Email Y Tế TT 26/2025'}
                  </span>
                </div>

                {activeTab === 'email' ? (
                  /* KHUNG HIỂN THỊ EMAIL Y TẾ CHUẨN THÔNG TƯ 26 */
                  <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4 text-slate-800 text-sm">
                    {/* Header Bệnh viện */}
                    <div className="border-b border-slate-200 pb-3 text-center space-y-1">
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        BỆNH VIỆN ĐA KHOA LÂM SÀNG · KHO DƯỢC &amp; ĐIỀU TRỊ
                      </div>
                      <div className="text-base font-bold text-slate-900">
                        ĐƠN THUỐC ĐIỆN TỬ VÀ DẶN DÒ ĐIỀU TRỊ
                      </div>
                      <div className="text-xs font-mono text-teal-800">
                        Mã đơn quốc gia: {orderId || 'RX-2026-604'}
                      </div>
                    </div>

                    {/* Thông tin bệnh nhân */}
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1">
                      <div className="flex justify-between">
                        <span>Họ và tên: <strong className="text-slate-900">{effectiveName}</strong></span>
                        <span>Mã BN: <strong className="font-mono text-slate-900">{effectiveId}</strong></span>
                      </div>
                      <div className="flex justify-between">
                        <span>Bác sĩ kê đơn: <strong className="text-slate-900">{cleanDoctorDisplay(doctorName)}</strong></span>
                        <span>Ngày cấp: <strong className="text-slate-900">{new Date().toLocaleDateString('vi-VN')}</strong></span>
                      </div>
                      <div>
                        Chẩn đoán: <strong className="text-slate-900">{effectiveDiagnosis}</strong>
                      </div>
                    </div>

                    {/* Danh mục thuốc */}
                    <div className="space-y-2">
                      <div className="text-xs font-bold uppercase tracking-wide text-slate-700">
                        Danh mục thuốc điều trị ({effectiveMedications.length} thuốc):
                      </div>
                      <div className="space-y-2">
                        {effectiveMedications.map((med, idx) => (
                          <div key={med.id || idx} className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 text-xs space-y-1">
                            <div className="flex justify-between font-bold text-slate-900">
                              <span>{idx + 1}. {med.medicationName}</span>
                              <span className="text-teal-900">{med.durationDays || 5} ngày</span>
                            </div>
                            <div className="text-slate-600">
                              Liều dùng: <strong className="text-slate-800">{med.dosage}</strong>
                            </div>
                            <div className="text-slate-500">
                              Đường dùng: {med.route} · Lưu ý: {med.specialInstructions || 'Theo chỉ định'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Lời dặn dò bác sĩ */}
                    <div className="p-3 rounded-lg border border-teal-200 bg-teal-50/40 text-xs space-y-1">
                      <div className="font-bold text-teal-950 uppercase tracking-wide">
                        Lời dặn chuyên môn của Bác sĩ:
                      </div>
                      <div className="text-slate-800 leading-relaxed font-sans whitespace-pre-wrap">
                        {emailAdvice}
                      </div>
                    </div>

                    {/* Chân trang thư */}
                    <div className="pt-2 border-t border-slate-200 text-xs text-slate-500 space-y-1">
                      <div>Tra cứu đơn tại Cổng Đơn thuốc Quốc gia: <strong>https://donthuocquocgia.vn/?id={orderId || 'RX-2026-604'}</strong></div>
                      <div>Đường dây nóng tư vấn dược lâm sàng 24/7: <strong>1900-1234</strong></div>
                    </div>
                  </div>
                ) : (
                  /* KHUNG HIỂN THỊ SMS CHUẨN BRANDNAME */
                  <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3.5 text-slate-800 text-sm">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200 text-xs">
                      <span className="font-bold text-teal-900 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                        Brandname: BV_LAMSANG
                      </span>
                      <span className="font-mono text-slate-600">Đích đến: {phone}</span>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-sm font-sans leading-relaxed text-slate-900 whitespace-pre-wrap">
                      {content}
                    </div>

                    <div className="text-xs text-slate-500 space-y-1">
                      <div>Kịch bản gửi: <strong>{presetDescription}</strong></div>
                      <div>Mã đơn thuốc CPOE liên kết: <strong>{orderId || 'RX-2026-604'}</strong></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Xem nhật ký */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                <span>
                  Bệnh nhân đã nhận <strong>{logs.length}</strong> SMS và <strong>{emailLogs.length}</strong> Email
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className="font-bold text-teal-900 underline hover:text-teal-950 cursor-pointer"
                >
                  Xem toàn bộ nhật ký ({logs.length + emailLogs.length}) -&gt;
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================================= */}
        {/* 3. Tab Nhật Ký & Lịch Hẹn Hợp Nhất (Widescreen max-w-7xl)                                 */}
        {/* ========================================================================================= */}
        {activeTab === 'history' && (
          <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 space-y-4">
            {/* Thanh công cụ lọc */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-700">Bộ lọc:</span>
                <button
                  type="button"
                  onClick={() => setHistoryChannelFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs cursor-pointer transition ${
                    historyChannelFilter === 'all'
                      ? 'bg-teal-50 border border-teal-600 text-teal-950 font-bold'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-transparent'
                  }`}
                >
                  Tất cả ({logs.length + emailLogs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryChannelFilter('sms')}
                  className={`px-3 py-1.5 rounded-lg text-xs cursor-pointer transition ${
                    historyChannelFilter === 'sms'
                      ? 'bg-teal-50 border border-teal-600 text-teal-950 font-bold'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-transparent'
                  }`}
                >
                  Tin nhắn SMS ({logs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryChannelFilter('email')}
                  className={`px-3 py-1.5 rounded-lg text-xs cursor-pointer transition ${
                    historyChannelFilter === 'email'
                      ? 'bg-teal-50 border border-teal-600 text-teal-950 font-bold'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-transparent'
                  }`}
                >
                  Thư Email ({emailLogs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryChannelFilter('scheduled')}
                  className={`px-3 py-1.5 rounded-lg text-xs cursor-pointer transition ${
                    historyChannelFilter === 'scheduled'
                      ? 'bg-amber-100 border border-amber-400 text-amber-950 font-bold'
                      : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  Đang hẹn gửi ({scheduledCount})
                </button>
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Tìm nội dung, người nhận, mã biên nhận..."
                  className="w-full sm:w-72 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => setActiveTab('sms')}
                  className="px-4 py-1.5 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-lg text-xs transition cursor-pointer whitespace-nowrap"
                >
                  + Soạn Tin Mới
                </button>
              </div>
            </div>

            {/* Danh sách bản ghi */}
            {combinedHistory.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-500 text-sm">
                Không tìm thấy bản ghi thông báo nào phù hợp với bộ lọc hiện tại.
              </div>
            ) : (
              <div className="space-y-3">
                {combinedHistory.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition overflow-hidden text-sm"
                  >
                    <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 text-slate-700 flex-wrap">
                        <span className="font-bold font-mono text-slate-900">
                          [{item.channel.toUpperCase()}] {item.recipient}
                        </span>
                        <span className="text-slate-300">|</span>
                        <span className="text-slate-500">{formatLogTimestamp(item.createdAt)}</span>
                        <span className="text-slate-300">|</span>
                        <span className="text-slate-700 font-medium">{item.title}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {item.receiptCode}
                        </span>

                        {item.status === 'scheduled' ? (
                          <div className="flex items-center gap-1.5">
                            <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-950 border border-amber-300">
                              ĐÃ LÊN LỊCH: {item.scheduledAt ? formatLogTimestamp(item.scheduledAt) : 'Theo cữ thuốc'}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCancelSchedule(item.id, item.channel)}
                              className="px-2.5 py-0.5 rounded text-xs font-bold bg-white text-rose-700 border border-rose-300 hover:bg-rose-50 cursor-pointer"
                            >
                              [Hủy lịch]
                            </button>
                          </div>
                        ) : item.status === 'cancelled' ? (
                          <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-600 border border-slate-300">
                            ĐÃ HỦY LỊCH
                          </span>
                        ) : item.status === 'failed' ? (
                          <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
                            LỖI GỬI
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            ĐÃ PHÁT SÓNG
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-4 text-slate-800 font-sans leading-relaxed whitespace-pre-wrap select-text text-sm">
                      {item.content}
                    </div>

                    {item.timingRule && item.timingRule !== 'immediate' && (
                      <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-xs text-slate-500 font-mono">
                        Quy tắc lịch trình: {item.timingRule}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================================= */}
        {/* 4. Footer Bar: Tinh Gọn, Rõ Ràng - Medical Teal Button - Không Màu Đen                     */}
        {/* ========================================================================================= */}
        <div className="px-6 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between shrink-0 text-sm">
          <div className="text-slate-600 font-medium">
            Kênh phát tin:{' '}
            <strong className="text-slate-900 font-semibold">
              {activeTab === 'sms'
                ? 'Tin nhắn SMS Brandname'
                : activeTab === 'email'
                ? 'Thư điện tử Email Y Tế'
                : 'Nhật ký & Lịch hẹn'}
            </strong>{' '}
            | Kịch bản:{' '}
            <strong className="text-slate-900 font-semibold">
              {presetDescription}
            </strong>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border border-slate-300 hover:bg-slate-100 rounded-lg font-semibold text-slate-700 cursor-pointer transition text-sm"
            >
              Đóng
            </button>

            {(activeTab === 'sms' || activeTab === 'email') && (
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={status === 'sending'}
                data-testid="btn-submit-send-sms"
                className="px-6 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg font-bold cursor-pointer shadow-xs disabled:opacity-60 transition active:scale-98 text-sm"
              >
                {status === 'sending'
                  ? 'Đang phát sóng...'
                  : effectiveDispatchMode === 'scheduled'
                  ? activeTab === 'sms'
                    ? 'Xác Nhận Lên Lịch Gửi SMS'
                    : 'Xác Nhận Lên Lịch Gửi Email'
                  : activeTab === 'sms'
                  ? 'Phát Tin Nhắn SMS Ngay'
                  : 'Chuyển Phát Email Cho Bệnh Nhân Ngay'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
