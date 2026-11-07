"use client";
import Link from "next/link";
import { AlertTriangle, Info, Loader2, Lock, ShieldCheck, FlaskConical, RefreshCw, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiError, describeError } from "@/lib/api";

/* ---------- Buttons ---------- */
type Variant = "primary" | "secondary" | "ghost" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-teal-600 text-white hover:bg-teal-700 disabled:bg-teal-600/50",
  secondary: "bg-white text-navy border border-navy/20 hover:bg-mist/60 disabled:opacity-50",
  ghost: "text-navy hover:bg-navy/5 disabled:opacity-50",
  danger: "bg-danger text-white hover:bg-danger/90 disabled:opacity-50",
};
interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant; size?: "sm" | "md" | "lg"; loading?: boolean; icon?: LucideIcon; href?: string;
}
export function Button({ variant = "primary", size = "md", loading, icon: Icon, href, className, children, disabled, ...rest }: BtnProps) {
  const cls = cn(
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed",
    size === "sm" ? "px-3 py-1.5 text-sm" : size === "lg" ? "px-6 py-3.5 text-base" : "px-4 py-2.5 text-sm",
    variants[variant], className,
  );
  const inner = (<>{loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : Icon ? <Icon className="h-4 w-4" aria-hidden /> : null}{children}</>);
  if (href && !disabled) return <Link href={href} className={cls}>{inner}</Link>;
  return <button className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>{inner}</button>;
}

/* ---------- Surfaces ---------- */
export function Card({ className, children, as: Tag = "div", ...rest }: React.HTMLAttributes<HTMLElement> & { as?: "div" | "section" | "article" | "li" }) {
  return <Tag className={cn("rounded-xl2 border border-navy/10 bg-white p-5 shadow-card", className)} {...rest}>{children}</Tag>;
}

export function Badge({ tone = "neutral", icon: Icon, children, className }: { tone?: "neutral" | "teal" | "navy" | "amber" | "danger" | "mist"; icon?: LucideIcon; children: React.ReactNode; className?: string }) {
  const tones = {
    neutral: "bg-ivory-200 text-navy", teal: "bg-teal-700 text-white", navy: "bg-navy text-white",
    amber: "bg-amber-50 text-amber-700 border border-amber-700/20", danger: "bg-danger-50 text-danger", mist: "bg-mist text-teal-700",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone], className)}>{Icon && <Icon className="h-3 w-3" aria-hidden />}{children}</span>;
}

type NoticeTone = "info" | "privacy" | "warn" | "danger" | "mock";
export function Notice({ tone = "info", title, children, className }: { tone?: NoticeTone; title?: string; children: React.ReactNode; className?: string }) {
  const map = {
    info: { Icon: Info, box: "bg-mist/70 border-teal/30", icon: "text-teal-700" },
    privacy: { Icon: Lock, box: "bg-mist/70 border-teal/30", icon: "text-teal-700" },
    warn: { Icon: AlertTriangle, box: "bg-amber-50 border-amber-700/25", icon: "text-amber-700" },
    danger: { Icon: AlertTriangle, box: "bg-danger-50 border-danger/30", icon: "text-danger" },
    mock: { Icon: FlaskConical, box: "bg-amber-50 border-amber-700/25", icon: "text-amber-700" },
  }[tone];
  return (
    <div role={tone === "danger" ? "alert" : "note"} className={cn("flex gap-3 rounded-xl border p-3.5 text-sm", map.box, className)}>
      <map.Icon className={cn("mt-0.5 h-4 w-4 shrink-0", map.icon)} aria-hidden />
      <div className="min-w-0">{title && <p className="font-semibold">{title}</p>}<div className="text-navy/85">{children}</div></div>
    </div>
  );
}

/** Small inline privacy hint shown next to actions that share data. */
export function PrivacyHint({ children }: { children: React.ReactNode }) {
  return <p className="flex items-start gap-1.5 text-xs text-navy/70"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-700" aria-hidden />{children}</p>;
}

/* ---------- States ---------- */
export function Spinner({ label = "Loading" }: { label?: string }) {
  return <span role="status" className="inline-flex items-center gap-2 text-sm text-navy/70"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />{label}…</span>;
}
export function LoadingBlock({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl2 bg-navy/5" />)}
    </div>
  );
}
export function EmptyState({ icon: Icon, title, children, action }: { icon?: LucideIcon; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl2 border border-dashed border-navy/20 bg-white/60 p-8 text-center">
      {Icon && <Icon className="mx-auto mb-3 h-8 w-8 text-teal" aria-hidden />}
      <p className="font-display text-lg font-semibold">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-md text-sm text-navy/75">{children}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { title, hint } = describeError(error);
  return (
    <div role="alert" className="rounded-xl2 border border-danger/30 bg-danger-50 p-5">
      <p className="flex items-center gap-2 font-semibold text-danger"><AlertTriangle className="h-4 w-4" aria-hidden />{title}</p>
      <p className="mt-1 text-sm text-navy/85">{hint}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {error instanceof ApiError && error.status === 401 && <Button size="sm" href="/login">Sign in</Button>}
        {onRetry && <Button variant="secondary" size="sm" icon={RefreshCw} onClick={onRetry}>Try again</Button>}
      </div>
      {error instanceof ApiError && error.requestId && <p className="mt-2 text-xs text-navy/60">Reference: {error.requestId}</p>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-navy/75">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

/* ---------- Form controls ---------- */
export const inputCls = "w-full rounded-xl border border-navy/25 bg-white px-3.5 py-2.5 text-sm placeholder:text-navy/50 focus:border-teal focus:outline-none disabled:bg-ivory-200";

export function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">{label}</label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="mt-1 text-xs text-navy/70">{hint}</p>}
      {error && <p id={`${id}-err`} role="alert" className="mt-1 text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}

export function Switch({ checked, onChange, label, description, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; id: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-semibold">{label}</label>
        {description && <p id={`${id}-d`} className="text-xs text-navy/70">{description}</p>}
      </div>
      <button id={id} role="switch" aria-checked={checked} aria-describedby={description ? `${id}-d` : undefined} type="button" onClick={() => onChange(!checked)}
        className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", checked ? "bg-teal-600" : "bg-navy/30")}>
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", checked ? "left-[22px]" : "left-0.5")} />
      </button>
    </div>
  );
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} className="h-2 w-full overflow-hidden rounded-full bg-mist">
      <div className="h-full rounded-full bg-teal transition-all" style={{ width: `${value}%` }} />
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: Array<{ id: T; label: string; count?: number }>; value: T; onChange: (t: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto rounded-xl bg-navy/5 p-1">
      {tabs.map((t) => (
        <button key={t.id} role="tab" id={`tab-${t.id}`} aria-selected={value === t.id} aria-controls={`panel-${t.id}`} type="button" onClick={() => onChange(t.id)}
          className={cn("whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors", value === t.id ? "bg-white shadow-card" : "text-navy/70 hover:text-navy")}>
          {t.label}{t.count !== undefined && <span className="ml-1.5 text-xs text-navy/60">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
