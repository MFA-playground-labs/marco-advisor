import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const protectedPaths = [
  "/",
  "/dashboard",
  "/bookings",
  "/itinerary",
  "/timeline",
  "/scanner",
  "/settings",
  "/upload"
];

type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function isProtectedPath(pathname: string) {
  return protectedPaths.some((path) => pathname === path || (path !== "/" && pathname.startsWith(`${path}/`)));
}

function redirectWithCookies(request: NextRequest, response: NextResponse, pathname: string) {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = pathname;
  redirectUrl.search = "";

  if (pathname === "/login") {
    const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    redirectUrl.searchParams.set("next", next);
  }

  const redirectResponse = NextResponse.redirect(redirectUrl);
  response.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });
  return redirectResponse;
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!hasSupabaseEnv()) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

  if (!user && isProtectedPath(request.nextUrl.pathname)) {
    return redirectWithCookies(request, response, "/login");
  }

  if (user && request.nextUrl.pathname === "/login") {
    return redirectWithCookies(request, response, "/dashboard");
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};
