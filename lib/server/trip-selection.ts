import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

export const selectedTripCookieName = "marco_selected_trip_id";

export async function getSelectedTripId() {
  const cookieStore = await cookies();
  return cookieStore.get(selectedTripCookieName)?.value ?? null;
}

export function setSelectedTripCookie(response: NextResponse, tripId: string) {
  response.cookies.set(selectedTripCookieName, tripId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365
  });
}

export function clearSelectedTripCookie(response: NextResponse) {
  response.cookies.set(selectedTripCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
}
