import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

// Force hardened flags on every auth cookie we write: httpOnly (never exposed
// to client JS — mitigates token theft via XSS), Secure in production, and
// SameSite=Lax (CSRF defence). All session establishment goes through the
// server, so there is no browser-JS dependency on reading these cookies.
export function hardenCookie(options?: CookieOptions): CookieOptions {
  return {
    ...options,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: options?.path ?? "/",
  };
}

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, hardenCookie(options)),
            );
          } catch {
            // Server Components can't set cookies; middleware handles session refresh
          }
        },
      },
    },
  );
}
