import type { Booking, ExtractedBookingCandidate } from "@/lib/types";
import { Card, StatusPill } from "@/components/ui";
import { dateRange, money } from "@/lib/utils";

export function BookingCard({ booking }: { booking: Booking }) {
  const tone = booking.status === "confirmed" ? "green" : booking.status === "cancelled" ? "slate" : "gold";
  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-black">{booking.title}</h3>
            <StatusPill tone={tone}>{booking.status.replace("_", " ")}</StatusPill>
          </div>
          <p className="mt-1 text-sm font-semibold text-slate-500">{booking.vendor}</p>
          <p className="mt-2 text-sm text-slate-600">{dateRange(booking.starts_at, booking.ends_at)} · {booking.location ?? "Location TBD"}</p>
          {booking.missing_fields.length > 0 && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">
              Needs review: {booking.missing_fields.join(", ")}
            </p>
          )}
        </div>
        <div className="text-left md:text-right">
          <p className="text-lg font-black">{money(booking.total_amount, booking.currency ?? "EUR")}</p>
          <p className="text-sm text-slate-500">{booking.confirmation_code ?? "No confirmation code"}</p>
        </div>
      </div>
    </Card>
  );
}

export function CandidateCard({ candidate }: { candidate: ExtractedBookingCandidate }) {
  return (
    <Card className="border-amber-200 p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-black">{candidate.title}</h3>
            <StatusPill tone="gold">needs review</StatusPill>
            <StatusPill tone={candidate.confidence >= 0.75 ? "green" : "red"}>{Math.round(candidate.confidence * 100)}% confidence</StatusPill>
          </div>
          <p className="mt-1 text-sm font-semibold text-slate-500">{candidate.vendor ?? "Vendor TBD"}</p>
          <p className="mt-2 text-sm text-slate-600">{dateRange(candidate.starts_at, candidate.ends_at)} · {candidate.location ?? "Location TBD"}</p>
          {candidate.missing_fields.length > 0 && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">
              Missing: {candidate.missing_fields.join(", ")}
            </p>
          )}
        </div>
        <form className="flex gap-2" action={`/api/candidates/${candidate.id}`} method="post">
          <button name="intent" value="accept" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">
            Accept
          </button>
          <button name="intent" value="reject" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
            Reject
          </button>
        </form>
      </div>
    </Card>
  );
}
