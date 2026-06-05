import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'appforge-default-secret-key-change-this-in-production'
);

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('appforge_token')?.value;
  const { pathname } = request.nextUrl;

  let isValid = false;
  if (token) {
    try {
      await jwtVerify(token, JWT_SECRET);
      isValid = true;
    } catch (err) {
      isValid = false;
    }
  }

  // 1. If trying to access dashboard without valid token, redirect to signin
  if (pathname.startsWith('/dashboard')) {
    if (!isValid) {
      const response = NextResponse.redirect(new URL('/auth/signin', request.url));
      response.cookies.delete('appforge_token');
      return response;
    }
  }

  // 2. If trying to access auth pages with valid token, redirect to dashboard
  if (pathname.startsWith('/auth')) {
    if (isValid) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // 3. Root redirect
  if (pathname === '/') {
    if (isValid) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    } else {
      return NextResponse.redirect(new URL('/auth/signin', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
