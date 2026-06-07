import { Plus } from "lucide-react";
import Link from "next/link";
import { BookingCard, CandidateCard } from "@/components/booking-card";
import { EmptyState, PageHeader, StatusPill } from "@/components/ui";
import { getActiveTripSnapshot } from "@/lib/data";

export default async function BookingsPage() {
  const snapshot = await getActiveTripSnapshot();

  if (!snapshot.trip) {
    return (
      <>
        <PageHeader title="Booking Manager" eyebrow="Upload trip documents to create reviewable records" />
        <EmptyState title="No bookings yet" description="Marco only creates booking records from uploaded evidence or manual entries you confirm." />
      </>
    );
  }

  const pending = snapshot.candidates.filter((candidate) => candidate.status === "needs_review");

  return (
    <>
      <PageHeader
        title="Booking Manager"
        eyebrow={`${snapshot.trip.name} · ${snapshot.bookings.length} bookings · ${pending.length} need review`}
        actions={
          <Link href="/upload" className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-black text-white">
            <Plus size={16} />
            Add evidence
          </Link>
        }
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <StatusPill>All {snapshot.bookings.length}</StatusPill>
        <StatusPill tone="gold">Needs Review {pending.length}</StatusPill>
        <StatusPill tone="green">Confirmed {snapshot.bookings.filter((booking) => booking.status === "confirmed").length}</StatusPill>
        <StatusPill tone="red">Conflicts {snapshot.issues.filter((issue) => issue.category === "double_booking").length}</StatusPill>
      </div>

      <section className="space-y-4">
        {pending.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-display text-3xl font-bold">Review Extracted Candidates</h2>
            {pending.map((candidate) => <CandidateCard key={candidate.id} candidate={candidate} />)}
          </div>
        )}

        <div className="space-y-3">
          <h2 className="font-display text-3xl font-bold">Confirmed Bookings</h2>
          {snapshot.bookings.length === 0 ? (
            <EmptyState
              title="Review candidates to create bookings"
              description="Accepted extraction candidates will appear here and become the source for dashboard, timeline, scanner, and itinerary logic."
              actionHref="/upload"
              actionLabel="Upload more evidence"
            />
          ) : (
            snapshot.bookings.map((booking) => <BookingCard key={booking.id} booking={booking} />)
          )}
        </div>
      </section>
    </>
  );
}
