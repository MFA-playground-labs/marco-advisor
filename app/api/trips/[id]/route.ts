import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { WorkflowError, errorMessage, errorStatus } from "@/lib/server/errors";
import { createSupabaseRepository } from "@/lib/server/supabase-repository";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  const repo = createSupabaseRepository(supabase);

  try {
    const user = await repo.requireUser("updating trips");
    const { id } = await params;
    const body = await request.json();
    const trip = await repo.updateOwnedTrip(user.id, id, tripUpdateInput(body));
    return NextResponse.json({ trip });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error, "Trip update failed.") }, { status: errorStatus(error) });
  }
}

function tripUpdateInput(body: any) {
  const name = String(body?.name ?? "").trim();
  if (!name) throw new WorkflowError("Trip name is required.", 400);

  return {
    name,
    destination: nullableString(body?.destination),
    starts_on: nullableString(body?.starts_on),
    ends_on: nullableString(body?.ends_on)
  };
}

function nullableString(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}
