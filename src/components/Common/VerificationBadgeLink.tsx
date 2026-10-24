/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Huy hiệu Link Kiểm Chứng Y Tế Thủ Công (Verification Badge Link) (<=200 LOC)
 * Tự động hiển thị khi kiểm thử, tự động ẩn khi tắt chế độ kiểm chứng
 */

import React from 'react';
import { ExternalLink, ShieldCheck, BookOpen, Globe, FileText, Scale } from 'lucide-react';
import { isVerificationLinksVisible } from '../../config/clinicalVerification';

export type VerificationSourceType = 'dav' | 'nidqc' | 'fda' | 'law' | 'pdf' | 'generic';

interface VerificationBadgeLinkProps {
  href: string;
  label: string;
  sourceType?: VerificationSourceType;
  subLabel?: string;
  className?: string;
  title?: string;
}

const SOURCE_CONFIG: Record<VerificationSourceType, { icon: React.ComponentType<{ className?: string }>; style: string; defaultTitle: string }> = {
  dav: {
    icon: ShieldCheck,
    style: 'bg-emerald-50 text-emerald-800 border-emerald-200/70 hover:bg-emerald-100',
    defaultTitle: 'Mở Cổng Dịch vụ công Cục Quản lý Dược (Bộ Y Tế) để đối soát số đăng ký',
  },
  nidqc: {
    icon: BookOpen,
    style: 'bg-teal-50 text-teal-800 border-teal-200/70 hover:bg-teal-100',
    defaultTitle: 'Tra cứu chuyên luận Dược thư Quốc gia Việt Nam (Viện Kiểm nghiệm Thuốc TW)',
  },
  fda: {
    icon: Globe,
    style: 'bg-blue-50 text-blue-800 border-blue-200/70 hover:bg-blue-100',
    defaultTitle: 'Tra cứu nhãn SPL, tá dược và Boxed Warning trên US FDA DailyMed',
  },
  law: {
    icon: Scale,
    style: 'bg-amber-50 text-amber-900 border-amber-200/70 hover:bg-amber-100',
    defaultTitle: 'Mở văn bản quy phạm pháp luật y tế Bộ Y Tế (Thư viện Pháp luật)',
  },
  pdf: {
    icon: FileText,
    style: 'bg-rose-50 text-rose-800 border-rose-200/70 hover:bg-rose-100',
    defaultTitle: 'Xem tài liệu Tờ hướng dẫn sử dụng gốc lưu hành',
  },
  generic: {
    icon: ExternalLink,
    style: 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100',
    defaultTitle: 'Mở liên kết kiểm chứng dữ liệu thủ công',
  },
};

export function useVerificationLinksVisible(): boolean {
  const [visible, setVisible] = React.useState(isVerificationLinksVisible());
  React.useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<boolean>;
      setVisible(customEvent.detail !== undefined ? customEvent.detail : isVerificationLinksVisible());
    };
    window.addEventListener('clinical-verification-toggle', handler);
    return () => window.removeEventListener('clinical-verification-toggle', handler);
  }, []);
  return visible;
}

export const VerificationBadgeLink: React.FC<VerificationBadgeLinkProps> = ({
  href,
  label,
  sourceType = 'generic',
  subLabel,
  className = '',
  title,
}) => {
  const visible = useVerificationLinksVisible();
  // Khi hoàn thiện sản phẩm: ẩn hoàn toàn nếu tắt cờ kiểm chứng
  if (!visible) return null;

  const conf = SOURCE_CONFIG[sourceType] || SOURCE_CONFIG.generic;
  const IconComp = conf.icon;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title || conf.defaultTitle}
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-semibold border transition-all cursor-pointer shadow-2xs group ${conf.style} ${className}`}
    >
      <IconComp className="w-3 h-3 shrink-0" />
      <span className="truncate max-w-[160px]">{label}</span>
      {subLabel && <span className="text-3xs opacity-80 font-normal">({subLabel})</span>}
      <ExternalLink className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100 transition shrink-0 ml-0.5" />
    </a>
  );
};

export const VerificationPanelSection: React.FC<{
  sdk?: string;
  innName: string;
  brandName?: string;
  legalBasis?: string;
}> = ({ sdk, innName, brandName, legalBasis }) => {
  const visible = useVerificationLinksVisible();
  if (!visible) return null;

  return (
    <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-bold text-slate-800 flex items-center gap-1.5 text-2xs uppercase tracking-wider">
          <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
          Liên kết kiểm chứng y tế thủ công (Đối soát nguồn gốc):
        </span>
        <span className="text-3xs font-mono text-slate-400">Kiểm thử lâm sàng</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <VerificationBadgeLink
          href="https://dichvucong.dav.gov.vn/congbothuoc/index"
          label={sdk ? `DAV: SĐK ${sdk}` : 'Cổng Dược DAV'}
          sourceType="dav"
        />
        <VerificationBadgeLink
          href={`https://nidqc.org.vn/?s=${encodeURIComponent(innName.split('(')[0].trim())}`}
          label={`Dược Thư QG: ${innName.split('(')[0].trim()}`}
          sourceType="nidqc"
        />
        <VerificationBadgeLink
          href={`https://dailymed.nlm.nih.gov/dailymed/search.cfm?labeltype=all&query=${encodeURIComponent(innName.split('(')[0].trim())}`}
          label="US FDA SPL (DailyMed)"
          sourceType="fda"
        />
        {legalBasis && (
          <VerificationBadgeLink
            href={legalBasis.includes('20') ? 'https://thuvienphapluat.vn/van-ban/The-thao-Y-te/Thong-tu-20-2017-TT-BYT-huong-dan-Luat-duoc-ve-thuoc-va-nguyen-lieu-lam-thuoc-phai-kiem-soat-dac-biet-349884.aspx' : 'https://thuvienphapluat.vn/van-ban/The-thao-Y-te/Thong-tu-51-2017-TT-BYT-huong-dan-phong-chan-doan-va-xu-tri-phan-ve-372138.aspx'}
            label={legalBasis.slice(0, 24)}
            sourceType="law"
          />
        )}
      </div>
    </div>
  );
};
