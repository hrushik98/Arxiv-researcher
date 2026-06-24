/**
 * Next.js 16 "proxy" (formerly middleware). Runs before rendering.
 * Clerk handles auth: unauthenticated users hitting a protected route are
 * redirected to the sign-in page (NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login), and
 * protected API routes return 401.
 */
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Page routes that must NOT force a redirect to sign-in:
//   - the sign-in / sign-up flows themselves
//   - API routes, which guard themselves via getCurrentUser() and must return
//     JSON 401 (not an HTML redirect) so client fetch() calls don't break.
// Clerk middleware still runs on these so `auth()` works inside the handlers.
const isUnprotectedRoute = createRouteMatcher(["/login(.*)", "/signup(.*)", "/api(.*)"]);

export default clerkMiddleware(async (auth, request) => {
  if (!isUnprotectedRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next internals and static files, unless found in search params.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for Clerk's auto-proxy path.
    "/__clerk/:path*",
    // Always run for API routes.
    "/(api|trpc)(.*)",
  ],
};
