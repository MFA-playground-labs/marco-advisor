import { NextResponse } from "next/server";
import { getActiveTripSnapshot } from "@/lib/data";
import { askMarco } from "@/lib/openai-extract";

export async function POST(request: Request) {
  const body = await request.json();
  const question = String(body.question ?? "").trim();
  if (!question) return NextResponse.json({ error: "Question is required." }, { status: 400 });

  const snapshot = await getActiveTripSnapshot();
  const answer = await askMarco({ question, context: snapshot });
  return NextResponse.json({ answer });
}
