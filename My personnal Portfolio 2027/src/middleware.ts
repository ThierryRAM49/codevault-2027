import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';

export async function middleware(request: NextRequest) {
    // Paths to protect
    const protectedPaths = ['/projets', '/api/projects', '/api/achievements'];
    const isProtected = protectedPaths.some(path => request.nextUrl.pathname.startsWith(path));

    if (isProtected) {
        const token = request.cookies.get('auth_token')?.value;

        if (!token) {
            // No token present
            if (!request.nextUrl.pathname.startsWith('/api/')) {
                return NextResponse.redirect(new URL('/login', request.url));
            }
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        // Verify JWT token
        const payload = await verifyToken(token);
        if (!payload || payload.role !== 'admin') {
            // Invalid or expired token
            if (!request.nextUrl.pathname.startsWith('/api/')) {
                return NextResponse.redirect(new URL('/login', request.url));
            }
            return NextResponse.json({ success: false, message: 'Invalid token' }, { status: 401 });
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        '/projets/:path*',
        '/api/projects/:path*',
        '/api/achievements/:path*',
    ],
};
