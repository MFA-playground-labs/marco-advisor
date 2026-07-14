import { PageHeader } from "@/components/ui";
import { TripManager } from "@/components/trip-manager";
import { getTripList } from "@/lib/data";

export default async function TripsPage() {
  const tripList = await getTripList();

  return (
    <>
      <PageHeader
        title="Trips"
        eyebrow="Name, switch, archive, and restore private trip workspaces"
      />
      <TripManager tripList={tripList} />
    </>
  );
}
