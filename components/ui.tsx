"use client";

import { useEffect, useId } from "react";
import { AlertTriangle, Inbox, Loader2, X } from "lucide-react";

export function Card({ children, className = "", ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`card ${className}`} {...rest}>{children}</div>;
}

export function Panel({ title, eyebrow, action, children, className = "", style }: {
  title?: string; eyebrow?: string; action?: React.ReactNode; children: React.ReactNode; className?: string; style?: React.CSSProperties;
}) {
  return (
    <section className={`surface panel ${className}`} style={style}>
      {(title || action || eyebrow) && (
        <header className="panel-head">
          <div>
            {eyebrow && <span className="eyebrow">{eyebrow}</span>}
            {title && <h2 className="section-title" style={{ marginTop: eyebrow ? 4 : 0 }}>{title}</h2>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ eyebrow, title, subtitle, actions }: {
  eyebrow?: string; title: string; subtitle?: string; actions?: React.ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: {
  icon?: React.ReactNode; title: string; description: string; action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">{icon ?? <Inbox size={20} />}</span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="alert alert-danger" role="alert">
      <AlertTriangle size={16} style={{ flex: "none" }} />
      <div style={{ flex: 1 }}>
        <strong>Could not load your data.</strong>
        <div style={{ marginTop: 3 }}>{message}</div>
      </div>
      {retry && <button className="btn btn-sm" onClick={retry}>Retry</button>}
    </div>
  );
}

export function LoadingState({ label = "Loading your workspace…", rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div role="status" aria-live="polite">
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--muted)", fontSize: 12, marginBottom: 12 }}>
        <Loader2 size={14} className="spin" /> {label}
      </div>
      <div className="stack">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="skeleton" style={{ height: 74, borderRadius: 16 }} />
        ))}
      </div>
    </div>
  );
}

export function Modal({ title, onClose, children, wide = false, footer }: {
  title: string; onClose: () => void; children: React.ReactNode; wide?: boolean; footer?: React.ReactNode;
}) {
  const titleId = useId();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className={`modal ${wide ? "modal-wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <button className="btn btn-ghost btn-icon" aria-label="Close dialog" onClick={onClose}><X size={16} /></button>
        </div>
        {children}
        {footer && <div className="no-print" style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, hint, error, children }: {
  label: string; hint?: string; error?: string; children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error" role="alert">{error}</span>}
    </label>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T; options: { value: T; label: string }[]; onChange: (value: T) => void; label: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function ProgressBar({ value, tone }: { value: number; tone?: "success" | "warning" | "danger" }) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <div className={`progress ${tone ?? ""}`} role="progressbar" aria-valuenow={Math.round(clamped)} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${clamped}%` }} />
    </div>
  );
}

export function RiskBadge({ risk }: { risk: "safe" | "warning" | "at_risk" | "unknown" }) {
  if (risk === "at_risk") return <span className="badge badge-danger">At risk</span>;
  if (risk === "warning") return <span className="badge badge-warning">Watch</span>;
  if (risk === "safe") return <span className="badge badge-success">On track</span>;
  return <span className="badge">Not enough data</span>;
}

export function StatCard({ label, value, foot, icon, progress, tone }: {
  label: string; value: React.ReactNode; foot?: string; icon?: React.ReactNode; progress?: number; tone?: "success" | "warning" | "danger";
}) {
  return (
    <div className="surface stat">
      <div className="stat-top"><span>{label}</span>{icon && <span className="stat-icon">{icon}</span>}</div>
      <div className="stat-value mono">{value}</div>
      {foot && <div className="stat-foot">{foot}</div>}
      {progress !== undefined && <div style={{ marginTop: 12 }}><ProgressBar value={progress} tone={tone} /></div>}
    </div>
  );
}

export function ConfirmDialog({ title, message, confirmLabel = "Confirm", onConfirm, onCancel, danger = false }: {
  title: string; message: string; confirmLabel?: string; onConfirm: () => void; onCancel: () => void; danger?: boolean;
}) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={<>
        <button className="btn" onClick={onCancel}>Cancel</button>
        <button className={`btn ${danger ? "btn-danger" : "btn-primary"}`} onClick={onConfirm}>{confirmLabel}</button>
      </>}
    >
      <p className="muted" style={{ fontSize: 13, lineHeight: 1.7 }}>{message}</p>
    </Modal>
  );
}
