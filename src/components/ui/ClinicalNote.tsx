import React from 'react';
import { AlertOctagon, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
export type NoteSeverity = 'danger' | 'warning' | 'info' | 'success';
const icons = { danger: AlertOctagon, warning: AlertTriangle, info: Info, success: CheckCircle2 };
export function ClinicalNote({
  severity,
  title,
  children,
  action,
  className = '',
}: {
  severity: NoteSeverity;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  const Icon = icons[severity];
  return (
    <section
      className={`clinical-note ${className}`}
      data-severity={severity}
      role={severity === 'danger' ? 'alert' : 'status'}
    >
      <Icon size={20} strokeWidth={1.9} aria-hidden="true" />
      <div className="clinical-note-content">
        <h3>{title}</h3>
        {children && <div className="clinical-note-body">{children}</div>}
        {action && <div className="clinical-note-action">{action}</div>}
      </div>
    </section>
  );
}
