import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const ROLE_HOME: Record<string, string> = {
  admin: "/admin",
  teacher: "/dashboard/teacher",
  principal: "/dashboard/principal",
};

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });

  function redirectTo(path: string) {
    const redirectRes = NextResponse.redirect(new URL(path, req.url));
    res.cookies.getAll().forEach((cookie) => {
      redirectRes.cookies.set(cookie);
    });
    return redirectRes;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            req.cookies.set(name, value);
          });
          res = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirectTo("/login");
  }

  const { data: profile, error } = await supabase
    .from("users")
    .select("role")
    .eq("auth_id", user.id)
    .single();

  if (error || !profile?.role) {
    return redirectTo("/login");
  }

  const role = profile.role as string;
  const pathname = req.nextUrl.pathname;

  if (pathname.startsWith("/admin") && role !== "admin") {
    return redirectTo(ROLE_HOME[role] ?? "/login");
  }

  if (pathname.startsWith("/dashboard/teacher") && role !== "teacher") {
    return redirectTo(ROLE_HOME[role] ?? "/login");
  }

  if (pathname.startsWith("/dashboard/principal") && role !== "principal") {
    return redirectTo(ROLE_HOME[role] ?? "/login");
  }

  return res;
}

export const config = {
  matcher: ["/admin/:path*", "/dashboard/teacher/:path*", "/dashboard/principal/:path*"],
};
