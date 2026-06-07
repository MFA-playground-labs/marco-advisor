import { EmptyState, PageHeader, Card, StatusPill } from "@/components/ui";
import { getActiveTripSnapshot } from "@/lib/data";
import { compactDate, dateRange } from "@/lib/utils";

const rowForType = {
  flight: 0,
  hotel: 1,
  car: 2,
  activity: 3,
  other: 3
};

export default async function TimelinePage() {
  const snapshot = await getActiveTripSnapshot();
  const bookings = snapshot.bookings.filter((booking) => booking.status === "confirmed");

  if (!snapshot.trip) {
    return (
      <>
        <PageHeader title="Trip Timeline" eyebrow="Visual booking coverage from accepted records" />
        <EmptyState title="No timeline yet" description="Upload and accept booking records to visualize flights, stays, cars, activities, conflicts, and gaps." />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Trip Timeline" eyebrow={`${snapshot.trip.name} · ${dateRange(snapshot.trip.starts_on, snapshot.trip.ends_on)}`} />
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line p-5">
          <h2 className="font-display text-2xl font-bold">Trip Timeline</h2>
          <div className="flex gap-2">
            <StatusPill tone="green">Confirmed</StatusPill>
            <StatusPill tone="red">Conflict</StatusPill>
            <StatusPill tone="blue">Gap</StatusPill>
          </div>
        </div>
        {bookings.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">Accepted bookings will appear here after upload review.</div>
        ) : (
          <div className="overflow-x-auto p-5">
            <div className="grid min-w-[900px] grid-cols-[140px_1fr]">
              <div className="space-y-16 pt-9 text-xs font-black uppercase text-slate-500">
                <div>Flights</div>
                <div>Hotels</div>
                <div>Car Rental</div>
                <div>Activities</div>
              </div>
              <div className="timeline-grid relative h-[360px] rounded-lg border border-line bg-white">
                <div className="absolute inset-x-0 top-0 flex justify-between border-b border-line px-4 py-2 text-xs font-semibold text-slate-500">
                  <span>{compactDate(snapshot.trip.starts_on)}</span>
                  <span>{compactDate(snapshot.trip.ends_on)}</span>
                </div>
                {bookings.map((booking, index) => {
                  const left = `${8 + (index % 8) * 10}%`;
                  const width = booking.type === "hotel" || booking.type === "car" ? "18%" : "8%";
                  const top = 58 + rowForType[booking.type] * 76;
                  const conflict = snapshot.issues.some((issue) => issue.related_booking_ids.includes(booking.id));
                  return (
                    <div
                      key={booking.id}
                      className={`absolute rounded-lg px-3 py-2 text-xs font-black text-white ${conflict ? "bg-red-500" : "bg-teal-500"}`}
                      style={{ left, top, width }}
                    >
                      <span className="block truncate">{booking.vendor || booking.title}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Card>

      <section className="mt-6 space-y-3">
        <h2 className="font-display text-3xl font-bold">Conflict Details</h2>
        {snapshot.issues.filter((issue) => issue.category === "double_booking").length === 0 ? (
          <Card className="p-6 text-sm text-slate-500">No timeline conflicts are currently recorded.</Card>
        ) : (
          snapshot.issues
            .filter((issue) => issue.category === "double_booking")
            .map((issue) => (
              <Card key={issue.id} className="border-red-200 p-5">
                <StatusPill tone="red">{issue.severity}</StatusPill>
                <h3 className="mt-3 font-black">{issue.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{issue.summary}</p>
              </Card>
            ))
        )}
      </section>
    </>
  );
}
