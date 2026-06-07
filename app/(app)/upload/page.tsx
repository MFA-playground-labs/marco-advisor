import { CandidateCard } from "@/components/booking-card";
import { MarcoChat } from "@/components/marco-chat";
import { UploadPanel } from "@/components/upload-panel";
import { Card, PageHeader, StatusPill } from "@/components/ui";
import { getActiveTripSnapshot } from "@/lib/data";

export default async function UploadPage() {
  const snapshot = await getActiveTripSnapshot();
  const pending = snapshot.candidates.filter((candidate) => candidate.status === "needs_review");

  return (
    <>
      <PageHeader title="Upload" eyebrow="PDFs, screenshots, documents, and exported email confirmations" />
      <div className="grid gap-6 xl:grid-cols-[1fr_390px]">
        <div className="space-y-6">
          <UploadPanel />
          <section className="space-y-3">
            <h2 className="font-display text-3xl font-bold">Review Queue</h2>
            {pending.length === 0 ? (
              <Card className="p-6 text-sm text-slate-500">No extracted candidates are waiting for review.</Card>
            ) : (
              pending.map((candidate) => <CandidateCard key={candidate.id} candidate={candidate} />)
            )}
          </section>
        </div>
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="font-display text-2xl font-bold">Pipeline State</h2>
            <div className="mt-4 space-y-3">
              {snapshot.uploads.length === 0 ? (
                <p className="text-sm text-slate-500">Upload evidence to start extraction.</p>
              ) : (
                snapshot.uploads.map((upload) => (
                  <div key={upload.id} className="flex items-center justify-between border-t border-line pt-3 text-sm">
                    <span className="min-w-0 truncate font-semibold">{upload.filename}</span>
                    <StatusPill>{upload.status}</StatusPill>
                  </div>
                ))
              )}
            </div>
          </Card>
          <MarcoChat />
        </div>
      </div>
    </>
  );
}
