import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });

  const body = await request.json();
  const { data, error } = await supabase
    .from("trips")
    .insert({
      owner_id: user.id,
      name: body.name ?? "Trip from upload",
      destination: body.destination ?? null,
      starts_on: body.starts_on ?? null,
      ends_on: body.ends_on ?? null
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ trip: data });
}
