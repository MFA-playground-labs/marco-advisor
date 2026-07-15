import Link from "next/link";
import { Card, EmptyState, PageHeader, StatusPill } from "@/components/ui";
import { getPipelineSnapshot } from "@/lib/data";
import { confidenceCategory } from "@/lib/domain/review-quality";

export default async function PipelinePage() {
  const snapshot = await getPipelineSnapshot();

  if (!snapshot.trip) {
    return (
      <>
        <PageHeader title="Pipeline" eyebrow="Upload, extraction, review, and booking flow" />
        <EmptyState title="No pipeline data yet" description="Upload evidence to create an extraction job." />
      </>
    );
  }

  const report = summarizeExtractionOperations(snapshot.jobs);

  return (
    <>
      <PageHeader
        title="Pipeline"
        eyebrow={`${snapshot.trip.name} · ${snapshot.uploads.length} uploads · ${snapshot.jobs.length} extraction jobs`}
        actions={
          <Link href="/upload" className="rounded-lg bg-ink px-4 py-2 text-sm font-black text-white">
            Add evidence
          </Link>
        }
      />

      <section className="space-y-4">
        <div className="grid gap-3 md:grid-cols-5">
          <Metric label="Queued" value={report.queued} />
          <Metric label="Processing" value={report.processing} />
          <Metric label="Stale" value={report.staleProcessing} tone={report.staleProcessing > 0 ? "red" : "slate"} />
          <Metric label="Failed" value={report.failed} tone={report.failed > 0 ? "red" : "slate"} />
          <Metric label="Warnings" value={report.warningCount} tone={report.warningCount > 0 ? "gold" : "slate"} />
        </div>

        {snapshot.uploads.length === 0 ? (
          <Card className="p-6 text-sm text-slate-500">Upload evidence to see the ingestion flow.</Card>
        ) : (
          snapshot.uploads.map((upload) => {
            const jobs = snapshot.jobs.filter((job) => job.upload_id === upload.id);
            const candidates = snapshot.candidates.filter((candidate) => candidate.upload_id === upload.id);
            const bookings = snapshot.bookings.filter((booking) => booking.source_upload_id === upload.id);

            return (
              <Card key={upload.id} className="p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-lg font-black">{upload.filename}</h2>
                      <StatusPill>{upload.status}</StatusPill>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{upload.id}</p>
                    <p className="mt-2 text-sm text-slate-600">{upload.content_type}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <StatusPill tone="blue">{jobs.length} jobs</StatusPill>
                    <StatusPill tone="gold">{candidates.length} candidates</StatusPill>
                    <StatusPill tone="green">{bookings.length} bookings</StatusPill>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 xl:grid-cols-3">
                  <div>
                    <h3 className="text-sm font-black uppercase text-slate-500">Extraction Jobs</h3>
                    <div className="mt-3 space-y-3">
                      {jobs.length === 0 ? (
                        <p className="text-sm text-slate-500">No job recorded.</p>
                      ) : (
                        jobs.map((job) => {
                          const pages = snapshot.pages.filter((page) => page.job_id === job.id);
                          const jobCandidates = candidates.filter((candidate) => candidate.source_job_id === job.id);
                          const warnings = job.warnings ?? [];
                          return (
                            <div key={job.id} className="rounded-lg border border-line p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <StatusPill tone={job.status === "succeeded" ? "green" : job.status === "failed" ? "red" : "blue"}>
                                  {job.status}
                                </StatusPill>
                                <span className="text-xs font-bold text-slate-500">{job.provider ?? "openai"}</span>
                              </div>
                              <p className="mt-2 break-all text-xs text-slate-500">{job.id}</p>
                              <p className="mt-2 text-sm text-slate-600">
                                {pages.length} extracted pages · {jobCandidates.length} candidates
                              </p>
                              <dl className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                                <Detail label="Trace" value={job.trace_id} />
                                <Detail label="Attempt" value={job.attempt_id} />
                                <Detail label="Stage" value={job.last_stage} />
                                <Detail label="Model" value={job.model} />
                                <Detail label="Provider request" value={job.provider_request_id} />
                                <Detail label="Latency" value={formatLatency(job.provider_latency_ms)} />
                                <Detail label="Usage" value={formatUsage(job.provider_usage)} />
                                <Detail label="Retryable" value={isRetryableJob(job) ? "Yes" : "No"} />
                              </dl>
                              {job.error_message && (
                                <p className={job.status === "failed" ? "mt-2 text-sm font-semibold text-red-600" : "mt-2 text-sm font-semibold text-amber-700"}>
                                  {job.error_message}
                                </p>
                              )}
                              {warnings.length > 0 && (
                                <ul className="mt-2 space-y-1 text-sm font-semibold text-amber-700">
                                  {warnings.map((warning) => (
                                    <li key={warning}>{warning}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-black uppercase text-slate-500">Review Candidates</h3>
                    <div className="mt-3 space-y-3">
                      {candidates.length === 0 ? (
                        <p className="text-sm text-slate-500">No candidates yet.</p>
                      ) : (
                        candidates.map((candidate) => {
                          const confidence = confidenceCategory(candidate.confidence);
                          return (
                            <div key={candidate.id} className="rounded-lg border border-line p-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <StatusPill tone={candidate.status === "accepted" ? "green" : candidate.status === "rejected" ? "red" : "gold"}>
                                  {candidate.status.replace("_", " ")}
                                </StatusPill>
                                <StatusPill tone={confidence.tone}>
                                  {confidence.label} · {Math.round(candidate.confidence * 100)}%
                                </StatusPill>
                              </div>
                              <h4 className="mt-2 font-black">{candidate.title}</h4>
                              <p className="mt-1 text-sm text-slate-500">{candidate.vendor ?? "Vendor TBD"}</p>
                              {candidate.source_pages && candidate.source_pages.length > 0 && (
                                <p className="mt-2 text-xs font-bold text-slate-500">Pages {candidate.source_pages.join(", ")}</p>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-black uppercase text-slate-500">Accepted Records</h3>
                    <div className="mt-3 space-y-3">
                      {bookings.length === 0 ? (
                        <p className="text-sm text-slate-500">Accepted candidates will appear as bookings.</p>
                      ) : (
                        bookings.map((booking) => (
                          <div key={booking.id} className="rounded-lg border border-line p-3">
                            <StatusPill tone="green">{booking.status}</StatusPill>
                            <h4 className="mt-2 font-black">{booking.title}</h4>
                            <p className="mt-1 text-sm text-slate-500">{booking.vendor}</p>
                          </div>
                        ))
                      )}
                      <div className="flex flex-wrap gap-2 pt-2">
                        <Link href="/bookings" className="text-sm font-black text-ink">Bookings</Link>
                        <Link href="/dashboard" className="text-sm font-black text-ink">Dashboard</Link>
                        <Link href="/timeline" className="text-sm font-black text-ink">Timeline</Link>
                        <Link href="/itinerary" className="text-sm font-black text-ink">Itinerary</Link>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </section>
    </>
  );
}

function Metric({
  label,
  value,
  tone = "slate"
}: {
  label: string;
  value: number;
  tone?: "slate" | "gold" | "red";
}) {
  const toneClass = tone === "red" ? "text-red-600" : tone === "gold" ? "text-amber-700" : "text-slate-900";
  return (
    <div className="rounded-lg border border-line bg-white px-4 py-3">
      <p className="text-xs font-black uppercase text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-black ${toneClass}`}>{value}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="font-black uppercase text-slate-400">{label}</dt>
      <dd className="mt-0.5 break-all font-semibold text-slate-700">{value || "Not recorded"}</dd>
    </div>
  );
}

function summarizeExtractionOperations(jobs: Awaited<ReturnType<typeof getPipelineSnapshot>>["jobs"]) {
  return {
    queued: jobs.filter((job) => job.status === "queued").length,
    processing: jobs.filter((job) => job.status === "processing").length,
    staleProcessing: jobs.filter((job) => job.status === "processing" && isStaleProcessingJob(job.started_at)).length,
    failed: jobs.filter((job) => job.status === "failed").length,
    warningCount: jobs.reduce((count, job) => count + (job.warnings?.length ?? 0), 0)
  };
}

function isRetryableJob(job: Awaited<ReturnType<typeof getPipelineSnapshot>>["jobs"][number]) {
  if (job.status === "queued" || job.status === "failed") return true;
  return job.status === "processing" && isStaleProcessingJob(job.started_at);
}

function isStaleProcessingJob(startedAt: string | null | undefined) {
  if (!startedAt) return true;
  const startedAtMs = Date.parse(startedAt);
  if (!Number.isFinite(startedAtMs)) return true;
  return Date.now() - startedAtMs >= 15 * 60 * 1000;
}

function formatLatency(ms: number | null | undefined) {
  if (ms === null || ms === undefined) return null;
  return `${ms} ms`;
}

function formatUsage(usage: unknown) {
  if (!usage || typeof usage !== "object") return null;
  const values = Object.entries(usage as Record<string, unknown>)
    .filter(([, value]) => typeof value === "number" || typeof value === "string")
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${value}`);
  return values.length > 0 ? values.join(" · ") : null;
}
