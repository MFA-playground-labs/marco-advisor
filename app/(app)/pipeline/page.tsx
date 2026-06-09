import Link from "next/link";
import { Card, EmptyState, PageHeader, StatusPill } from "@/components/ui";
import { getPipelineSnapshot } from "@/lib/data";

export default async function PipelinePage() {
  const snapshot = await getPipelineSnapshot();

  if (!snapshot.trip) {
    return (
      <>
        <PageHeader title="Pipeline" eyebrow="Upload, extraction, review, and booking flow" />
        <EmptyState title="No pipeline data yet" description="Upload a digital PDF or text confirmation to create an extraction job." />
      </>
    );
  }

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
                          return (
                            <div key={job.id} className="rounded-lg border border-line p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <StatusPill tone={job.status === "succeeded" ? "green" : job.status === "failed" ? "red" : "blue"}>
                                  {job.status}
                                </StatusPill>
                                <span className="text-xs font-bold text-slate-500">{job.provider ?? "n8n"}</span>
                              </div>
                              <p className="mt-2 break-all text-xs text-slate-500">{job.id}</p>
                              <p className="mt-2 text-sm text-slate-600">{pages.length} extracted pages</p>
                              {job.error_message && <p className="mt-2 text-sm font-semibold text-red-600">{job.error_message}</p>}
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
                        candidates.map((candidate) => (
                          <div key={candidate.id} className="rounded-lg border border-line p-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <StatusPill tone={candidate.status === "accepted" ? "green" : candidate.status === "rejected" ? "red" : "gold"}>
                                {candidate.status.replace("_", " ")}
                              </StatusPill>
                              <StatusPill tone={candidate.confidence >= 0.85 ? "green" : "red"}>
                                {Math.round(candidate.confidence * 100)}%
                              </StatusPill>
                            </div>
                            <h4 className="mt-2 font-black">{candidate.title}</h4>
                            <p className="mt-1 text-sm text-slate-500">{candidate.vendor ?? "Vendor TBD"}</p>
                            {candidate.source_pages && candidate.source_pages.length > 0 && (
                              <p className="mt-2 text-xs font-bold text-slate-500">Pages {candidate.source_pages.join(", ")}</p>
                            )}
                          </div>
                        ))
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
