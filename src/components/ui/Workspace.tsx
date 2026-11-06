import React from 'react';
import { createPortal } from 'react-dom';
import { Search, X, ArrowUpRight } from 'lucide-react';

/** Page actions stay owned by their page while rendering in the single shared header. */
export function PageHeaderAction({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = React.useState<HTMLElement | null>(null);
  React.useLayoutEffect(() => {
    setTarget(document.getElementById('workspace-page-actions'));
  }, []);
  return target ? createPortal(children, target) : null;
}

export function SearchField({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
}) {
  return (
    <div className="workspace-search">
      <Search size={18} aria-hidden="true" />
      <input
        type="search"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {value && (
        <button
          type="button"
          aria-label={`Xóa ${label.toLowerCase()}`}
          onClick={() => onChange('')}
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="workspace-empty">
      <Search size={26} strokeWidth={1.4} />
      <p>{title}</p>
      {description && <span>{description}</span>}
    </div>
  );
}

export function TextAction({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" className="text-action" onClick={onClick}>
      {children}
      <ArrowUpRight size={16} />
    </button>
  );
}
