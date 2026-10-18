import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { X, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

export const STATUS = {
  open: { label: 'Open', cls: 'bg-paper-200 text-ink-800' },
  in_progress: { label: 'In progress', cls: 'bg-teal-50 text-teal-700' },
  blocked: { label: 'Blocked', cls: 'bg-amber-50 text-amber-600' },
  resolved: { label: 'Resolved', cls: 'bg-teal-600 text-white' },
  closed: { label: 'Closed', cls: 'bg-ink-800 text-paper-100' },
};
export const PRIORITY = {
  low: { label: 'Low', cls: 'text-ink-700', bar: 'bg-paper-300' },
  medium: { label: 'Medium', cls: 'text-ink-800', bar: 'bg-ink-300' },
  high: { label: 'High', cls: 'text-amber-600', bar: 'bg-amber-500' },
  critical: { label: 'Critical', cls: 'text-alert-600', bar: 'bg-alert-600' },
};
export const CATEGORIES = ['task', 'customer_issue', 'incident', 'payment', 'compliance', 'approval', 'engineering'];
export const label = (s) => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

export const StatusBadge = ({ status }) => (
  <span className={`inline-block whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium ${STATUS[status].cls}`}>{STATUS[status].label}</span>
);
export const PriorityMark = ({ priority }) => (
  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${PRIORITY[priority].cls}`}>
    <span className={`h-2.5 w-1 rounded-sm ${PRIORITY[priority].bar}`} aria-hidden />{PRIORITY[priority].label}
  </span>
);

export const Spinner = ({ className = '' }) => <Loader2 className={`animate-spin ${className}`} size={16} aria-label="Loading" />;
export const Skeleton = ({ className = '' }) => <div className={`animate-pulse rounded bg-paper-200 ${className}`} />;

export function LogoMark({ size = 28, light }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill={light ? '#17352c' : '#101916'} />
      <path d="M10 26V6" stroke="#f7f5ef" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M10 7c9 3 12 9 12 15H10" fill="none" stroke="#2f9e78" strokeWidth="2.4" strokeLinejoin="round" />
      <circle cx="10" cy="6" r="2" fill="#f7f5ef" />
    </svg>
  );
}
export function Logo({ light, compact }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark light={light} />
      {!compact && <span className={`font-display text-xl font-semibold tracking-tight ${light ? 'text-paper-100' : 'text-ink-900'}`}>Halyard</span>}
    </span>
  );
}

export function useCountUp(target, ms = 600) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (target == null) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setV(target); return; }
    let raf; const t0 = performance.now();
    const tick = (t) => { const p = Math.min(1, (t - t0) / ms); setV(Math.round(target * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}
export const Count = ({ n }) => <span className="tnum">{useCountUp(n)}</span>;

export function Field({ label: l, error, children, htmlFor }) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>{l}</label>
      {children}
      {error && <p role="alert" className="mt-1 text-xs text-alert-600">{error}</p>}
    </div>
  );
}

export function Empty({ title, hint, action }) {
  return (
    <div className="px-6 py-14 text-center">
      <p className="font-display text-lg">{title}</p>
      {hint && <p className="mx-auto mt-1 max-w-sm text-sm text-ink-700">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div role="alert" className="m-4 flex items-start gap-3 rounded-md border border-alert-600/30 bg-alert-50 p-4 text-sm">
      <AlertTriangle size={18} className="mt-0.5 text-alert-600" />
      <div className="flex-1"><p className="font-medium">{error?.message || 'Something went wrong'}</p></div>
      {onRetry && <button className="btn-ghost" onClick={onRetry}>Retry</button>}
    </div>
  );
}

export function Modal({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    ref.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink-950/50 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title}
        className="fade-in max-h-[92vh] w-full overflow-y-auto rounded-t-xl bg-paper-50 p-5 shadow-xl sm:max-w-lg sm:rounded-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl">{title}</h2>
          <button className="rounded p-1 hover:bg-paper-200" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({ title, message, confirmLabel = 'Confirm', onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-sm text-ink-700">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-danger" disabled={busy} onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); } }}>{busy && <Spinner />}{confirmLabel}</button>
      </div>
    </Modal>
  );
}

const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, kind = 'ok') => {
    const id = Math.random();
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'ok' ? 3000 : 6000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex w-[min(92vw,22rem)] flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="fade-in flex items-start gap-2 rounded-md bg-ink-900 px-3.5 py-3 text-sm text-paper-50 shadow-lg">
            {t.kind === 'ok' ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-teal-500" /> : <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-500" />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
export const fmtTime = (d) => new Date(d).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export const isOverdue = (i) => i.dueDate && i.dueDate.slice(0, 10) < new Date().toISOString().slice(0, 10) && ['open', 'in_progress', 'blocked'].includes(i.status);
