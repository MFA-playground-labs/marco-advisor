import { AlertTriangle, CalendarClock, Hotel, ListChecks } from "lucide-react";
import Link from "next/link";
import { FinancialPanel } from "@/components/financial-panel";
import { EmptyState, MetricCard, PageHeader, Card, StatusPill } from "@/components/ui";
import { getActiveTripSnapshot, summarizeSnapshot } from "@/lib/data";
import { dateRange } from "@/lib/utils";

export default async function DashboardPage() {
  const snapshot = await getActiveTripSnapshot();
  const summary = summarizeSnapshot(snapshot);

  if (!snapshot.trip) {
    return (
      <>
        <PageHeader title="Dashboard" eyebrow="No active trip yet" />
        <EmptyState
          title="Start with real trip evidence"
          description="Upload a PDF, document, screenshot, or exported email confirmation. Marco will extract booking candidates and wait for your review before rendering trip intelligence."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Dashboard" eyebrow={`${snapshot.trip.name} · ${dateRange(snapshot.trip.starts_on, snapshot.trip.ends_on)}`} />

      <section className="mb-6 overflow-hidden rounded-lg bg-ink text-white shadow-card">
        <div className="bg-[linear-gradient(90deg,rgba(23,34,50,.96),rgba(23,34,50,.72)),url('/prototype%20images/Screenshot%202026-06-07%20at%2010.44.12%E2%80%AFAM.png')] bg-cover bg-center p-8">
          <p className="text-sm font-black uppercase tracking-widest text-gold">Active Trip</p>
          <h2 className="mt-3 font-display text-5xl font-bold">{snapshot.trip.name}</h2>
          <p className="mt-2 text-slate-300">{snapshot.trip.destination ?? "Destination TBD"} · {dateRange(snapshot.trip.starts_on, snapshot.trip.ends_on)}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <StatusPill tone="green">{summary.confirmedCount} confirmed</StatusPill>
            <StatusPill tone="gold">{summary.pendingReviewCount} need review</StatusPill>
            <StatusPill tone="red">{summary.conflictsCount} conflicts</StatusPill>
            <StatusPill tone="blue">{snapshot.uploads.length} uploads</StatusPill>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={ListChecks} label="Total Bookings" value={snapshot.bookings.length} tone="blue" />
        <MetricCard icon={CalendarClock} label="Readiness" value={`${summary.readiness.score}%`} detail={summary.readiness.label} tone={summary.readiness.score > 70 ? "green" : "red"} />
        <MetricCard icon={AlertTriangle} label="Conflicts" value={summary.conflictsCount} detail="to resolve" tone="red" />
        <MetricCard icon={Hotel} label="Hotel Records" value={snapshot.bookings.filter((booking) => booking.type === "hotel").length} tone="gold" />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_390px]">
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-sm font-black uppercase tracking-widest text-slate-500">Trip Readiness</p>
                <div className="mt-2 flex items-end gap-3">
                  <span className="text-6xl font-black text-red-600">{summary.readiness.score}%</span>
                  <span className="pb-2 text-lg font-black text-red-600">{summary.readiness.label}</span>
                </div>
                <p className="mt-4 text-sm text-slate-600">
                  {summary.readiness.highCount} high · {summary.readiness.mediumCount} medium · {summary.readiness.lowCount} low issues from current scan.
                </p>
              </div>
              <AlertTriangle className="text-red-500" />
            </div>
            <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-red-500" style={{ width: `${summary.readiness.score}%` }} />
            </div>
            <Link href="/scanner" className="mt-5 inline-block text-sm font-black text-ink">
              Open full scanner →
            </Link>
          </Card>

          <div>
            <h2 className="mb-4 font-display text-3xl font-bold">Next Actions</h2>
            {snapshot.issues.length === 0 ? (
              <Card className="p-6 text-sm text-slate-500">Run the scanner after accepting extracted bookings to generate next actions.</Card>
            ) : (
              <div className="space-y-3">
                {snapshot.issues.slice(0, 5).map((issue) => (
                  <Card key={issue.id} className="border-red-100 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-black">{issue.title}</h3>
                        <p className="mt-1 text-sm text-slate-500">{issue.summary}</p>
                      </div>
                      <StatusPill tone={issue.severity === "high" || issue.severity === "critical" ? "red" : "gold"}>{issue.severity}</StatusPill>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <FinancialPanel exposure={summary.exposure} />
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold">Recent Uploads</h2>
              <Link href="/upload" className="text-sm font-black">Upload →</Link>
            </div>
            <div className="mt-4 space-y-3">
              {snapshot.uploads.length === 0 ? (
                <p className="text-sm text-slate-500">No uploaded trip evidence yet.</p>
              ) : (
                snapshot.uploads.slice(0, 5).map((upload) => (
                  <div key={upload.id} className="flex items-center justify-between border-t border-line pt-3 text-sm">
                    <span className="font-semibold">{upload.filename}</span>
                    <StatusPill>{upload.status}</StatusPill>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </section>
    </>
  );
}
