import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, ArrowRight, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import type { IssueSeverity } from "@/lib/types";

export function PageHeader({
  title,
  eyebrow,
  actions
}: {
  title: string;
  eyebrow?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="font-display text-4xl font-bold tracking-normal text-ink">{title}</h1>
        {eyebrow && <p className="mt-1 text-sm font-medium text-slate-500">{eyebrow}</p>}
      </div>
      {actions}
    </header>
  );
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn("rounded-lg border border-line bg-white shadow-card", className)}>{children}</section>;
}

export function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  tone = "blue"
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  detail?: string;
  tone?: "blue" | "purple" | "red" | "gold" | "green";
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-600",
    purple: "bg-violet-50 text-violet-600",
    red: "bg-red-50 text-red-600",
    gold: "bg-amber-50 text-amber-600",
    green: "bg-emerald-50 text-emerald-600"
  };
  return (
    <Card className="flex min-h-28 items-center gap-4 p-5">
      <span className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-lg", tones[tone])}>
        <Icon size={22} />
      </span>
      <span>
        <span className="block text-3xl font-black">{value}</span>
        <span className="block text-sm font-bold">{label}</span>
        {detail && <span className="block text-sm text-slate-500">{detail}</span>}
      </span>
    </Card>
  );
}

export function EmptyState({
  title,
  description,
  actionHref = "/upload",
  actionLabel = "Upload documents"
}: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <Card className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-lg bg-amber-50 text-amber-600">
        <Upload size={26} />
      </div>
      <h2 className="mt-5 font-display text-3xl font-bold">{title}</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">{description}</p>
      <Link href={actionHref} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-bold text-white">
        {actionLabel}
        <ArrowRight size={16} />
      </Link>
    </Card>
  );
}

export function StatusPill({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "red" | "gold" | "green" | "blue" | "purple" }) {
  const tones = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    red: "border-red-200 bg-red-50 text-red-700",
    gold: "border-amber-200 bg-amber-50 text-amber-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    purple: "border-violet-200 bg-violet-50 text-violet-700"
  };
  return <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold", tones[tone])}>{children}</span>;
}

export function SeverityStripe({ severity }: { severity: IssueSeverity }) {
  const colors = {
    critical: "bg-red-600",
    high: "bg-orange-500",
    medium: "bg-amber-400",
    low: "bg-blue-500"
  };
  return <span className={cn("h-full w-1.5 rounded-l-lg", colors[severity])} />;
}

export function AlertNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <AlertTriangle className="mt-0.5 shrink-0" size={18} />
      <div>{children}</div>
    </div>
  );
}
