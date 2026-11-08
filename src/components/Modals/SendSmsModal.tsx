/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Modal Gửi Thông Báo Bệnh Nhân Chuẩn Workstation Kho Dược / CPOE (TT 26/2025/TT-BYT)
 * Tự chọn lịch tự động gửi đa kênh (Gửi ngay vs Hẹn lịch thông minh)
 * Loại bỏ toàn bộ cài đặt API Key/Webhook (chuyển giao 100% cho Monitor quản lý)
 * Loại bỏ khung giả lập điện thoại, dọn dẹp tinh giản chuẩn y tế - TUYỆT ĐỐI KHÔNG DÙNG ICON.
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

export type NotificationModalTab = 'sms' | 'email' | 'history' | 'history-sms' | 'history-email';

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

  // 3 Tab nghiệp vụ thuần túy: sms | email | history
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
    `[BV ĐA KHOA LÂM SÀNG] Đơn thuốc điện tử & Hướng dẫn điều trị - Mã đơn ${orderId || 'RX-2026-604'}`
  );
  const [emailAdvice, setEmailAdvice] = useState(
    'Uống thuốc đúng cữ theo toa, uống nhiều nước ấm. Nếu có biểu hiện sốt cao kéo dài hoặc dị ứng, tái khám ngay.'
  );
  const [emailLogs, setEmailLogs] = useState<EmailDeliveryReceipt[]>(() => getStoredEmailLogs(effectiveId));
  const [emailSentSuccess, setEmailSentSuccess] = useState(false);
  const [emailSentReceipt, setEmailSentReceipt] = useState<SendAdviceEmailResponse | null>(null);

  // Trạng thái Lịch Tự Động Gửi (Scheduled Auto-Send)
  const [dispatchMode, setDispatchMode] = useState<DispatchMode>('immediate');
  const [scheduleTimingType, setScheduleTimingType] = useState<ScheduleTimingType>('specific_time');
  
  // Mặc định ngày mai 08:00
  const defaultTomorrowIso = useMemo(() => {
    const tm = new Date(Date.now() + 86400000);
    tm.setHours(8, 0, 0, 0);
    return tm.toISOString().slice(0, 16);
  }, []);
  const [scheduledDatetime, setScheduledDatetime] = useState<string>(defaultTomorrowIso);
  const [selectedMedSlots, setSelectedMedSlots] = useState<{ morning: boolean; noon: boolean; evening: boolean; bedtime: boolean }>({
    morning: true,
    noon: true,
    evening: true,
    bedtime: false,
  });
  const [recurringDays, setRecurringDays] = useState<number>(7);

  // Trạng thái chung
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [historyChannelFilter, setHistoryChannelFilter] = useState<'all' | 'sms' | 'email' | 'scheduled'>('all');

  // Tải dữ liệu khi mở modal
  useEffect(() => {
    if (isOpen) {
      setPhone(effectivePhone);
      setEmail(effectiveEmail);
      setStatus('idle');
      setReceipt(null);
      setEmailSentSuccess(false);
      setEmailSentReceipt(null);
      setErrorMessage(null);
      setDispatchMode('immediate');
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

  // Tính toán số ký tự và phân đoạn tin SMS
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

  // Chuyển sang không dấu để tối ưu số ký tự
  const handleConvertToUnsigned = () => {
    setContent(removeVietnameseTones(content));
  };

  // Chọn nhanh ngày giờ cụ thể
  const handleQuickAddDays = (days: number) => {
    const target = new Date(Date.now() + days * 86400000);
    target.setHours(8, 0, 0, 0);
    setScheduledDatetime(target.toISOString().slice(0, 16));
  };

  // Áp dụng mẫu tin nhắn chuẩn
  const handleApplyTemplate = (tpl: SmsTemplateItem) => {
    setMessageType(tpl.category as SmsMessageType);
    let body = tpl.template;
    body = body.replace(/{patientName}/g, removeVietnameseTones(effectiveName));
    body = body.replace(/{doctorName}/g, cleanDoctorDisplay(doctorName));
    body = body.replace(/{orderId}/g, orderId || 'RX-2026-604');
    body = body.replace(/{patientId}/g, effectiveId);
    setContent(body);
  };

  // Chèn tóm tắt đơn thuốc CPOE vào nội dung
  const handleInsertPrescriptionSnippet = () => {
    const snippet = ` Don thuoc ${orderId || 'RX-2026-604'}: PARACETAMOL 500mg (1v x 2 lan/ngay).`;
    if (activeTab === 'sms') {
      setContent((prev) => prev.trim() + snippet);
    } else {
      setEmailAdvice((prev) => prev.trim() + snippet);
    }
  };

  // Hủy lịch hẹn gửi
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

  // Xử lý gửi tin nhắn hoặc lên lịch
  const handleSend = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const timingRuleStr =
      dispatchMode === 'scheduled'
        ? scheduleTimingType === 'specific_time'
          ? `specific:${scheduledDatetime}`
          : scheduleTimingType === 'medication_routine'
          ? `routine:${Object.entries(selectedMedSlots)
              .filter(([_, v]) => v)
              .map(([k]) => k)
              .join(',')}`
          : `daily:${recurringDays}days`
        : 'immediate';

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
          dispatchMode,
          scheduledAt: dispatchMode === 'scheduled' ? new Date(scheduledDatetime).toISOString() : undefined,
          timingRule: timingRuleStr
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
          endDate: new Date(Date.now() + recurringDays * 86400000).toISOString().split('T')[0],
          generalDoctorAdvice: emailAdvice.trim(),
          medications: medications || [],
          notificationStatus: dispatchMode === 'scheduled' ? 'scheduled' : 'idle',
          dispatchMode,
          scheduledAt: dispatchMode === 'scheduled' ? new Date(scheduledDatetime).toISOString() : undefined,
          timingRule: timingRuleStr
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
            medicationsSummary: 'PARACETAMOL 500mg (1 viên x 2 lần/ngày, 5 ngày)',
            orderId: orderId || 'RX-2026-604',
            provider: res.provider || 'Google Apps Script Webhook',
            status: dispatchMode === 'scheduled' ? 'scheduled' : 'delivered',
            deliveryReceipt:
              dispatchMode === 'scheduled'
                ? `SCHED-MAIL-${Date.now().toString().slice(-6)}`
                : `GAS-MAIL-${Date.now().toString().slice(-6)}`,
            createdAt: new Date().toISOString(),
            dispatchMode,
            scheduledAt: dispatchMode === 'scheduled' ? scheduledDatetime : undefined,
            timingRule: timingRuleStr
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
        setErrorMessage(err.message || 'Lỗi khi chuyển phát thư điện tử');
      }
    }
  };

  // Danh sách lịch sử hỗn hợp gộp chung (SMS + Email)
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
      aria-labelledby="sms-modal-title"
      data-testid="send-sms-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800"
      >
        {/* ========================================================================================= */}
        {/* 1. Header: 3 Tab Nghiệp Vụ Chuẩn Mực - TUYỆT ĐỐI KHÔNG DÙNG ICON                          */}
        {/* ========================================================================================= */}
        <div className="px-4 sm:px-6 py-3 bg-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div>
            <h3 id="sms-modal-title" className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
              Gửi Thông Báo Bệnh Nhân (Thông tư 26/2025/TT-BYT)
            </h3>
            <p className="text-2xs sm:text-xs text-slate-500">
              Hệ thống kết nối tự động tới Cổng SMS Brandname &amp; Thư điện tử Y Tế do Bệnh viện quản lý
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* 3 Tab Navigation - Không icon */}
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                data-testid="tab-compose-sms"
                onClick={() => {
                  setActiveTab('sms');
                  setStatus('idle');
                  setErrorMessage(null);
                }}
                className={`px-3 py-1.5 rounded-md cursor-pointer transition ${
                  activeTab === 'sms'
                    ? 'bg-slate-900 text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-950 hover:bg-slate-200/60'
                }`}
              >
                Soạn SMS
              </button>

              <button
                type="button"
                data-testid="tab-compose-email"
                onClick={() => {
                  setActiveTab('email');
                  setStatus('idle');
                  setErrorMessage(null);
                }}
                className={`px-3 py-1.5 rounded-md cursor-pointer transition ${
                  activeTab === 'email'
                    ? 'bg-slate-900 text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-950 hover:bg-slate-200/60'
                }`}
              >
                Soạn Email
              </button>

              <button
                type="button"
                data-testid="tab-history-sms"
                onClick={() => {
                  setActiveTab('history');
                  setStatus('idle');
                  setErrorMessage(null);
                }}
                className={`px-3 py-1.5 rounded-md cursor-pointer transition flex items-center gap-1.5 ${
                  activeTab === 'history' || activeTab === 'history-sms' || activeTab === 'history-email'
                    ? 'bg-slate-900 text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-950 hover:bg-slate-200/60'
                }`}
              >
                <span>Nhật ký &amp; Lịch hẹn</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    activeTab === 'history' || activeTab === 'history-sms' || activeTab === 'history-email'
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-200 text-slate-800'
                  }`}
                >
                  {logs.length + emailLogs.length}
                </span>
                {scheduledCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950">
                    {scheduledCount} hẹn
                  </span>
                )}
              </button>
            </div>

            {/* Nút đóng modal - Không icon */}
            <button
              onClick={onClose}
              data-testid="btn-close-sms-modal"
              aria-label="Đóng cửa sổ thông báo"
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
            >
              Đóng [ESC]
            </button>
          </div>
        </div>

        {/* ========================================================================================= */}
        {/* 2. Ribbon thông tin hành chính tinh gọn                                                   */}
        {/* ========================================================================================= */}
        <div className="px-4 sm:px-6 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-2xs sm:text-xs shrink-0">
          <div className="flex items-center gap-2 text-slate-700 flex-wrap">
            <span>Bệnh nhân: <strong className="text-slate-900 font-bold">{effectiveName}</strong> ({effectiveId})</span>
            <span className="text-slate-300">|</span>
            <span>Đơn thuốc CPOE: <strong className="font-mono text-slate-900 font-semibold">{orderId || 'RX-2026-604'}</strong></span>
            <span className="text-slate-300">|</span>
            <span>Bác sĩ kê đơn: <strong className="text-slate-800">{cleanDoctorDisplay(doctorName)}</strong></span>
          </div>

          <div className="text-[11px] font-medium text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
            Hạ tầng viễn thông do Clinical AI Monitor quản trị tập trung
          </div>
        </div>

        {/* ========================================================================================= */}
        {/* 3. Phần Soạn Thảo (SMS HOẶC EMAIL) - BỐ CỤC 5 CỘT / 7 CỘT KHÔNG ICON                     */}
        {/* ========================================================================================= */}
        {(activeTab === 'sms' || activeTab === 'email') && (
          <form
            onSubmit={handleSend}
            className="grid grid-cols-1 lg:grid-cols-12 min-h-0 flex-1 overflow-y-auto divide-y lg:divide-y-0 lg:divide-x divide-slate-200"
          >
            {/* CỘT TRÁI (5 CỘT): NGƯỜI NHẬN & MẪU CHUẨN */}
            <div className="lg:col-span-5 p-4 sm:p-5 space-y-4 bg-white overflow-y-auto thin-scrollbar">
              {/* Thông tin người nhận */}
              {activeTab === 'sms' ? (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-800">
                      Số điện thoại người nhận *
                    </label>
                    <span className="font-mono text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
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
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-500 transition"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Email người nhận *
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="huyhoang6altt@gmail.com"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Tiêu đề thư (Subject) *
                    </label>
                    <input
                      type="text"
                      required
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-500 transition font-medium"
                    />
                  </div>
                </div>
              )}

              {/* Thông tin đơn thuốc CPOE liên kết */}
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs flex items-center justify-between gap-2">
                <div className="truncate min-w-0">
                  <div className="font-semibold text-slate-800">
                    Đơn CPOE: <span className="font-mono">{orderId || 'RX-2026-604'}</span>
                  </div>
                  <div className="text-2xs text-slate-500 truncate">{effectiveDiagnosis}</div>
                </div>
                <button
                  type="button"
                  onClick={handleInsertPrescriptionSnippet}
                  className="text-2xs font-bold text-slate-800 bg-white px-2 py-1 rounded border border-slate-300 hover:bg-slate-100 shrink-0 cursor-pointer shadow-2xs transition"
                >
                  + Chèn đơn
                </button>
              </div>

              {/* Mẫu nội dung chuẩn Thông tư 26 */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-800">Mẫu nội dung chuẩn (TT 26):</label>
                  <span className="text-[11px] text-slate-400">Chọn để tự điền</span>
                </div>
                <div className="space-y-1.5">
                  {templates.map((tpl) => {
                    const isSelected = messageType === tpl.category;
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => handleApplyTemplate(tpl)}
                        className={`w-full p-2.5 text-left rounded-lg border transition cursor-pointer text-xs ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="font-bold flex items-center justify-between">
                          <span>{tpl.title}</span>
                          {isSelected && <span className="text-[10px] uppercase font-bold text-emerald-400">[Đang chọn]</span>}
                        </div>
                        <p className={`text-[11px] mt-0.5 line-clamp-2 ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                          {tpl.template}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Cảnh báo lỗi nếu có */}
              {status === 'error' && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-rose-900 text-xs">
                  <span className="font-bold">[LỖI]: </span>
                  <span>{errorMessage || 'Đã xảy ra lỗi khi gửi thông báo, vui lòng kiểm tra lại.'}</span>
                </div>
              )}
            </div>

            {/* CỘT PHẢI (7 CỘT): SOẠN THẢO VÀ LỊCH GỬI TỰ ĐỘNG */}
            <div className="lg:col-span-7 p-4 sm:p-5 space-y-4 bg-white overflow-y-auto thin-scrollbar flex flex-col justify-between">
              <div className="space-y-4">
                {/* Header soạn thảo */}
                <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    {activeTab === 'sms' ? 'Soạn nội dung tin nhắn SMS' : 'Soạn nội dung thư dặn dò Email'}
                  </div>
                  <div className="flex items-center gap-2">
                    {activeTab === 'sms' && isUnicode && (
                      <button
                        type="button"
                        onClick={handleConvertToUnsigned}
                        className="text-[11px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-300 cursor-pointer transition"
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
                      className="text-[11px] font-semibold text-slate-600 hover:text-rose-700 bg-slate-100 hover:bg-rose-50 px-2 py-0.5 rounded border border-slate-300 cursor-pointer transition"
                    >
                      Xóa trắng
                    </button>
                  </div>
                </div>

                {/* Khung nhập liệu (Không còn xem trước điện thoại chiếm chỗ) */}
                <div>
                  {activeTab === 'sms' ? (
                    <textarea
                      rows={5}
                      required
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="Nhập nội dung tin nhắn gửi tới bệnh nhân..."
                      aria-label="Nội dung tin nhắn SMS"
                      className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-500 font-sans leading-relaxed transition resize-y min-h-[120px]"
                    />
                  ) : (
                    <textarea
                      rows={5}
                      required
                      value={emailAdvice}
                      onChange={(e) => setEmailAdvice(e.target.value)}
                      placeholder="Nhập lời dặn dò riêng, hướng dẫn kiêng khem, ăn uống hoặc hẹn tái khám..."
                      aria-label="Nội dung thư gửi bệnh nhân"
                      className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-500 font-sans leading-relaxed transition resize-y min-h-[120px]"
                    />
                  )}

                  {/* Thanh đo ký tự tinh giản bằng text (Không icon) */}
                  {activeTab === 'sms' && (
                    <div className="flex items-center justify-between text-2xs sm:text-xs text-slate-500 mt-1 px-1">
                      <div>
                        Độ dài: <strong className="text-slate-900 font-mono">{charsCount}</strong> ký tự | Định dạng:{' '}
                        <strong className={isUnicode ? 'text-amber-800' : 'text-emerald-800'}>
                          {isUnicode ? 'Có dấu (UCS-2)' : 'Không dấu (GSM)'}
                        </strong>
                      </div>
                      <div className="font-mono font-bold text-slate-800">
                        {segmentsCount} tin ({charsCount <= maxPerSegment ? `${charsCount}/${maxPerSegment}` : `${segmentsCount} SMS`})
                      </div>
                    </div>
                  )}
                </div>

                {/* =================================================================================== */}
                {/* BẢNG THIẾT LẬP CHẾ ĐỘ PHÁT TIN & LỊCH TỰ ĐỘNG GỬI (KHÔNG DÙNG ICON)                 */}
                {/* =================================================================================== */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-300 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                      Chế độ phát tin &amp; Lịch tự động gửi:
                    </span>
                    <span className="text-2xs text-slate-500 font-medium">
                      {dispatchMode === 'immediate' ? 'Phát sóng tức thì' : 'Hẹn giờ phát sóng'}
                    </span>
                  </div>

                  {/* Bộ chuyển đổi chế độ phát tin: Gửi ngay vs Đặt lịch tự động */}
                  <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setDispatchMode('immediate')}
                      className={`py-2 px-3 rounded-lg border text-center transition cursor-pointer ${
                        dispatchMode === 'immediate'
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      [1] Gửi ngay lập tức (Send Now)
                    </button>

                    <button
                      type="button"
                      onClick={() => setDispatchMode('scheduled')}
                      className={`py-2 px-3 rounded-lg border text-center transition cursor-pointer ${
                        dispatchMode === 'scheduled'
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      [2] Đặt lịch tự động gửi (Schedule)
                    </button>
                  </div>

                  {/* Khi chọn Đặt lịch tự động gửi: Hiển thị bộ công cụ lịch trình chi tiết */}
                  {dispatchMode === 'scheduled' && (
                    <div className="p-3 bg-white rounded-lg border border-slate-300 space-y-3 text-xs">
                      {/* Chọn phương thức hẹn lịch */}
                      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 text-[11px] font-bold">
                        <button
                          type="button"
                          onClick={() => setScheduleTimingType('specific_time')}
                          className={`px-2.5 py-1 rounded transition cursor-pointer ${
                            scheduleTimingType === 'specific_time'
                              ? 'bg-teal-800 text-white font-bold'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          Theo ngày giờ cụ thể
                        </button>
                        <button
                          type="button"
                          onClick={() => setScheduleTimingType('medication_routine')}
                          className={`px-2.5 py-1 rounded transition cursor-pointer ${
                            scheduleTimingType === 'medication_routine'
                              ? 'bg-teal-800 text-white font-bold'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          Theo cữ uống thuốc
                        </button>
                        <button
                          type="button"
                          onClick={() => setScheduleTimingType('daily_recurring')}
                          className={`px-2.5 py-1 rounded transition cursor-pointer ${
                            scheduleTimingType === 'daily_recurring'
                              ? 'bg-teal-800 text-white font-bold'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          Định kỳ hàng ngày
                        </button>
                      </div>

                      {/* Tùy chọn 1: Ngày giờ cụ thể */}
                      {scheduleTimingType === 'specific_time' && (
                        <div className="space-y-2">
                          <label className="block text-2xs font-bold text-slate-700">
                            Chọn ngày và giờ phát tin nhắn tự động:
                          </label>
                          <input
                            type="datetime-local"
                            value={scheduledDatetime}
                            onChange={(e) => setScheduledDatetime(e.target.value)}
                            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded font-mono text-xs text-slate-900 focus:bg-white"
                          />
                          <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[11px]">
                            <span className="text-slate-500 font-medium">Chọn nhanh:</span>
                            <button
                              type="button"
                              onClick={() => handleQuickAddDays(1)}
                              className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded border border-slate-300 font-semibold cursor-pointer"
                            >
                              +1 ngày (Mai)
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuickAddDays(3)}
                              className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded border border-slate-300 font-semibold cursor-pointer"
                            >
                              +3 ngày
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuickAddDays(7)}
                              className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded border border-slate-300 font-semibold cursor-pointer"
                            >
                              +7 ngày (Tái khám)
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuickAddDays(14)}
                              className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded border border-slate-300 font-semibold cursor-pointer"
                            >
                              +14 ngày
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuickAddDays(30)}
                              className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded border border-slate-300 font-semibold cursor-pointer"
                            >
                              +30 ngày
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Tùy chọn 2: Theo cữ uống thuốc trong ngày */}
                      {scheduleTimingType === 'medication_routine' && (
                        <div className="space-y-2">
                          <label className="block text-2xs font-bold text-slate-700">
                            Các cữ phát tin nhắc uống thuốc tự động trong ngày:
                          </label>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <label className="flex items-center gap-2 p-2 rounded border border-slate-200 bg-slate-50 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedMedSlots.morning}
                                onChange={(e) =>
                                  setSelectedMedSlots((prev) => ({ ...prev, morning: e.target.checked }))
                                }
                              />
                              <span>Cữ Sáng (07:30)</span>
                            </label>

                            <label className="flex items-center gap-2 p-2 rounded border border-slate-200 bg-slate-50 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedMedSlots.noon}
                                onChange={(e) =>
                                  setSelectedMedSlots((prev) => ({ ...prev, noon: e.target.checked }))
                                }
                              />
                              <span>Cữ Trưa (11:30)</span>
                            </label>

                            <label className="flex items-center gap-2 p-2 rounded border border-slate-200 bg-slate-50 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedMedSlots.evening}
                                onChange={(e) =>
                                  setSelectedMedSlots((prev) => ({ ...prev, evening: e.target.checked }))
                                }
                              />
                              <span>Cữ Chiều (17:30)</span>
                            </label>

                            <label className="flex items-center gap-2 p-2 rounded border border-slate-200 bg-slate-50 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedMedSlots.bedtime}
                                onChange={(e) =>
                                  setSelectedMedSlots((prev) => ({ ...prev, bedtime: e.target.checked }))
                                }
                              />
                              <span>Cữ Tối (20:30)</span>
                            </label>
                          </div>
                        </div>
                      )}

                      {/* Tùy chọn 3: Định kỳ hàng ngày */}
                      {scheduleTimingType === 'daily_recurring' && (
                        <div className="space-y-2">
                          <label className="block text-2xs font-bold text-slate-700">
                            Số ngày tự động phát tin liên tiếp theo đợt điều trị:
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={1}
                              max={60}
                              value={recurringDays}
                              onChange={(e) => setRecurringDays(Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-24 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded font-mono text-xs font-bold text-slate-900"
                            />
                            <span className="text-xs text-slate-600">ngày (Đồng bộ theo số ngày dùng thuốc của đơn CPOE)</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Thông báo kết quả gửi thành công */}
                {status === 'success' && (
                  <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-emerald-950 text-xs space-y-1">
                    <div className="font-bold">
                      {dispatchMode === 'scheduled'
                        ? '[THÀNH CÔNG] Đã lưu lịch tự động phát tin vào hàng đợi của Bệnh Viện!'
                        : activeTab === 'sms'
                        ? `[THÀNH CÔNG] Đã phát sóng SMS tới SIM ${receipt?.recipientPhone || phone}!`
                        : `[THÀNH CÔNG] Đã chuyển phát Email tới ${email}!`}
                    </div>
                    <div className="font-mono text-[11px] text-emerald-900">
                      Mã biên nhận: {receipt?.deliveryReceipt || receipt?.id || emailSentReceipt?.message || 'OK'}
                    </div>
                  </div>
                )}
              </div>

              {/* Chuyển nhanh sang tab lịch sử */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                <span>
                  Bệnh nhân đã nhận <strong>{logs.length}</strong> SMS và <strong>{emailLogs.length}</strong> Email
                </span>
                <button
                  type="button"
                  data-testid="link-view-all-history"
                  onClick={() => setActiveTab('history')}
                  className="font-bold text-slate-900 underline hover:text-teal-900 cursor-pointer"
                >
                  Xem toàn bộ nhật ký &amp; lịch hẹn ({logs.length + emailLogs.length}) -&gt;
                </button>
              </div>
            </div>
          </form>
        )}

        {/* ========================================================================================= */}
        {/* 4. Tab Nhật Ký & Lịch Hẹn Hợp Nhất (KHÔNG DÙNG ICON)                                      */}
        {/* ========================================================================================= */}
        {(activeTab === 'history' || activeTab === 'history-sms' || activeTab === 'history-email') && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-slate-50/60 space-y-3">
            {/* Thanh công cụ lọc nhật ký */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-3 rounded-lg border border-slate-200 text-xs">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-slate-700">Bộ lọc:</span>
                <button
                  type="button"
                  onClick={() => setHistoryChannelFilter('all')}
                  className={`px-2.5 py-1 rounded text-2xs font-bold transition cursor-pointer ${
                    historyChannelFilter === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Tất cả ({logs.length + emailLogs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryChannelFilter('sms')}
                  className={`px-2.5 py-1 rounded text-2xs font-bold transition cursor-pointer ${
                    historyChannelFilter === 'sms'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Tin nhắn SMS ({logs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryChannelFilter('email')}
                  className={`px-2.5 py-1 rounded text-2xs font-bold transition cursor-pointer ${
                    historyChannelFilter === 'email'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Thư Email ({emailLogs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryChannelFilter('scheduled')}
                  className={`px-2.5 py-1 rounded text-2xs font-bold transition cursor-pointer ${
                    historyChannelFilter === 'scheduled'
                      ? 'bg-amber-600 text-white'
                      : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  Đang hẹn gửi ({scheduledCount})
                </button>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Tìm nội dung, mã biên nhận..."
                  className="w-full sm:w-60 px-3 py-1 bg-slate-50 border border-slate-300 rounded text-xs text-slate-900 focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => setActiveTab('sms')}
                  className="px-3 py-1 bg-slate-900 text-white font-bold rounded text-xs hover:bg-slate-800 transition cursor-pointer whitespace-nowrap"
                >
                  + Soạn Tin Mới
                </button>
              </div>
            </div>

            {/* Danh sách bản ghi */}
            {combinedHistory.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-lg border border-slate-200 text-slate-500 text-xs">
                Không tìm thấy bản ghi thông báo nào phù hợp với bộ lọc hiện tại.
              </div>
            ) : (
              <div className="space-y-2.5">
                {combinedHistory.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-lg border border-slate-200 shadow-2xs hover:border-slate-300 transition overflow-hidden text-xs"
                  >
                    {/* Header Strip */}
                    <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-slate-700 flex-wrap">
                        <span className="font-bold font-mono text-slate-900">
                          [{item.channel.toUpperCase()}] {item.recipient}
                        </span>
                        <span className="text-slate-300">|</span>
                        <span className="text-slate-500">{formatLogTimestamp(item.createdAt)}</span>
                        <span className="text-slate-300">|</span>
                        <span className="text-slate-600">{item.title}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-slate-600 bg-white px-2 py-0.2 rounded border border-slate-200">
                          {item.receiptCode}
                        </span>

                        {item.status === 'scheduled' ? (
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-950 border border-amber-300">
                              ĐÃ LÊN LỊCH: {item.scheduledAt ? formatLogTimestamp(item.scheduledAt) : 'Theo cữ thuốc'}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCancelSchedule(item.id, item.channel)}
                              className="px-2 py-0.5 rounded text-[10px] font-bold bg-white text-rose-700 border border-rose-300 hover:bg-rose-50 cursor-pointer"
                            >
                              [Hủy lịch]
                            </button>
                          </div>
                        ) : item.status === 'cancelled' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-300">
                            ĐÃ HỦY LỊCH
                          </span>
                        ) : item.status === 'failed' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                            LỖI GỬI
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            ĐÃ PHÁT SÓNG
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Nội dung tin nhắn / email */}
                    <div className="p-3 text-slate-800 font-sans leading-relaxed whitespace-pre-wrap select-text">
                      {item.content}
                    </div>

                    {item.timingRule && item.timingRule !== 'immediate' && (
                      <div className="px-3 py-1.5 bg-slate-50/50 border-t border-slate-100 text-[11px] text-slate-500 font-mono">
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
        {/* 5. Footer: Nút Hành Động Rõ Ràng - KHÔNG DÙNG ICON                                        */}
        {/* ========================================================================================= */}
        <div className="px-4 sm:px-6 py-3 bg-white border-t border-slate-200 flex items-center justify-between shrink-0 text-xs">
          <div className="text-slate-600 font-medium">
            Kênh phát tin:{' '}
            <strong className="text-slate-900">
              {activeTab === 'sms'
                ? 'Tin nhắn SMS Brandname'
                : activeTab === 'email'
                ? 'Thư điện tử Email Y Tế'
                : 'Nhật ký & Lịch hẹn'}
            </strong>{' '}
            | Chế độ: <strong className="text-slate-900">{dispatchMode === 'immediate' ? 'Gửi ngay' : 'Hẹn giờ tự động'}</strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-100 rounded-lg font-bold text-slate-700 cursor-pointer transition"
            >
              Đóng
            </button>

            {(activeTab === 'sms' || activeTab === 'email') && (
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={status === 'sending'}
                data-testid="btn-submit-send-sms"
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold cursor-pointer shadow-xs disabled:opacity-60 transition active:scale-98"
              >
                {status === 'sending'
                  ? 'Đang xử lý...'
                  : dispatchMode === 'scheduled'
                  ? activeTab === 'sms'
                    ? 'Lên Lịch Tự Động Gửi SMS'
                    : 'Lên Lịch Tự Động Gửi Email'
                  : activeTab === 'sms'
                  ? 'Gửi Tin Nhắn SMS Ngay'
                  : 'Gửi Email Cho Bệnh Nhân Ngay'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
