/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Modal Gửi Thông Báo Bệnh Nhân Chuẩn Workstation Kho Dược / CPOE (TT 26/2025/TT-BYT)
 * Tách Biệt Tab Riêng Biệt Giữa Soạn Tin & Xem Toàn Bộ Lịch Sử SMS / Email (Rõ Nét, Không Cắt, Không Che)
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Send,
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Clock,
  Sparkles,
  Radio,
  User,
  Phone,
  Mail,
  FileCode,
  Check,
  Loader2,
  Settings,
  HelpCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Building2,
  Inbox,
  Copy,
  RotateCcw,
  Search,
  Calendar,
  Layers
} from 'lucide-react';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import { smsApi } from '../../services/api/smsApi';
import { SmsDeliveryReceipt, SmsMessageType, SmsProviderType, SmsTemplateItem } from '../../types/sms';
import { PatientProfile } from '../../services/patientService';
import {
  sendMedicationAdviceEmail,
  getStoredGasWebhookUrl,
  setStoredGasWebhookUrl
} from '../../services/prescriptionAdviceService';
import { PatientPrescriptionAdvice, ScheduledMedication, SendAdviceEmailResponse } from '../../types/medicationSchedule';

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
  status: string;
  deliveryReceipt?: string;
  createdAt: string;
}

export type NotificationModalTab = 'sms' | 'email' | 'history-sms' | 'history-email' | 'settings';

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
const STORAGE_KEY_ESMS_API_KEY = 'clinical_esms_api_key';
const STORAGE_KEY_ESMS_SECRET_KEY = 'clinical_esms_secret_key';
const STORAGE_KEY_ESMS_BRANDNAME = 'clinical_esms_brandname';

export function getStoredEsmsApiKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_ESMS_API_KEY) || '';
  } catch {
    return '';
  }
}

export function setStoredEsmsApiKey(val: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_ESMS_API_KEY, val.trim());
  } catch {}
}

export function getStoredEsmsSecretKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_ESMS_SECRET_KEY) || '';
  } catch {
    return '';
  }
}

export function setStoredEsmsSecretKey(val: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_ESMS_SECRET_KEY, val.trim());
  } catch {}
}

export function getStoredEsmsBrandname(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_ESMS_BRANDNAME) || 'BV_LAMSANG';
  } catch {
    return 'BV_LAMSANG';
  }
}

export function setStoredEsmsBrandname(val: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_ESMS_BRANDNAME, val.trim());
  } catch {}
}

const INITIAL_CANONICAL_SMS_LOGS: SmsDeliveryReceipt[] = [
  {
    id: 'SMS-20261030-8817-01',
    recipientPhone: '0963278149',
    patientId: 'BN-8817',
    patientName: 'Trần Huy Hoàng',
    messageType: 'cpoe_prescription',
    content: '[BV LAM SANG] BS. Tran Van Hung da ky don thuoc ma RX-2026-604 cho BN Tran Huy Hoang. Tra cuu don tai: https://donthuocquocgia.vn/?id=RX-2026-604. Hotline: 1900-1234',
    charactersCount: 160,
    smsSegments: 1,
    provider: 'esms',
    status: 'delivered',
    referenceId: 'RX-2026-604',
    deliveryReceipt: 'ESMS-DLR-8817-01',
    createdAt: '2026-10-30T10:15:00Z'
  },
  {
    id: 'SMS-20261030-8817-02',
    recipientPhone: '0963278149',
    patientId: 'BN-8817',
    patientName: 'Trần Huy Hoàng',
    messageType: 'medication_advice',
    content: '[BV LAM SANG] Nhac uong thuoc BN Tran Huy Hoang: Sang 07:30 (1 vien sau an), Toi 20:00 (1 vien truoc ngu). Uong dung gio, tai kham ngay neu co trieu chung bat thuong.',
    charactersCount: 153,
    smsSegments: 1,
    provider: 'esms',
    status: 'delivered',
    referenceId: 'RX-2026-604',
    deliveryReceipt: 'ESMS-DLR-8817-02',
    createdAt: '2026-10-30T14:30:00Z'
  }
];

const INITIAL_CANONICAL_EMAIL_LOGS: EmailDeliveryReceipt[] = [
  {
    id: 'MAIL-20261030-8817-01',
    recipientEmail: 'huyhoang6altt@gmail.com',
    patientId: 'BN-8817',
    patientName: 'Trần Huy Hoàng',
    subject: '[BV ĐA KHOA LÂM SÀNG] Đơn thuốc điện tử & Hướng dẫn điều trị - Mã đơn RX-2026-604',
    adviceContent: 'Kính gửi bệnh nhân Trần Huy Hoàng,\n\nBệnh viện Đa khoa Lâm Sàng thông báo Bác sĩ BS. Trần Văn Hùng đã hoàn tất kê đơn và ký số đơn thuốc điện tử mã RX-2026-604 theo quy chuẩn Thông tư 26/2025/TT-BYT.\n\nHướng dẫn dùng thuốc: PARACETAMOL 500mg uống 1 viên/lần x 2 lần/ngày sau khi ăn no 30 phút (Sáng: 07:30, Tối: 19:30). Uống cùng nhiều nước ấm. Nếu sốt cao kéo dài trên 3 ngày hoặc có biểu hiện dị ứng nổi mẩn, tái khám ngay.\n\nQuý bệnh nhân có thể sử dụng mã đơn này để tra cứu tại Cổng Đơn thuốc Quốc gia (https://donthuocquocgia.vn) hoặc mua thuốc tại các nhà thuốc trên toàn quốc.',
    medicationsSummary: 'PARACETAMOL 500mg (1 viên x 2 lần/ngày, 5 ngày)',
    orderId: 'RX-2026-604',
    provider: 'Google Apps Script Webhook',
    status: 'delivered',
    deliveryReceipt: 'GAS-MAIL-20261030-01',
    createdAt: '2026-10-30T10:16:12Z'
  },
  {
    id: 'MAIL-20261030-8817-02',
    recipientEmail: 'huyhoang6altt@gmail.com',
    patientId: 'BN-8817',
    patientName: 'Trần Huy Hoàng',
    subject: '[BV ĐA KHOA LÂM SÀNG] Xác nhận viện phí & Lịch hẹn tái khám - BN Trần Huy Hoàng',
    adviceContent: 'Bệnh viện xác nhận người bệnh Trần Huy Hoàng (BN-8817) đã hoàn tất thủ tục khám và thanh toán viện phí theo quy định. Đề nghị tái khám sau 30 ngày tại Khoa Khám Bệnh - Phòng 204. Vui lòng mang theo đơn thuốc và hồ sơ khi tái khám.',
    medicationsSummary: 'PARACETAMOL 500mg (1 viên x 2 lần/ngày, 5 ngày)',
    orderId: 'RX-2026-604',
    provider: 'Google Apps Script Webhook',
    status: 'delivered',
    deliveryReceipt: 'GAS-MAIL-20261030-02',
    createdAt: '2026-10-30T16:20:00Z'
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
    return `${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · ${d.toLocaleDateString('vi-VN')}`;
  } catch {
    return ts;
  }
}

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

  // Lựa chọn Tab chính của Modal: Soạn SMS, Soạn Email, Lịch sử SMS, Lịch sử Email
  const [activeTab, setActiveTab] = useState<NotificationModalTab>('sms');

  // Trạng thái SMS (Cổng SMS Brandname)
  const [phone, setPhone] = useState(effectivePhone);
  const [messageType, setMessageType] = useState<SmsMessageType>(initialMessageType);
  const [content, setContent] = useState('');
  const [receipt, setReceipt] = useState<SmsDeliveryReceipt | null>(null);
  const [logs, setLogs] = useState<SmsDeliveryReceipt[]>(INITIAL_CANONICAL_SMS_LOGS);
  const [templates, setTemplates] = useState<SmsTemplateItem[]>([]);

  // Trạng thái Email
  const [email, setEmail] = useState(effectiveEmail);
  const [emailSubject, setEmailSubject] = useState(`[BV ĐA KHOA LÂM SÀNG] Đơn thuốc điện tử & Hướng dẫn điều trị - Mã đơn ${orderId || 'RX-2026-604'}`);
  const [emailAdvice, setEmailAdvice] = useState('Uống thuốc đúng cữ theo toa, uống nhiều nước ấm. Nếu có biểu hiện sốt cao kéo dài hoặc dị ứng, tái khám ngay.');
  const [emailSentSuccess, setEmailSentSuccess] = useState(false);
  const [emailSentReceipt, setEmailSentReceipt] = useState<SendAdviceEmailResponse | null>(null);
  // Trạng thái cấu hình Cổng phát tin
  const [gasUrl, setGasUrl] = useState<string>(() => getStoredGasWebhookUrl());
  const [esmsApiKey, setEsmsApiKey] = useState<string>(() => getStoredEsmsApiKey());
  const [esmsSecretKey, setEsmsSecretKey] = useState<string>(() => getStoredEsmsSecretKey());
  const [esmsBrandname, setEsmsBrandname] = useState<string>(() => getStoredEsmsBrandname());
  const [settingsNotice, setSettingsNotice] = useState<string | null>(null);
  const [emailLogs, setEmailLogs] = useState<EmailDeliveryReceipt[]>(() => getStoredEmailLogs(effectiveId));

  // Trạng thái chung
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  // Tải templates và logs khi mở modal
  useEffect(() => {
    if (isOpen) {
      setPhone(effectivePhone);
      setEmail(effectiveEmail);
      setStatus('idle');
      setReceipt(null);
      setEmailSentSuccess(false);
      setEmailSentReceipt(null);
      setErrorMessage(null);
      setGasUrl(getStoredGasWebhookUrl());
      setSearchFilter('');

      smsApi.getTemplates().then(setTemplates).catch(console.warn);

      if (effectiveId && effectiveId !== 'BN-Chưa có') {
        smsApi.getLogs(effectiveId).then((data) => {
          if (data && data.length > 0) {
            setLogs(data);
          } else {
            setLogs(INITIAL_CANONICAL_SMS_LOGS);
          }
        }).catch(() => {
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
        `[BV LAM SANG] ${cleanDoctorDisplay(doctorName)} da ky don thuoc ma ${rxId} cho BN ${removeVietnameseTones(effectiveName)}. Tra cuu don tai: https://donthuocquocgia.vn/?id=${rxId}. Hotline: 1900-1234`
      );
    } else if (messageType === 'medication_advice') {
      setContent(
        `[BV LAM SANG] Nhac uong thuoc BN ${removeVietnameseTones(effectiveName)}: Sang 07:30 (1 vien sau an), Toi 20:00 (1 vien truoc ngu). Tai kham ngay neu co trieu chung bat thuong.`
      );
    } else {
      setContent(
        `[BV LAM SANG] Xac nhan BN ${removeVietnameseTones(effectiveName)} (${effectiveId}) da hoan tat thu tuc kham benh tai Khoa Kham Benh. Tran trong cam on Quy khach!`
      );
    }
  }, [messageType, orderId, doctorName, effectiveName, effectiveId, initialContent]);

  // Danh mục thuốc hiệu lực
  const effectiveMedications = useMemo<ScheduledMedication[]>(() => {
    if (medications && medications.length > 0) return medications;
    return [
      {
        id: 'sched-0',
        medicationName: 'PARACETAMOL 500mg',
        activeIngredient: 'Paracetamol',
        dosage: '1 viên/lần',
        route: 'Đường uống',
        durationDays: 5,
        specialInstructions: 'Uống sau khi ăn no 30 phút, uống nhiều nước',
        timeSlots: [
          { id: 'morning', label: 'Sáng', time: '07:30', dosageText: '1 viên', mealRelation: 'Sau khi ăn 15-30 phút' },
          { id: 'evening', label: 'Tối', time: '19:30', dosageText: '1 viên', mealRelation: 'Sau khi ăn 15-30 phút' }
        ]
      }
    ];
  }, [medications]);

  // Tính toán số ký tự và số segment SMS
  const { charsCount, isUnicode, segmentsCount, maxPerSegment } = useMemo(() => {
    const chars = content.length;
    let unicode = false;
    for (let i = 0; i < content.length; i++) {
      if (content.charCodeAt(i) > 127) {
        unicode = true;
        break;
      }
    }
    const limit = unicode ? 70 : 160;
    const concatLimit = unicode ? 67 : 153;
    const segments = chars <= limit ? 1 : Math.ceil(chars / concatLimit);
    return {
      charsCount: chars,
      isUnicode: unicode,
      segmentsCount: Math.max(1, segments),
      maxPerSegment: limit
    };
  }, [content]);

  // Áp dụng mẫu tin chuẩn Thông tư 26 cho cả SMS và Email
  const handleApplyTemplate = (tpl: SmsTemplateItem) => {
    setMessageType(tpl.category as SmsMessageType);
    const cleanDoc = cleanDoctorDisplay(doctorName);
    const rxId = orderId || 'RX-2026-604';

    if (activeTab === 'sms') {
      let replaced = tpl.template
        .replace(/{doctorName}/g, cleanDoc)
        .replace(/{orderId}/g, rxId)
        .replace(/{patientName}/g, removeVietnameseTones(effectiveName))
        .replace(/{patientId}/g, effectiveId);
      setContent(replaced);
    } else {
      if (tpl.category === 'cpoe_prescription') {
        setEmailSubject(`[BV ĐA KHOA LÂM SÀNG] Đơn thuốc điện tử Quốc gia - Mã đơn ${rxId}`);
        setEmailAdvice(
          `Kính gửi bệnh nhân ${effectiveName},\n\nBệnh viện Đa khoa Lâm Sàng thông báo Bác sĩ ${cleanDoc} đã hoàn tất kê đơn và ký số đơn thuốc điện tử mã ${rxId} theo quy chuẩn Thông tư 26/2025/TT-BYT.\n\nQuý bệnh nhân có thể sử dụng mã đơn này để tra cứu tại Cổng Đơn thuốc Quốc gia (https://donthuocquocgia.vn) hoặc mua thuốc tại các nhà thuốc trên toàn quốc.`
        );
      } else if (tpl.category === 'medication_advice') {
        setEmailSubject(`[BV ĐA KHOA LÂM SÀNG] Hướng dẫn cữ uống thuốc & Lời dặn Bác sĩ - Mã đơn ${rxId}`);
        setEmailAdvice(
          `Uống thuốc đúng cữ theo toa, uống nhiều nước ấm. Tuyệt đối không tự ý ngưng hoặc thay đổi liều lượng thuốc. Khung giờ khuyến nghị: Sáng 07:30 (1 viên sau ăn no 30 phút), Tối 19:30 (1 viên sau ăn). Nếu có biểu hiện sốt cao kéo dài hoặc phát ban dị ứng, tái khám ngay.`
        );
      } else {
        setEmailSubject(`[BV ĐA KHOA LÂM SÀNG] Xác nhận hoàn tất viện phí & Lịch hẹn tái khám - BN ${effectiveName}`);
        setEmailAdvice(
          `Bệnh viện xác nhận người bệnh ${effectiveName} (${effectiveId}) đã hoàn tất thủ tục khám và thanh toán viện phí theo quy định. Đề nghị tái khám sau 30 ngày tại Khoa Khám Bệnh - Phòng 204. Vui lòng mang theo đơn thuốc và hồ sơ khi tái khám.`
        );
      }
    }
  };

  // Thao tác chèn nhanh tóm tắt đơn thuốc vào vùng soạn thảo
  const handleInsertPrescriptionSnippet = () => {
    const rxId = orderId || 'RX-2026-604';
    const cleanDoc = cleanDoctorDisplay(doctorName);
    if (activeTab === 'sms') {
      const snippet = `[Don ${rxId}: PARACETAMOL 500mg, uong 1 vien x 2 lan/ngay sau an. BS ${cleanDoc}]`;
      setContent((prev) => (prev ? `${prev} ${snippet}` : snippet));
    } else {
      const snippet = `[Đơn thuốc ${rxId}: PARACETAMOL 500mg (1 viên x 2 lần/ngày sau ăn 30p). Chẩn đoán: ${effectiveDiagnosis}. BS kê đơn: ${cleanDoc}]`;
      setEmailAdvice((prev) => (prev ? `${prev}\n${snippet}` : snippet));
    }
  };

  const handleConvertToUnsigned = () => {
    setContent(removeVietnameseTones(content));
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Lọc danh sách nhật ký SMS
  const filteredSmsLogs = useMemo(() => {
    if (!searchFilter.trim()) return logs;
    const q = searchFilter.toLowerCase();
    return logs.filter(
      (l) =>
        l.content.toLowerCase().includes(q) ||
        l.recipientPhone.includes(q) ||
        (l.deliveryReceipt && l.deliveryReceipt.toLowerCase().includes(q))
    );
  }, [logs, searchFilter]);

  // Lọc danh sách nhật ký Email
  const filteredEmailLogs = useMemo(() => {
    if (!searchFilter.trim()) return emailLogs;
    const q = searchFilter.toLowerCase();
    return emailLogs.filter(
      (l) =>
        l.subject.toLowerCase().includes(q) ||
        l.adviceContent.toLowerCase().includes(q) ||
        l.recipientEmail.toLowerCase().includes(q)
    );
  }, [emailLogs, searchFilter]);

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
          provider: 'esms'
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
        const storedWebhook = gasUrl.trim() || getStoredGasWebhookUrl();
        if (gasUrl.trim()) {
          setStoredGasWebhookUrl(gasUrl.trim());
        }

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
          endDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
          generalDoctorAdvice: emailAdvice.trim(),
          medications: effectiveMedications,
          notificationStatus: 'idle',
          gasWebhookUrl: storedWebhook || undefined
        };

        const res = await sendMedicationAdviceEmail(advicePayload, { sendEmail: true, sendSms: false });
        if (res.success) {
          setEmailSentSuccess(true);
          setEmailSentReceipt(res);
          setStatus('success');

          // Lưu bản ghi lịch sử Email mới
          const newLog: EmailDeliveryReceipt = {
            id: `MAIL-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
            recipientEmail: email.trim(),
            patientId: effectiveId,
            patientName: effectiveName,
            subject: emailSubject.trim(),
            adviceContent: emailAdvice.trim(),
            medicationsSummary: 'PARACETAMOL 500mg (1 viên x 2 lần/ngày, 5 ngày)',
            orderId: orderId || 'RX-2026-604',
            provider: res.provider === 'google_apps_script' ? 'Google Apps Script Webhook' : 'SMTP Gateway',
            status: 'delivered',
            deliveryReceipt: `GAS-MAIL-${Date.now().toString().slice(-6)}`,
            createdAt: new Date().toISOString()
          };
          saveStoredEmailLog(newLog);
          setEmailLogs((prev) => [newLog, ...prev]);
        } else {
          setStatus('error');
          setErrorMessage(res.message || 'Không thể gửi email dặn dò');
        }
      } catch (err: any) {
        console.error('Lỗi khi gửi Email:', err);
        setStatus('error');
        setErrorMessage(
          err.message || 'Chưa cấu hình Google Apps Script Webhook để gửi email. Vui lòng cấu hình Webhook URL bên dưới.'
        );
        setShowGasConfig(true);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="notification-modal-title"
      data-testid="send-sms-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-5 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-5xl h-[100dvh] sm:h-auto sm:max-h-[92vh] flex flex-col bg-white rounded-none sm:rounded-xl shadow-2xl border-0 sm:border border-slate-200 overflow-hidden">
        
        {/* 1. Header Thanh Lịch: Tabs Soạn SMS, Soạn Email, Lịch sử SMS, Lịch sử Email */}
        <div className="px-4 sm:px-5 py-3 sm:py-3.5 bg-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 shrink-0">
          <div className="flex items-center justify-between w-full sm:w-auto">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
              </div>
              <div className="min-w-0">
                <h3 id="notification-modal-title" className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                  GỬI THÔNG TIN CHO BỆNH NHÂN (TT 26/2025/TT-BYT)
                </h3>
                <p className="text-2xs text-slate-500 truncate">
                  Hồ sơ: <strong className="text-slate-800 font-medium">{effectiveName}</strong> · Mã BN: <span className="font-mono text-slate-700">{effectiveId}</span>
                </p>
              </div>
            </div>

            {/* Mobile Close Button */}
            <button
              onClick={onClose}
              data-testid="btn-close-sms-modal-mobile"
              aria-label="Đóng cửa sổ thông báo"
              className="sm:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Lựa chọn Tab: Soạn SMS / Soạn Email / Lịch sử SMS / Lịch sử Email */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex rounded-lg p-0.5 bg-slate-100 border border-slate-200 text-xs font-medium overflow-x-auto thin-scrollbar w-full sm:w-auto">
              <button
                type="button"
                data-testid="tab-sms"
                onClick={() => { setActiveTab('sms'); setStatus('idle'); setErrorMessage(null); }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition shrink-0 flex items-center gap-1.5 ${
                  activeTab === 'sms'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-950 hover:bg-slate-200/60'
                }`}
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Tin nhắn SMS</span>
              </button>
              
              <button
                type="button"
                data-testid="tab-email"
                onClick={() => { setActiveTab('email'); setStatus('idle'); setErrorMessage(null); }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition shrink-0 flex items-center gap-1.5 ${
                  activeTab === 'email'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-950 hover:bg-slate-200/60'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Thư điện tử (Email)</span>
              </button>

              <button
                type="button"
                data-testid="tab-history-sms"
                onClick={() => { setActiveTab('history-sms'); setStatus('idle'); setErrorMessage(null); }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition shrink-0 flex items-center gap-1.5 ${
                  activeTab === 'history-sms'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-950 hover:bg-slate-200/60'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Lịch sử SMS</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeTab === 'history-sms' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {logs.length}
                </span>
              </button>

              <button
                type="button"
                data-testid="tab-history-email"
                onClick={() => { setActiveTab('history-email'); setStatus('idle'); setErrorMessage(null); }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition shrink-0 flex items-center gap-1.5 ${
                  activeTab === 'history-email'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-950 hover:bg-slate-200/60'
                }`}
              >
                <Inbox className="w-3.5 h-3.5" />
                <span>Lịch sử Email</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeTab === 'history-email' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {emailLogs.length}
                </span>
              </button>

              <button
                type="button"
                data-testid="tab-settings"
                onClick={() => { setActiveTab('settings'); setStatus('idle'); setErrorMessage(null); setSettingsNotice(null); }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition shrink-0 flex items-center gap-1.5 ${
                  activeTab === 'settings'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-950 hover:bg-slate-200/60'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Cài đặt cổng tin</span>
              </button>
            </div>

            {/* Desktop Close Button */}
            <button
              onClick={onClose}
              data-testid="btn-close-sms-modal"
              aria-label="Đóng cửa sổ thông báo"
              className="hidden sm:flex p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. Thanh Thông Tin Hành Chính (Ribbon phẳng) */}
        <div className="px-4 sm:px-5 py-2 sm:py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 sm:gap-3 text-xs shrink-0">
          <div className="flex items-center gap-3 text-slate-700 flex-wrap">
            <div className="flex items-center gap-1.5 font-medium">
              <User className="w-3.5 h-3.5 text-slate-500" />
              <span>Người bệnh: <strong className="text-slate-900">{effectiveName}</strong></span>
              <span className="text-slate-400 font-mono font-normal">({effectiveId})</span>
            </div>
            {orderId && (
              <>
                <span className="text-slate-300">·</span>
                <div className="flex items-center gap-1 font-mono">
                  <FileCode className="w-3.5 h-3.5 text-slate-500" />
                  <span>Mã đơn: <strong className="text-slate-900">{orderId}</strong></span>
                </div>
              </>
            )}
            <span className="text-slate-300">·</span>
            <span>Bác sĩ: <strong className="text-slate-800">{cleanDoctorDisplay(doctorName)}</strong></span>
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-medium bg-white text-slate-700 border border-slate-200 shadow-2xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>
              {activeTab === 'sms' && 'Kênh phát: SMS Brandname'}
              {activeTab === 'email' && 'Kênh phát: Email Y Tế'}
              {activeTab === 'history-sms' && `Nhật ký SMS: ${logs.length} bản ghi`}
              {activeTab === 'history-email' && `Nhật ký Email: ${emailLogs.length} bản ghi`}
            </span>
          </div>
        </div>

        {/* ========================================================================================= */}
        {/* PHẦN 3A: TAB SOẠN THẢO (SMS HOẶC EMAIL) - BỐ CỤC 50/50 ZERO-BOX                          */}
        {/* ========================================================================================= */}
        {(activeTab === 'sms' || activeTab === 'email') && (
          <form onSubmit={handleSend} className="grid grid-cols-1 lg:grid-cols-12 min-h-0 flex-1 overflow-y-auto lg:overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
            
            {/* ==================== CỘT TRÁI (6 CỘT): THÔNG TIN NGƯỜI NHẬN & MẪU CHUẨN ==================== */}
            <div className="lg:col-span-6 p-4 sm:p-6 lg:overflow-y-auto thin-scrollbar space-y-4 bg-white">
              
              {/* Header Cột Trái */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  {activeTab === 'sms' ? (
                    <>
                      <Phone className="w-3.5 h-3.5 text-slate-600" />
                      <span>1. Thiết lập người nhận &amp; Mẫu thông tin SMS</span>
                    </>
                  ) : (
                    <>
                      <Mail className="w-3.5 h-3.5 text-slate-600" />
                      <span>1. Thiết lập người nhận &amp; Mẫu thư Email</span>
                    </>
                  )}
                </h4>
                <span className="text-2xs text-slate-500 font-medium">
                  {activeTab === 'sms' ? 'Cổng SMS Brandname' : 'Cổng Email Y Tế'}
                </span>
              </div>

              {/* Hàng 1: Thông tin người nhận */}
              {activeTab === 'sms' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-slate-500" />
                      <span>Số điện thoại người nhận *</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0963278149"
                      aria-label="Số điện thoại nhận SMS"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-slate-500" />
                      <span>Đơn vị gửi (SMS Brandname)</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        readOnly
                        value="BV_LAMSANG"
                        className="w-full px-3 py-2 bg-slate-100/80 border border-slate-300 rounded-lg font-mono text-sm text-slate-800 font-semibold cursor-default"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                        TT 26
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-slate-500" />
                      <span>Email người nhận *</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="huyhoang6altt@gmail.com"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-500 transition font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-slate-500" />
                      <span>Tiêu đề thư (Subject) *</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-500 transition font-medium"
                    />
                  </div>
                </div>
              )}

              {/* Hàng 2: Thông tin đơn thuốc liên kết CPOE */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <FileCode className="w-3.5 h-3.5 text-slate-500" />
                    <span>Thông tin đơn thuốc điện tử liên kết CPOE:</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleInsertPrescriptionSnippet}
                    className="text-[11px] font-semibold text-teal-700 hover:text-teal-900 underline cursor-pointer"
                  >
                    + Chèn thông tin đơn
                  </button>
                </div>
                <div className="text-slate-600 space-y-0.5 text-[11px]">
                  <div>
                    Bệnh nhân: <strong className="text-slate-900">{effectiveName}</strong> <span className="font-mono text-slate-500">({effectiveId})</span> · Mã đơn: <strong className="text-slate-900 font-mono">{orderId || 'RX-2026-604'}</strong>
                  </div>
                  <div>
                    Chẩn đoán: <span className="text-slate-900">{effectiveDiagnosis}</span>
                  </div>
                  <div>
                    Thuốc điều trị: <strong className="text-slate-900 font-medium">PARACETAMOL 500mg</strong> (1 viên x 2 lần/ngày, 5 ngày sau ăn)
                  </div>
                </div>
              </div>

              {/* Hàng 3: Mẫu nội dung chuẩn Thông tư 26 */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700">Mẫu nội dung chuẩn Thông tư 26:</label>
                  <span className="text-[11px] text-slate-500">Bấm để nạp vào ô soạn thảo bên phải</span>
                </div>
                <div className="space-y-2">
                  {templates.map((tpl) => {
                    const isSelected = messageType === tpl.category;
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => handleApplyTemplate(tpl)}
                        className={`w-full text-left p-2.5 rounded-lg border text-xs transition cursor-pointer flex items-start gap-2.5 ${
                          isSelected
                            ? 'border-slate-900 bg-slate-50 text-slate-900 ring-1 ring-slate-900 shadow-2xs'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <FileText className={`w-4 h-4 shrink-0 mt-0.5 ${isSelected ? 'text-slate-900' : 'text-slate-400'}`} />
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-slate-900 flex items-center justify-between">
                            <span>{tpl.title}</span>
                            {isSelected && (
                              <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                Đang áp dụng
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                            {activeTab === 'sms' ? tpl.description : (
                              tpl.category === 'cpoe_prescription'
                                ? 'Mẫu thư điện tử thông báo phát hành mã đơn thuốc điện tử quốc gia.'
                                : tpl.category === 'medication_advice'
                                ? 'Mẫu thư hướng dẫn cữ uống thuốc và chỉ dẫn an toàn điều trị.'
                                : 'Mẫu thư xác nhận viện phí và lịch hẹn tái khám định kỳ.'
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Hàng 4: Trạng thái cổng kết nối & Liên kết sang Cài đặt cổng tin (Không bị trùng lặp ô nhập) */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${
                    activeTab === 'sms'
                      ? (esmsApiKey.trim() ? 'bg-emerald-500' : 'bg-amber-400')
                      : (gasUrl.trim() ? 'bg-emerald-500' : 'bg-amber-400')
                  }`} />
                  <span className="text-slate-700 font-medium text-[11px] truncate">
                    {activeTab === 'sms' ? (
                      esmsApiKey.trim()
                        ? `Cổng eSMS Brandname: Đã lưu API Key (${esmsBrandname || 'BV_LAMSANG'})`
                        : 'Cổng eSMS Brandname: Chưa cấu hình API Key'
                    ) : (
                      gasUrl.trim()
                        ? 'Cổng Google Apps Script: Webhook sẵn sàng (0đ)'
                        : 'Cổng Google Apps Script: Chưa cấu hình Webhook URL'
                    )}
                  </span>
                </div>
                <button
                  type="button"
                  data-testid="link-open-settings-tab"
                  onClick={() => { setActiveTab('settings'); setStatus('idle'); setErrorMessage(null); }}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 hover:text-teal-900 underline cursor-pointer shrink-0"
                  title="Chuyển sang tab Cài đặt cổng tin để sửa API Key hoặc Webhook URL"
                >
                  <Settings className="w-3 h-3" />
                  <span>Cài đặt cổng tin</span>
                </button>
              </div>

              {/* Cảnh báo lỗi chung nếu có */}
              {status === 'error' && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-rose-900 text-xs flex items-center gap-2 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMessage || 'Đã xảy ra lỗi khi gửi thông báo, vui lòng kiểm tra lại.'}</span>
                </div>
              )}
            </div>

            {/* ==================== CỘT PHẢI (6 CỘT): NHẬP TIN NHẮN RIÊNG CHO BỆNH NHÂN ==================== */}
            <div className="lg:col-span-6 p-4 sm:p-6 lg:overflow-y-auto thin-scrollbar space-y-4 bg-white flex flex-col justify-between">
              
              <div className="space-y-4">
                {/* Header Cột Phải */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-1.5">
                    {activeTab === 'sms' ? (
                      <>
                        <MessageSquare className="w-4 h-4 text-slate-800" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                          2. Nhập tin nhắn riêng cho Bệnh nhân
                        </h4>
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4 text-slate-800" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                          2. Nhập nội dung thư riêng &amp; Lời dặn Bác sĩ
                        </h4>
                      </>
                    )}
                  </div>
                  <span className="text-2xs text-slate-500 font-mono">
                    {activeTab === 'sms' ? 'Soạn thảo SMS' : 'Soạn thảo Email'}
                  </span>
                </div>

                {/* Thanh công cụ thao tác nhanh */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label className="text-xs font-semibold text-slate-700">
                    {activeTab === 'sms'
                      ? `Nội dung tin nhắn riêng gửi tới ${effectiveName}:`
                      : `Nội dung thư & Lời dặn dò gửi tới ${effectiveName}:`}
                  </label>
                  <div className="flex items-center gap-2">
                    {activeTab === 'sms' && isUnicode && (
                      <button
                        type="button"
                        onClick={handleConvertToUnsigned}
                        className="text-2xs font-semibold text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1 cursor-pointer transition"
                        title="Chuyển sang tiếng Việt không dấu để tối ưu 160 ký tự/tin nhắn"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Chuyển không dấu (160 kt/tin)</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (activeTab === 'sms') setContent('');
                        else setEmailAdvice('');
                      }}
                      className="text-2xs font-semibold text-slate-600 hover:text-rose-700 bg-slate-100 hover:bg-rose-50 px-2 py-0.5 rounded border border-slate-200 hover:border-rose-200 cursor-pointer transition"
                      title="Xóa trắng để tự gõ nội dung riêng biệt"
                    >
                      Xóa trắng
                    </button>
                  </div>
                </div>

                {/* Khung soạn thảo tin nhắn riêng (Mở rộng toàn bộ chiều cao) */}
                <div>
                  {activeTab === 'sms' ? (
                    <textarea
                      rows={9}
                      required
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="Nhập nội dung tin nhắn riêng cho bệnh nhân (hoặc chọn mẫu từ cột bên trái)..."
                      aria-label="Nội dung tin nhắn SMS"
                      className="w-full p-3.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-500 font-sans leading-relaxed transition resize-y min-h-[210px]"
                    />
                  ) : (
                    <textarea
                      rows={9}
                      required
                      value={emailAdvice}
                      onChange={(e) => setEmailAdvice(e.target.value)}
                      placeholder="Nhập lời dặn dò riêng, hướng dẫn kiêng khem, ăn uống hoặc hẹn tái khám riêng cho người bệnh..."
                      aria-label="Nội dung thư gửi bệnh nhân"
                      className="w-full p-3.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-500 font-sans leading-relaxed transition resize-y min-h-[210px]"
                    />
                  )}

                  {/* Thanh phụ: Đo lường SMS hoặc Chỉ dẫn Email */}
                  {activeTab === 'sms' ? (
                    <div className="flex items-center justify-between text-xs text-slate-500 mt-1.5 px-0.5">
                      <div className="flex items-center gap-2">
                        <span>Độ dài: <strong className="text-slate-900 font-mono">{charsCount}</strong> ký tự</span>
                        <span>·</span>
                        <span>Định dạng: <strong className={isUnicode ? 'text-amber-700 font-semibold' : 'text-emerald-700 font-semibold'}>{isUnicode ? 'Có dấu (UCS-2)' : 'Không dấu (GSM 7-bit)'}</strong></span>
                      </div>
                      <div className="font-semibold text-slate-700 font-mono">
                        {segmentsCount} tin ({charsCount <= maxPerSegment ? `${charsCount}/${maxPerSegment}` : `${segmentsCount} SMS`})
                      </div>
                    </div>
                  ) : (
                    <p className="text-2xs text-slate-500 mt-1.5">
                      ℹ️ Lời dặn dò này sẽ được chèn trang trọng vào mục <strong>[LỜI DẶN DÒ CỦA BÁC SĨ]</strong> kèm toàn văn đơn thuốc gửi tới hộp thư {email}.
                    </p>
                  )}
                </div>

                {/* Thông báo kết quả phát tin thành công */}
                {status === 'success' && (
                  <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-emerald-900 text-xs space-y-1 animate-in fade-in">
                    <div className="flex items-center gap-1.5 font-bold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        {activeTab === 'sms'
                          ? `Phát tin thành công tới SIM di động ${receipt?.recipientPhone || phone}!`
                          : `Đã gửi thành công Email tới ${email}!`}
                      </span>
                    </div>
                    <div className="font-mono text-[11px] text-emerald-800 pl-5.5">
                      {activeTab === 'sms' ? (
                        <>
                          Biên nhận DLR: <span className="font-bold">{receipt?.deliveryReceipt || receipt?.id}</span> · Cổng: eSMS Brandname · Ký tự: {receipt?.charactersCount} ({receipt?.smsSegments} tin)
                        </>
                      ) : (
                        <>
                          {emailSentReceipt?.message || 'Bản sao đơn thuốc điện tử và hướng dẫn điều trị đã được chuyển vào hộp thư người bệnh an toàn.'}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Liên kết chuyển nhanh sang Tab Lịch Sử Riêng Biệt (Không cắt, không che nội dung) */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {activeTab === 'sms' ? (
                    <span>Người bệnh đã nhận <strong>{logs.length}</strong> tin nhắn SMS</span>
                  ) : (
                    <span>Người bệnh đã nhận <strong>{emailLogs.length}</strong> thư điện tử</span>
                  )}
                </span>
                <button
                  type="button"
                  data-testid="link-view-all-history"
                  onClick={() => setActiveTab(activeTab === 'sms' ? 'history-sms' : 'history-email')}
                  className="text-teal-700 hover:text-teal-900 font-semibold underline cursor-pointer flex items-center gap-1 transition"
                >
                  <span>
                    {activeTab === 'sms'
                      ? `Xem toàn bộ lịch sử SMS (${logs.length})`
                      : `Xem toàn bộ lịch sử Email (${emailLogs.length})`}
                  </span>
                  <span>&rarr;</span>
                </button>
              </div>

            </div>
          </form>
        )}

        {/* ========================================================================================= */}
        {/* PHẦN 3B: TAB LỊCH SỬ SMS RIÊNG BIỆT (TOÀN VĂN, RÕ NÉT, KHÔNG CẮT, KHÔNG CHE)              */}
        {/* ========================================================================================= */}
        {activeTab === 'history-sms' && (
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-slate-50/50 space-y-4">
            
            {/* Thanh công cụ quản lý lịch sử SMS */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-teal-50 text-teal-800 flex items-center justify-center font-bold">
                  <Phone className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                    Nhật Ký Phát Tin Nhắn SMS ({filteredSmsLogs.length} bản ghi)
                  </h4>
                  <p className="text-2xs text-slate-500">
                    Toàn bộ tin nhắn SMS Brandname đã gửi tới số di động: <strong className="text-slate-800 font-mono">{phone}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Tìm theo nội dung, mã DLR..."
                    className="pl-8 pr-3 py-1 bg-slate-50 border border-slate-300 rounded text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 w-48 sm:w-64"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('sms')}
                  className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                >
                  <Send className="w-3 h-3 text-slate-300" />
                  <span>+ Soạn SMS Mới</span>
                </button>
              </div>
            </div>

            {/* Danh sách tin nhắn SMS (Toàn bộ nội dung hiển thị rõ nét) */}
            {filteredSmsLogs.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-lg border border-slate-200 text-slate-500 text-xs">
                Chưa có lịch sử tin nhắn SMS nào phù hợp với bộ lọc.
              </div>
            ) : (
              <div className="space-y-3.5">
                {filteredSmsLogs.map((log) => (
                  <div
                    key={log.id}
                    className="bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition overflow-hidden"
                  >
                    {/* Header Strip */}
                    <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-3 text-slate-700 flex-wrap">
                        <span className="font-mono font-bold text-slate-900 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-teal-700" />
                          <span>{log.recipientPhone}</span>
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="flex items-center gap-1 text-slate-500">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{formatLogTimestamp(log.createdAt)}</span>
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="text-slate-500 font-medium">Cổng: eSMS Brandname (BV_LAMSANG)</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {log.deliveryReceipt || log.id}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>ĐÃ GỬI TỚI SIM</span>
                        </span>
                      </div>
                    </div>

                    {/* Body: Toàn bộ nội dung tin nhắn không che không cắt */}
                    <div className="p-4 space-y-2.5">
                      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                        <span>Toàn văn nội dung tin nhắn SMS:</span>
                        <span className="font-mono text-slate-400 font-normal">
                          {log.charactersCount || log.content.length} ký tự ({log.smsSegments || 1} tin)
                        </span>
                      </div>

                      <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 font-sans text-sm text-slate-900 leading-relaxed whitespace-pre-wrap break-words select-text">
                        {log.content}
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] text-slate-400 font-mono">
                          Mã tham chiếu: {log.referenceId || orderId || 'RX-2026-604'}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopyText(log.content, log.id)}
                            className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded flex items-center gap-1 cursor-pointer transition"
                          >
                            {copiedId === log.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
                            <span>{copiedId === log.id ? 'Đã sao chép!' : 'Sao chép tin'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setContent(log.content);
                              setActiveTab('sms');
                            }}
                            className="px-2.5 py-1 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded flex items-center gap-1 cursor-pointer transition"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Nạp vào ô soạn SMS</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================================= */}
        {/* PHẦN 3C: TAB LỊCH SỬ EMAIL RIÊNG BIỆT (TOÀN VĂN, RÕ NÉT, KHÔNG CẮT, KHÔNG CHE)            */}
        {/* ========================================================================================= */}
        {activeTab === 'history-email' && (
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-slate-50/50 space-y-4">
            
            {/* Thanh công cụ quản lý lịch sử Email */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-teal-50 text-teal-800 flex items-center justify-center font-bold">
                  <Inbox className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                    Nhật Ký Thư Điện Tử Y Tế ({filteredEmailLogs.length} bản ghi)
                  </h4>
                  <p className="text-2xs text-slate-500">
                    Toàn bộ thư điện tử và bản sao đơn thuốc đã gửi tới hòm thư: <strong className="text-slate-800 font-mono">{email}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Tìm theo tiêu đề, lời dặn..."
                    className="pl-8 pr-3 py-1 bg-slate-50 border border-slate-300 rounded text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 w-48 sm:w-64"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('email')}
                  className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                >
                  <Send className="w-3 h-3 text-slate-300" />
                  <span>+ Soạn Email Mới</span>
                </button>
              </div>
            </div>

            {/* Danh sách Email (Toàn bộ nội dung hiển thị rõ nét) */}
            {filteredEmailLogs.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-lg border border-slate-200 text-slate-500 text-xs">
                Chưa có lịch sử thư điện tử nào phù hợp với bộ lọc.
              </div>
            ) : (
              <div className="space-y-3.5">
                {filteredEmailLogs.map((log) => (
                  <div
                    key={log.id}
                    className="bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition overflow-hidden"
                  >
                    {/* Header Strip */}
                    <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-3 text-slate-700 flex-wrap">
                        <span className="font-mono font-bold text-slate-900 flex items-center gap-1">
                          <Mail className="w-3 h-3 text-teal-700" />
                          <span>{log.recipientEmail}</span>
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="flex items-center gap-1 text-slate-500">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{formatLogTimestamp(log.createdAt)}</span>
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="text-slate-500 font-medium">Cổng: {log.provider}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {log.deliveryReceipt || log.id}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>ĐÃ GỬI VÀO HÒM THƯ</span>
                        </span>
                      </div>
                    </div>

                    {/* Body: Tiêu đề thư + Lời dặn Bác sĩ toàn văn không che cắt */}
                    <div className="p-4 space-y-3">
                      {/* Tiêu đề thư */}
                      <div className="p-2.5 bg-slate-100/70 rounded-lg border border-slate-200 text-xs">
                        <span className="font-semibold text-slate-600">Tiêu đề thư (Subject): </span>
                        <strong className="text-slate-900 font-medium">{log.subject}</strong>
                      </div>

                      {/* Đơn thuốc tóm tắt */}
                      {log.medicationsSummary && (
                        <div className="p-2.5 bg-teal-50/50 rounded-lg border border-teal-200/60 text-xs text-teal-900 flex items-center gap-2">
                          <FileCode className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                          <span>Đơn thuốc đính kèm: <strong>{log.medicationsSummary}</strong> (Mã đơn: {log.orderId || orderId || 'RX-2026-604'})</span>
                        </div>
                      )}

                      {/* Toàn bộ nội dung thư & Lời dặn */}
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                          <span>Toàn bộ nội dung thư &amp; Lời dặn Bác sĩ:</span>
                          <span className="font-mono text-slate-400 font-normal">{log.adviceContent.length} ký tự</span>
                        </div>

                        <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 font-sans text-sm text-slate-900 leading-relaxed whitespace-pre-wrap break-words select-text">
                          {log.adviceContent}
                        </div>
                      </div>

                      {/* Footer card */}
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleCopyText(log.adviceContent, log.id)}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded flex items-center gap-1 cursor-pointer transition"
                        >
                          {copiedId === log.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
                          <span>{copiedId === log.id ? 'Đã sao chép!' : 'Sao chép nội dung'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEmailAdvice(log.adviceContent);
                            setEmailSubject(log.subject);
                            setActiveTab('email');
                          }}
                          className="px-2.5 py-1 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded flex items-center gap-1 cursor-pointer transition"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Nạp vào ô gửi Email</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================================= */}
        {/* PHẦN 3D: TAB CÀI ĐẶT CỔNG PHÁT TIN (GOOGLE APPS SCRIPT WEBHOOK & eSMS API KEY)            */}
        {/* ========================================================================================= */}
        {activeTab === 'settings' && (
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-slate-50/50 space-y-5">
            
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                <Settings className="w-4 h-4 text-teal-700" />
                <span>Cài Đặt Cổng Phát Tin &amp; Hạ Tầng Thông Báo Y Tế</span>
              </h4>
              <p className="text-xs text-slate-500">
                Quản lý các khóa kết nối (API Key, Webhook URL) tới các nhà cung cấp hạ tầng viễn thông và thư điện tử y tế.
              </p>
            </div>

            {settingsNotice && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-emerald-900 text-xs flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{settingsNotice}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              {/* KHỐI 1: CỔNG EMAIL GOOGLE APPS SCRIPT WEBHOOK */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3.5 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
                      <Mail className="w-4 h-4 text-teal-700" />
                      <span>1. Cổng Email: Google Apps Script Webhook (0đ)</span>
                    </div>
                    {gasUrl ? (
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>Đã cấu hình</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Chưa có link</span>
                      </span>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-700">
                        URL Web App Google Apps Script:
                      </label>
                      <a
                        href="https://script.google.com"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-semibold text-teal-700 hover:text-teal-900 inline-flex items-center gap-1 underline cursor-pointer"
                      >
                        <span>Mở script.google.com lấy link</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <input
                      type="url"
                      value={gasUrl}
                      onChange={(e) => {
                        const val = e.target.value;
                        setGasUrl(val);
                        setStoredGasWebhookUrl(val);
                      }}
                      placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400"
                    />
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 space-y-1.5 leading-relaxed">
                    <div className="font-semibold text-slate-800 flex items-center gap-1">
                      <HelpCircle className="w-3.5 h-3.5 text-sky-600" />
                      <span>Các bước lấy link Web App từ Google Apps Script:</span>
                    </div>
                    <ol className="list-decimal list-inside space-y-1 text-slate-600 pl-1 text-[11px]">
                      <li>Truy cập <a href="https://script.google.com" target="_blank" rel="noreferrer" className="text-teal-700 underline font-semibold">script.google.com</a> và tạo <strong>New Project</strong>.</li>
                      <li>Dán mã nguồn từ tệp <code className="bg-slate-200 px-1 py-0.2 rounded font-mono text-[10px]">scripts/google_apps_script_reminder.gs</code>.</li>
                      <li>Bấm <strong>Deploy</strong> &gt; <strong>New deployment</strong> &gt; Chọn <strong>Web app</strong> (Execute as: <strong>Me</strong>, Access: <strong>Anyone</strong>).</li>
                      <li>Sao chép URL Web App và dán vào ô bên trên.</li>
                    </ol>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">Cước phí: 0đ (Sử dụng hạn ngạch Gmail miễn phí)</span>
                  <a
                    href="https://script.google.com"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition"
                  >
                    <span>Truy cập script.google.com</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* KHỐI 2: CỔNG SMS VIỄN THÔNG eSMS BRANDNAME */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3.5 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
                      <Radio className="w-4 h-4 text-teal-700" />
                      <span>2. Cổng SMS: eSMS.vn Brandname</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      <span>Sẵn sàng phát sóng</span>
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-700">
                        eSMS API Key:
                      </label>
                      <a
                        href="https://esms.vn/Manage/ApiKey"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-semibold text-teal-700 hover:text-teal-900 inline-flex items-center gap-1 underline cursor-pointer"
                      >
                        <span>Mở esms.vn/Manage/ApiKey lấy Key</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <input
                      type="text"
                      value={esmsApiKey}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEsmsApiKey(val);
                        setStoredEsmsApiKey(val);
                      }}
                      placeholder="Nhập API Key eSMS..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      eSMS Secret Key:
                    </label>
                    <input
                      type="password"
                      value={esmsSecretKey}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEsmsSecretKey(val);
                        setStoredEsmsSecretKey(val);
                      }}
                      placeholder="••••••••••••••••"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      SMS Brandname (Tên thương hiệu bệnh viện):
                    </label>
                    <input
                      type="text"
                      value={esmsBrandname}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEsmsBrandname(val);
                        setStoredEsmsBrandname(val);
                      }}
                      placeholder="BV_LAMSANG"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 font-semibold"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">Chuẩn: Thông tư 26/2025/TT-BYT &amp; NĐ 91/2020</span>
                  <a
                    href="https://esms.vn/Manage/ApiKey"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition"
                  >
                    <span>Truy cập esms.vn</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* 4. Footer Nút Hành Động Chuẩn Workstation */}
        <div className="px-6 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-600 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>
              {activeTab === 'sms' && (
                <>Kênh phát tin: <strong className="text-slate-900">Tin nhắn SMS Brandname</strong></>
              )}
              {activeTab === 'email' && (
                <>Kênh phát tin: <strong className="text-slate-900">Thư điện tử (Email)</strong></>
              )}
              {activeTab === 'history-sms' && (
                <>Đang xem: <strong className="text-slate-900">Lịch sử tin nhắn SMS</strong> ({logs.length} bản ghi)</>
              )}
              {activeTab === 'history-email' && (
                <>Đang xem: <strong className="text-slate-900">Lịch sử thư điện tử Email</strong> ({emailLogs.length} bản ghi)</>
              )}
              {activeTab === 'settings' && (
                <>Đang xem: <strong className="text-slate-900">Cài đặt Cổng Tin Nhắn &amp; Email Y Tế</strong></>
              )}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-100 rounded-lg text-xs sm:text-sm font-semibold text-slate-700 cursor-pointer transition"
            >
              Đóng
            </button>

            {/* Nút gửi ở các tab Soạn thảo */}
            {(activeTab === 'sms' || activeTab === 'email') && (
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={status === 'sending'}
                data-testid="btn-submit-send-sms"
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-60 transition active:scale-98"
              >
                {status === 'sending' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-slate-300" />
                    <span>{activeTab === 'sms' ? 'Đang phát sóng...' : 'Đang gửi email...'}</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 text-slate-300" />
                    <span>{activeTab === 'sms' ? 'Gửi Tin Nhắn SMS' : 'Gửi Email Cho Bệnh Nhân'}</span>
                  </>
                )}
              </button>
            )}

            {/* Nút quay lại soạn thảo khi ở các tab Lịch sử */}
            {activeTab === 'history-sms' && (
              <button
                type="button"
                onClick={() => setActiveTab('sms')}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2 cursor-pointer shadow-xs transition"
              >
                <Send className="w-4 h-4 text-slate-300" />
                <span>+ Soạn Tin SMS Mới</span>
              </button>
            )}

            {activeTab === 'history-email' && (
              <button
                type="button"
                onClick={() => setActiveTab('email')}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2 cursor-pointer shadow-xs transition"
              >
                <Send className="w-4 h-4 text-slate-300" />
                <span>+ Soạn Email Mới</span>
              </button>
            )}

            {/* Nút lưu cấu hình khi ở tab Cài đặt */}
            {activeTab === 'settings' && (
              <button
                type="button"
                onClick={() => {
                  setStoredGasWebhookUrl(gasUrl);
                  setStoredEsmsApiKey(esmsApiKey);
                  setStoredEsmsSecretKey(esmsSecretKey);
                  setStoredEsmsBrandname(esmsBrandname);
                  setSettingsNotice('Đã lưu cấu hình cổng Google Apps Script và eSMS thành công!');
                  setTimeout(() => setSettingsNotice(null), 3000);
                }}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2 cursor-pointer shadow-xs transition active:scale-98"
              >
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Lưu Cấu Hình Cổng</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
