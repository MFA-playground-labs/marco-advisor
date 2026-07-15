"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bot,
  CalendarDays,
  Compass,
  Gauge,
  LayoutDashboard,
  ListChecks,
  Workflow,
  Settings,
  Upload,
  Menu,
  X,
  BriefcaseBusiness
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { TripList } from "@/lib/types";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/trips", label: "Trips", icon: BriefcaseBusiness },
  { href: "/bookings", label: "Bookings", icon: ListChecks },
  { href: "/itinerary", label: "Itinerary", icon: Compass },
  { href: "/timeline", label: "Timeline", icon: CalendarDays },
  { href: "/scanner", label: "Scanner", icon: AlertTriangle },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/pipeline", label: "Pipeline", icon: Workflow },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function AppShell({ children, tripList }: { children: React.ReactNode; tripList: TripList }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectingTripId, setSelectingTripId] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState("");
  const selectedTrip = tripList.active.find((trip) => trip.id === tripList.selectedTripId) ?? null;

  async function selectTrip(tripId: string) {
    if (!tripId || tripId === tripList.selectedTripId) return;
    setSelectionError("");
    setSelectingTripId(tripId);
    try {
      const response = await fetch(`/api/trips/${tripId}/select`, { method: "POST" });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Trip selection failed.");
      }
      router.refresh();
    } catch (error) {
      setSelectionError(error instanceof Error ? error.message : "Trip selection failed.");
    } finally {
      setSelectingTripId(null);
    }
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <button
        aria-label="Open navigation"
        className="fixed left-4 top-4 z-40 rounded-md border border-line bg-white p-2 shadow-card lg:hidden"
        onClick={() => setOpen(true)}
      >
        <Menu size={20} />
      </button>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-sidebar text-slate-100 transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-20 items-center justify-between border-b border-white/10 px-6">
          <Link href="/dashboard" className="flex items-center gap-3" onClick={() => setOpen(false)}>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-xl">🧭</span>
            <span>
              <span className="block font-display text-2xl font-bold leading-none">Marco</span>
              <span className="text-sm text-slate-400">Travel Intelligence</span>
            </span>
          </Link>
          <button className="lg:hidden" aria-label="Close navigation" onClick={() => setOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <div className="border-b border-white/10 px-6 py-5">
          <div className="rounded-md bg-white/5 p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold text-slate-300">Active trip</span>
              <Link href="/trips" className="text-xs font-black text-gold" onClick={() => setOpen(false)}>
                Manage
              </Link>
            </div>
            {tripList.active.length === 0 ? (
              <Link href="/trips" className="mt-2 block truncate font-black text-white" onClick={() => setOpen(false)}>
                Create a trip
              </Link>
            ) : (
              <select
                aria-label="Select active trip"
                className="mt-2 w-full rounded-md border border-white/10 bg-sidebar px-2 py-2 font-bold text-white"
                value={selectedTrip?.id ?? ""}
                disabled={Boolean(selectingTripId)}
                onChange={(event) => void selectTrip(event.target.value)}
              >
                {tripList.active.map((trip) => (
                  <option key={trip.id} value={trip.id}>
                    {trip.name}
                  </option>
                ))}
              </select>
            )}
            <div className="mt-2 truncate text-xs text-slate-400">
              {selectedTrip?.destination ?? "Destination TBD"}
              {tripList.past.length > 0 && (
                <Link href="/trips" className="ml-2 font-bold text-gold" onClick={() => setOpen(false)}>
                  {tripList.past.length} past
                </Link>
              )}
            </div>
            <p aria-live="polite" className="mt-2 min-h-4 text-xs font-semibold text-red-200">
              {selectingTripId ? "Switching trip..." : selectionError}
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex h-12 items-center gap-3 rounded-lg px-4 text-sm font-semibold text-slate-300",
                  active && "bg-gold text-ink",
                  !active && "hover:bg-white/8 hover:text-white"
                )}
              >
                <Icon size={18} />
                {item.label}
                {item.href === "/scanner" && <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">live</span>}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          <Link href="/upload" className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-white/8">
            <Bot size={18} />
            Ask Marco
            <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-xs">AI</span>
          </Link>
          <div className="mt-4 flex items-center gap-2 px-4 text-xs text-slate-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Upload pipeline ready
          </div>
        </div>
      </aside>

      <main className="min-h-screen lg:pl-72">
        <div className="mx-auto w-full max-w-7xl px-5 py-8 lg:px-10">{children}</div>
      </main>

      <Link
        href="/upload"
        aria-label="Open Marco assistant"
        className="fixed bottom-6 right-6 grid h-16 w-16 place-items-center rounded-full bg-ink text-2xl text-white shadow-card"
      >
        🧭
      </Link>
    </div>
  );
}
