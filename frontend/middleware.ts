import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { token } = req.nextauth;
    const { pathname } = req.nextUrl;
    
    const isAuthenticated = !!token;
    
    // Check onboarding status for logged-in users
    if (isAuthenticated) {
      const isOnboarded = token?.onboarding_completed === true;
      
      // User is signed in but hasn't completed onboarding, and is not currently on the onboarding page
      if (!isOnboarded && !pathname.startsWith('/onboarding')) {
        return NextResponse.redirect(new URL('/onboarding', req.url));
      }
      
      // User is signed in and HAS completed onboarding, but tries to visit the onboarding page
      if (isOnboarded && pathname === '/onboarding') {
        return NextResponse.redirect(new URL('/dashboard', req.url));
      }

      // Check admin authorization for frontend
      if (pathname.startsWith('/admin')) {
        const roles = (token?.roles as string[]) || [];
        if (!roles.includes("admin")) {
          return NextResponse.redirect(new URL('/unauthorized', req.url));
        }
      }
    }
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;
        
        // Public routes
        if (
          pathname === "/" ||
          pathname.startsWith("/sign-in") ||
          pathname.startsWith("/sign-up") ||
          pathname.startsWith("/verify-email") ||
          pathname.startsWith("/forgot-password") ||
          pathname.startsWith("/reset-password") ||
          pathname.startsWith("/api/auth") ||
          pathname.startsWith("/api/v1/auth")
        ) {
          return true;
        }
        
        // Require authentication for everything else
        return !!token;
      }
    }
  }
);

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
