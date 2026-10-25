/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Huy hiệu Link Kiểm Chứng Y Tế Thủ Công (Verification Badge Link) (<=200 LOC)
 * Thiết kế tối giản, sạch sẽ, triệt tiêu icon rác theo chuẩn Anti-AI Slop
 */

import React from 'react';
import { ExternalLink } from 'lucide-react';
import {
  isVerificationLinksVisible,
  getDavRegistryUrl,
  getDailyMedFdaUrl,
  getRegulatoryLawUrl,
} from '../../config/clinicalVerification';

export type VerificationSourceType = 'dav' | 'nidqc' | 'fda' | 'law' | 'pdf' | 'generic';

interface VerificationBadgeLinkProps {
  href: string;
  label: string;
  sourceType?: VerificationSourceType;
  subLabel?: string;
  className?: string;
  title?: string;
}

const SOURCE_CONFIG: Record<VerificationSourceType, { style: string; defaultTitle: string }> = {
  dav: {
    style: 'bg-emerald-50/80 text-emerald-800 border-emerald-200/80 hover:bg-emerald-100',
    defaultTitle: 'Cục Quản lý Dược (Bộ Y Tế) - Công bố Đăng ký lưu hành thuốc & SĐK',
  },
  nidqc: {
    style: 'bg-teal-50/80 text-teal-800 border-teal-200/80 hover:bg-teal-100',
    defaultTitle: 'Cổng Viện Kiểm nghiệm Thuốc TW (NIDQC - Bộ Y Tế) - Cơ quan biên soạn Dược thư QG',
  },
  fda: {
    style: 'bg-blue-50/80 text-blue-800 border-blue-200/80 hover:bg-blue-100',
    defaultTitle: 'Thư viện Y khoa Quốc gia Hoa Kỳ (NIH) - Cơ sở dữ liệu nhãn SPL US FDA DailyMed',
  },
  law: {
    style: 'bg-amber-50/80 text-amber-900 border-amber-200/80 hover:bg-amber-100',
    defaultTitle: 'Cổng Thông tin Điện tử Chính Phủ (vanban.chinhphu.vn) - Văn bản QPPL y tế',
  },
  pdf: {
    style: 'bg-rose-50/80 text-rose-800 border-rose-200/80 hover:bg-rose-100',
    defaultTitle: 'Xem tài liệu Tờ hướng dẫn sử dụng gốc lưu hành',
  },
  generic: {
    style: 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100',
    defaultTitle: 'Mở liên kết đối soát dữ liệu y tế chính thống',
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
  if (!visible) return null;

  const conf = SOURCE_CONFIG[sourceType] || SOURCE_CONFIG.generic;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title || conf.defaultTitle}
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer shadow-2xs group ${conf.style} ${className}`}
    >
      <span className="truncate max-w-[200px]">{label}</span>
      {subLabel && <span className="text-2xs opacity-75 font-normal">({subLabel})</span>}
      <ExternalLink className="w-3 h-3 opacity-50 group-hover:opacity-100 transition shrink-0 ml-0.5" />
    </a>
  );
};

export const VerificationPanelSection: React.FC<{
  sdk?: string;
  innName: string;
  brandName?: string;
  legalBasis?: string;
}> = ({ sdk, innName, legalBasis }) => {
  const visible = useVerificationLinksVisible();
  if (!visible) return null;

  const cleanInn = innName.split('(')[0].trim();

  return (
    <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-700 tracking-tight">
          Đối soát nguồn y tế chính thống:
        </span>
        <span className="text-2xs text-slate-400">Kiểm chứng lâm sàng</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <VerificationBadgeLink
          href={getDavRegistryUrl(sdk, innName)}
          label={sdk ? `Cục Quản lý Dược (${sdk})` : 'Cục Quản lý Dược (Bộ Y tế)'}
          sourceType="dav"
        />
        <VerificationBadgeLink
          href={getDailyMedFdaUrl(cleanInn)}
          label="Cơ sở dữ liệu FDA (Mỹ)"
          sourceType="fda"
        />
        {legalBasis && (
          <VerificationBadgeLink
            href={getRegulatoryLawUrl(legalBasis)}
            label="Cổng VBQPPL Chính Phủ"
            subLabel={legalBasis.slice(0, 22)}
            sourceType="law"
          />
        )}
      </div>
    </div>
  );
};
