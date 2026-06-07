import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { scanTrip } from "@/lib/scanner";
import type { Booking, Trip } from "@/lib/types";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Anonymous Supabase auth must be enabled before scanning trips." }, { status: 401 });

  const { data: trip } = await supabase
    .from("trips")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!trip) return NextResponse.json({ error: "No active trip." }, { status: 404 });

  const { data: bookings, error } = await supabase.from("bookings").select("*").eq("trip_id", trip.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const issues = scanTrip(trip as Trip, (bookings ?? []) as Booking[]);
  await supabase.from("trip_issues").delete().eq("trip_id", trip.id);
  if (issues.length > 0) {
    const inserted = await supabase.from("trip_issues").insert(issues);
    if (inserted.error) return NextResponse.json({ error: inserted.error.message }, { status: 400 });
  }

  return NextResponse.json({ issues: issues.length });
}
