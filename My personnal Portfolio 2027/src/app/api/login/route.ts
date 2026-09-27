import { NextRequest, NextResponse } from 'next/server';
import { createToken, COOKIE_NAME } from '@/lib/auth';
import { verifyCredentials } from '@/lib/credentials';
import { isRateLimited, recordFailedAttempt, clearAttempts } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

    if (isRateLimited(ip)) {
        return NextResponse.json(
            { success: false, message: 'Trop de tentatives. Réessayez plus tard.' },
            { status: 429 }
        );
    }

    let body: { email?: string; password?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ success: false, message: 'Requête invalide' }, { status: 400 });
    }

    const { email, password } = body;
    if (!email || !password) {
        return NextResponse.json({ success: false, message: 'Email et mot de passe requis' }, { status: 400 });
    }

    if (!verifyCredentials(email, password)) {
        recordFailedAttempt(ip);
        return NextResponse.json({ success: false, message: 'Identifiants invalides' }, { status: 401 });
    }

    clearAttempts(ip);
    const token = await createToken(email);

    const response = NextResponse.json({ success: true });
    response.cookies.set(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 2 * 60 * 60,
    });
    return response;
}
