import { AppShell } from "@/components/app-shell";
import { getTripList } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const tripList = await getTripList();

  return <AppShell tripList={tripList}>{children}</AppShell>;
}
