import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

// Paths reachable without a session. The inbound webhook and the cron job are
// machine-to-machine and authenticate with their own shared secrets.
const PUBLIC_PREFIXES = ["/login", "/auth", "/api/jobs", "/api/inbound"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/") || pathname === p);
}

export async function updateSession(request: NextRequest) {
  const supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase isn't configured, skip the auth refresh and pass through.
  if (!url || !anonKey) {
    return supabaseResponse;
  }

  try {
    let response = supabaseResponse;
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const pathname = request.nextUrl.pathname;

    // Lock-down: anonymous visitors are redirected to /login for every app
    // route. Public prefixes (login, auth callback, cron job) are exempt.
    if (!user && !isPublic(pathname)) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(redirectUrl);
    }

    // Signed-in users hitting /login go to the board.
    if (user && pathname === "/login") {
      const boardUrl = request.nextUrl.clone();
      boardUrl.pathname = "/";
      boardUrl.search = "";
      return NextResponse.redirect(boardUrl);
    }

    return response;
  } catch {
    // Never let an auth hiccup crash the entire edge middleware.
    return supabaseResponse;
  }
}
