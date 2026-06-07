import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Anonymous Supabase auth must be enabled before reviewing candidates." }, { status: 401 });

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  const { data: candidate, error } = await supabase
    .from("extracted_booking_candidates")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !candidate) return NextResponse.json({ error: error?.message ?? "Candidate not found." }, { status: 404 });

  if (!candidate.trip_id) return NextResponse.json({ error: "Candidate is missing a trip." }, { status: 400 });

  if (intent === "reject") {
    const rejected = await supabase.from("extracted_booking_candidates").update({ status: "rejected" }).eq("id", id);
    if (rejected.error) return NextResponse.json({ error: rejected.error.message }, { status: 400 });
    return NextResponse.redirect(new URL("/bookings", request.url), { status: 303 });
  }

  if (intent !== "accept") return NextResponse.json({ error: "Unsupported candidate action." }, { status: 400 });

  const inserted = await supabase
    .from("bookings")
    .insert({
      trip_id: candidate.trip_id,
      type: candidate.booking_type,
      status: "confirmed",
      vendor: candidate.vendor ?? candidate.title,
      title: candidate.title,
      location: candidate.location,
      confirmation_code: candidate.confirmation_code,
      starts_at: candidate.starts_at,
      ends_at: candidate.ends_at,
      total_amount: candidate.total_amount,
      currency: candidate.currency,
      refundable: candidate.refundable,
      cancellation_deadline: candidate.cancellation_deadline,
      traveler_names: candidate.traveler_names,
      source_upload_id: candidate.upload_id,
      confidence: candidate.confidence,
      missing_fields: candidate.missing_fields,
      notes: null
    })
    .select("*")
    .single();

  if (inserted.error) return NextResponse.json({ error: inserted.error.message }, { status: 400 });

  const segment = await supabase.from("booking_segments").insert({
    booking_id: inserted.data.id,
    trip_id: candidate.trip_id,
    type: candidate.booking_type,
    label: candidate.title,
    starts_at: candidate.starts_at,
    ends_at: candidate.ends_at,
    origin: null,
    destination: null,
    location: candidate.location
  });
  if (segment.error) return NextResponse.json({ error: segment.error.message }, { status: 400 });

  const accepted = await supabase.from("extracted_booking_candidates").update({ status: "accepted" }).eq("id", id);
  if (accepted.error) return NextResponse.json({ error: accepted.error.message }, { status: 400 });

  return NextResponse.redirect(new URL("/bookings", request.url), { status: 303 });
}
