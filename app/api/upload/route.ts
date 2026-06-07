import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { extractBookingsFromUpload } from "@/lib/openai-extract";

const supportedTypes = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
  "text/html",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]);

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Anonymous Supabase auth must be enabled before uploading." }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "A file is required." }, { status: 400 });
  if (!supportedTypes.has(file.type)) return NextResponse.json({ error: `Unsupported file type: ${file.type || "unknown"}` }, { status: 400 });

  const tripName = String(formData.get("tripName") || "").trim();
  const destination = String(formData.get("destination") || "").trim();
  const startsOn = String(formData.get("startsOn") || "").trim();
  const endsOn = String(formData.get("endsOn") || "").trim();

  let { data: trip } = await supabase
    .from("trips")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!trip) {
    const inserted = await supabase
      .from("trips")
      .insert({
        owner_id: user.id,
        name: tripName || `Trip from ${file.name}`,
        destination: destination || null,
        starts_on: startsOn || null,
        ends_on: endsOn || null
      })
      .select("*")
      .single();
    if (inserted.error) return NextResponse.json({ error: inserted.error.message }, { status: 400 });
    trip = inserted.data;
  }

  const storagePath = `${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
  const uploadResult = await supabase.storage.from("trip-uploads").upload(storagePath, file, {
    contentType: file.type,
    upsert: false
  });
  if (uploadResult.error) return NextResponse.json({ error: uploadResult.error.message }, { status: 400 });

  const upload = await supabase
    .from("uploads")
    .insert({
      owner_id: user.id,
      trip_id: trip.id,
      filename: file.name,
      content_type: file.type,
      storage_path: storagePath,
      status: "extracting"
    })
    .select("*")
    .single();
  if (upload.error) return NextResponse.json({ error: upload.error.message }, { status: 400 });

  const job = await supabase
    .from("extraction_jobs")
    .insert({ upload_id: upload.data.id, trip_id: trip.id, status: "processing" })
    .select("*")
    .single();
  if (job.error) return NextResponse.json({ error: job.error.message }, { status: 400 });

  try {
    const text = file.type.startsWith("text/") ? await file.text() : undefined;
    const dataUrl = text ? undefined : `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`;

    const extraction = await extractBookingsFromUpload({
      filename: file.name,
      contentType: file.type,
      text,
      imageDataUrl: file.type.startsWith("image/") ? dataUrl : undefined,
      fileData: !file.type.startsWith("image/") ? dataUrl : undefined
    });

    if (extraction.trip.name || extraction.trip.destination || extraction.trip.starts_on || extraction.trip.ends_on) {
      await supabase
        .from("trips")
        .update({
          name: tripName || trip.name || extraction.trip.name || `Trip from ${file.name}`,
          destination: destination || trip.destination || extraction.trip.destination,
          starts_on: startsOn || trip.starts_on || extraction.trip.starts_on,
          ends_on: endsOn || trip.ends_on || extraction.trip.ends_on
        })
        .eq("id", trip.id);
    }

    if (extraction.trip.travelers.length > 0) {
      await supabase.from("travelers").upsert(
        extraction.trip.travelers.map((name) => ({
          trip_id: trip.id,
          owner_id: user.id,
          name,
          email: null
        })),
        { onConflict: "trip_id,name" }
      );
    }

    if (extraction.bookings.length > 0) {
      await supabase.from("extracted_booking_candidates").insert(
        extraction.bookings.map((booking) => ({
          upload_id: upload.data.id,
          trip_id: trip.id,
          status: "needs_review",
          booking_type: booking.booking_type,
          title: booking.title,
          vendor: booking.vendor,
          location: booking.location,
          starts_at: booking.starts_at,
          ends_at: booking.ends_at,
          total_amount: booking.total_amount,
          currency: booking.currency,
          refundable: booking.refundable,
          cancellation_deadline: booking.cancellation_deadline,
          traveler_names: booking.traveler_names,
          confirmation_code: booking.confirmation_code,
          confidence: booking.confidence,
          missing_fields: booking.missing_fields,
          raw_json: booking
        }))
      );
    }

    await supabase.from("uploads").update({ status: "review_ready" }).eq("id", upload.data.id);
    await supabase
      .from("extraction_jobs")
      .update({ status: "succeeded", completed_at: new Date().toISOString() })
      .eq("id", job.data.id);

    return NextResponse.json({ upload: upload.data, candidates: extraction.bookings.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Extraction failed.";
    await supabase.from("uploads").update({ status: "failed" }).eq("id", upload.data.id);
    await supabase
      .from("extraction_jobs")
      .update({ status: "failed", error_message: message, completed_at: new Date().toISOString() })
      .eq("id", job.data.id);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
