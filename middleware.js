import { jwtVerify } from "jose";
import { NextResponse } from "next/server";

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  // Only protect dashboard pages, not API routes (API routes handle their own auth)
  if (!pathname.startsWith("/dashboard")) {
    return NextResponse.next();
  }

  // Get the token from the 'auth-token' cookie
  const token = req.cookies.get("auth-token")?.value;

  // If no token, redirect to login page (which is at /)
  if (!token) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  try {
    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);
    const verified = await jwtVerify(token, secret);
    const tokenPayload = verified.payload;

    // Role-based access control
    if (pathname.startsWith("/dashboard/brand") && tokenPayload.role !== "BRAND_ADMIN" && tokenPayload.role !== "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/dashboard/creator", req.url));
    }

    if (pathname.startsWith("/dashboard/creator") && tokenPayload.role === "BRAND_ADMIN") {
      return NextResponse.redirect(new URL("/dashboard/brand", req.url));
    }

    return NextResponse.next();
  } catch (error) {
    console.error("JWT verification failed:", error);
    const response = NextResponse.redirect(new URL("/", req.url));
    response.cookies.delete("auth-token");
    return response;
  }
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
