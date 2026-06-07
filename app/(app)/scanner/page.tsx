import { RunScannerButton } from "@/components/scanner-actions";
import { EmptyState, PageHeader, Card, SeverityStripe, StatusPill } from "@/components/ui";
import { getActiveTripSnapshot, summarizeSnapshot } from "@/lib/data";
import { money } from "@/lib/utils";

export default async function ScannerPage() {
  const snapshot = await getActiveTripSnapshot();
  const summary = summarizeSnapshot(snapshot);

  if (!snapshot.trip) {
    return (
      <>
        <PageHeader title="Scheduling Intelligence" eyebrow="Scanner needs accepted booking records" />
        <EmptyState title="No trip to scan" description="Upload and accept booking candidates before running Marco Scanner." />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Scheduling Intelligence"
        eyebrow={`${snapshot.trip.name} · ${snapshot.issues.length} active issues`}
        actions={snapshot.isDemo ? undefined : <RunScannerButton />}
      />

      <Card className="mb-6 p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-widest text-slate-500">Conflicts by Severity</p>
            <p className="mt-2 text-sm">High: {summary.readiness.highCount}</p>
            <p className="text-sm">Medium: {summary.readiness.mediumCount}</p>
            <p className="text-sm">Low: {summary.readiness.lowCount}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-widest text-slate-500">By Status</p>
            <p className="mt-2 text-sm">Unresolved: {snapshot.issues.filter((issue) => issue.status === "unresolved").length}</p>
            <p className="text-sm">Resolved: {snapshot.issues.filter((issue) => issue.status === "resolved").length}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-widest text-slate-500">Financial Exposure</p>
            <p className="mt-2 text-2xl font-black">{money(summary.exposure.currentBooked, summary.exposure.currency)}</p>
            <p className="text-sm text-red-600">Conflicting: {money(summary.exposure.conflicting, summary.exposure.currency)}</p>
          </div>
        </div>
      </Card>

      <section className="space-y-3">
        <h2 className="font-display text-3xl font-bold">Active Issues</h2>
        {snapshot.issues.length === 0 ? (
          <Card className="p-6 text-sm text-slate-500">No scanner issues yet. Run a full scan after accepting booking records.</Card>
        ) : (
          snapshot.issues.map((issue) => (
            <Card key={issue.id} className="flex overflow-hidden">
              <SeverityStripe severity={issue.severity} />
              <div className="flex flex-1 flex-col gap-3 p-5 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill tone={issue.severity === "high" || issue.severity === "critical" ? "red" : issue.severity === "medium" ? "gold" : "blue"}>
                      {issue.severity}
                    </StatusPill>
                    <StatusPill>{issue.category.replace("_", " ")}</StatusPill>
                  </div>
                  <h3 className="mt-3 text-lg font-black">{issue.title}</h3>
                  <p className="mt-1 text-sm text-slate-500">{issue.summary}</p>
                  {issue.recommended_action && <p className="mt-2 text-sm font-semibold text-ink">→ {issue.recommended_action}</p>}
                </div>
                <StatusPill tone="red">{issue.status.replace("_", " ")}</StatusPill>
              </div>
            </Card>
          ))
        )}
      </section>
    </>
  );
}
