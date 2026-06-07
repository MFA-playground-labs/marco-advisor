import type { FinancialExposure } from "@/lib/types";
import { Card, StatusPill } from "@/components/ui";
import { money } from "@/lib/utils";

export function FinancialPanel({ exposure }: { exposure: FinancialExposure }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className="font-display text-2xl font-bold">Financial Exposure</h2>
        <StatusPill>Live</StatusPill>
      </div>
      <div className="space-y-3 p-5">
        <div className="rounded-lg bg-slate-100 p-4">
          <p className="text-xs font-black uppercase tracking-widest text-slate-500">Current Booked Exposure</p>
          <p className="mt-2 text-4xl font-black">{money(exposure.currentBooked, exposure.currency)}</p>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50 p-4 text-red-700">
          <span className="font-bold">Potential duplicate exposure</span>
          <span className="font-black">{money(exposure.conflicting, exposure.currency)}</span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-emerald-700">
          <span className="font-bold">Clean trip estimate</span>
          <span className="font-black">{money(exposure.cleanEstimate, exposure.currency)}</span>
        </div>
        <div className="pt-3">
          <p className="mb-3 text-xs font-black uppercase tracking-widest text-slate-500">Breakdown</p>
          <ExposureRow label="Locked / non-refundable" value={exposure.locked} currency={exposure.currency} tone="text-red-600" />
          <ExposureRow label="Refundable / cancellable" value={exposure.refundable} currency={exposure.currency} tone="text-emerald-600" />
          <ExposureRow label="Conflicting / duplicate" value={exposure.conflicting} currency={exposure.currency} tone="text-red-600" />
          <ExposureRow label="Missing / TBD" value={exposure.missingTbdCount ? null : 0} currency={exposure.currency} tone="text-amber-600" />
        </div>
      </div>
    </Card>
  );
}

function ExposureRow({ label, value, currency, tone }: { label: string; value: number | null; currency: string; tone: string }) {
  return (
    <div className="flex items-center justify-between border-t border-line py-3 text-sm">
      <span className="font-semibold text-slate-700">{label}</span>
      <span className={`font-black ${tone}`}>{value === null ? "TBD" : money(value, currency)}</span>
    </div>
  );
}
