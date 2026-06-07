import { EmptyState, PageHeader, Card, StatusPill } from "@/components/ui";
import { MarcoChat } from "@/components/marco-chat";
import { getActiveTripSnapshot } from "@/lib/data";
import { compactDate, dateRange } from "@/lib/utils";

const sliders = [
  ["Adventure", "Culture"],
  ["City", "Beach"],
  ["Value", "Luxury"],
  ["Relaxed", "Packed"],
  ["Local / Authentic", "Iconic / Highlights"],
  ["Food-focused", "Sightseeing"]
];

export default async function ItineraryPage() {
  const snapshot = await getActiveTripSnapshot();
  const bookings = snapshot.bookings.filter((booking) => booking.status === "confirmed");

  if (!snapshot.trip) {
    return (
      <>
        <PageHeader title="Daily Activity Planner" eyebrow="Generated from uploaded trip records and preferences" />
        <EmptyState title="No itinerary context yet" description="Upload accepted bookings first so Marco can infer destinations, dates, lodging, and travel windows." />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Daily Activity Planner" eyebrow={`${snapshot.trip.name} · ${dateRange(snapshot.trip.starts_on, snapshot.trip.ends_on)}`} />
      <div className="grid gap-6 xl:grid-cols-[1fr_390px]">
        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-black">Preference Sliders</h2>
                <p className="text-sm text-slate-500">Used by Marco when generating itinerary days.</p>
              </div>
              <StatusPill>Saved per trip</StatusPill>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {sliders.map(([left, right]) => (
                <div key={left}>
                  <div className="mb-2 flex justify-between text-xs font-bold text-slate-500">
                    <span>{left}</span>
                    <span>{right}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200">
                    <div className="h-2 w-1/2 rounded-full bg-ink" />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {bookings.length === 0 ? (
            <Card className="p-6 text-sm text-slate-500">Accepted bookings will become itinerary anchors. Use Ask Marco to generate day plans after records exist.</Card>
          ) : (
            <section className="space-y-4">
              {bookings.slice(0, 8).map((booking) => (
                <Card key={booking.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-500">{compactDate(booking.starts_at)} · {booking.location ?? "Location TBD"}</p>
                      <h3 className="mt-1 text-lg font-black">{booking.title}</h3>
                      <p className="mt-1 text-sm text-slate-500">{booking.notes ?? "Marco can use this confirmed booking as an itinerary anchor."}</p>
                    </div>
                    <StatusPill tone={booking.type === "activity" ? "purple" : "blue"}>{booking.type}</StatusPill>
                  </div>
                </Card>
              ))}
            </section>
          )}
        </div>
        <MarcoChat />
      </div>
    </>
  );
}
