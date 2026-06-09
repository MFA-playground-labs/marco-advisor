import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublishableKey, getSupabaseUrl, hasSupabaseEnv } from "@/lib/supabase-env";

const appPaths = [
  "/",
  "/dashboard",
  "/bookings",
  "/itinerary",
  "/pipeline",
  "/timeline",
  "/scanner",
  "/settings",
  "/upload"
];

const apiPaths = [
  "/api/candidates",
  "/api/extractions",
  "/api/marco",
  "/api/scanner",
  "/api/trips",
  "/api/upload"
];

type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

function matchesPath(pathname: string, paths: string[]) {
  return paths.some((path) => pathname === path || (path !== "/" && pathname.startsWith(`${path}/`)));
}

function shouldUseAnonymousSession(pathname: string) {
  return matchesPath(pathname, appPaths) || matchesPath(pathname, apiPaths);
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!hasSupabaseEnv()) {
    return response;
  }

  const supabaseUrl = getSupabaseUrl();
  const supabaseKey = getSupabasePublishableKey();
  const supabase = createServerClient(
    supabaseUrl!,
    supabaseKey!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        }
      }
    }
  );

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user && shouldUseAnonymousSession(request.nextUrl.pathname)) {
    await supabase.auth.signInAnonymously();
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};
