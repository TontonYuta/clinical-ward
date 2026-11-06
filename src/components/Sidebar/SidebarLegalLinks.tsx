import React from 'react';
import { ClipboardList, Scale, BookOpen, Printer, Pill } from 'lucide-react';
interface SidebarLegalLinksProps {
  isCollapsed: boolean;
  onCloseMobile?: () => void;
  onOpenAuditTrail: () => void;
  onOpenLegalDocs: () => void;
  onOpenUserGuide: () => void;
  onOpenPrintableForms?: () => void;
  onOpenMedicationSafety?: () => void;
}
export const SidebarLegalLinks: React.FC<SidebarLegalLinksProps> = (props) => {
  const links = [
    { label: 'Tra cứu thuốc', icon: Pill, action: props.onOpenMedicationSafety },
    { label: 'Nhật ký hoạt động', icon: ClipboardList, action: props.onOpenAuditTrail },
    { label: 'Văn bản & tài liệu', icon: Scale, action: props.onOpenLegalDocs },
    { label: 'Biểu mẫu', icon: Printer, action: props.onOpenPrintableForms },
    { label: 'Hướng dẫn', icon: BookOpen, action: props.onOpenUserGuide },
  ];
  return (
    <nav aria-label="Tra cứu và tiện ích">
      {!props.isCollapsed && <p className="sidebar-section-label">Thư viện & tiện ích</p>}
      {links
        .filter((l) => l.action)
        .map(({ label, icon: Icon, action }) => (
          <button
            type="button"
            key={label}
            title={label}
            className={`sidebar-nav-item utility ${props.isCollapsed ? 'justify-center px-0' : ''}`}
            onClick={() => {
              action?.();
              props.onCloseMobile?.();
            }}
          >
            <Icon size={16} strokeWidth={1.6} />
            {!props.isCollapsed && label}
          </button>
        ))}
    </nav>
  );
};
