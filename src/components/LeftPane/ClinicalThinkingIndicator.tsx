import React, { useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';

interface ClinicalThinkingIndicatorProps {
  isWebSearch?: boolean;
  query?: string;
}

const INTERNAL_STEPS = [
  'Đang phân tích câu hỏi lâm sàng...',
  'Đang tra cứu Dược thư Quốc gia & văn bản Bộ Y tế...',
  'Đang đối soát căn cứ, liều dùng & chống chỉ định...',
  'Đang tổng hợp khuyến cáo lâm sàng...',
];

const WEB_STEPS = [
  'Đang phân tích câu hỏi & từ khóa y khoa...',
  'Đang tìm kiếm nguồn y khoa chính thống trên Web...',
  'Đang đọc toàn văn bài viết & trích xuất dữ liệu...',
  'Đang tổng hợp & kiểm định số liệu an toàn...',
];

export const ClinicalThinkingIndicator: React.FC<ClinicalThinkingIndicatorProps> = ({
  isWebSearch = false,
}) => {
  const steps = isWebSearch ? WEB_STEPS : INTERNAL_STEPS;
  const [stepIdx, setStepIdx] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    setStepIdx(0);
    setElapsedSec(0);
    const stepThresholds = [2, 5, 9];
    const timer = window.setInterval(() => {
      setElapsedSec((prev) => {
        const next = prev + 1;
        let nextIdx = 0;
        for (let i = 0; i < stepThresholds.length; i++) {
          if (next >= stepThresholds[i]) nextIdx = i + 1;
        }
        setStepIdx(Math.min(nextIdx, steps.length - 1));
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isWebSearch, steps.length]);

  return (
    <div
      data-testid="clinical-thinking-indicator"
      className="py-1.5 space-y-2.5 max-w-md"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 text-slate-600">
        <LoaderCircle className="w-4 h-4 text-teal-700 animate-spin shrink-0" />
        <span className="text-xs sm:text-sm font-medium text-slate-700">
          {steps[stepIdx]}
        </span>
        {elapsedSec >= 2 && (
          <span className="text-[11px] font-mono text-slate-400 tabular-nums shrink-0">
            {elapsedSec}s
          </span>
        )}
      </div>
      <div className="space-y-1.5 pl-6">
        <div className="h-2 w-4/5 rounded-full bg-slate-100" />
        <div className="h-2 w-3/5 rounded-full bg-slate-100/80" />
      </div>
    </div>
  );
};
