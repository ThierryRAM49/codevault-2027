import { timingSafeEqual } from 'crypto';

// Uses Node's crypto module — only import this from Node.js runtime code
// (API routes), never from src/lib/auth.ts or middleware.ts, which also run
// in the Edge runtime and don't support Node built-ins.
function safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
        // Still run a comparison of equal length to avoid leaking length via timing.
        timingSafeEqual(bufA, bufA);
        return false;
    }
    return timingSafeEqual(bufA, bufB);
}

export function verifyCredentials(email: string, password: string): boolean {
    const adminEmail = process.env.ADMIN_EMAIL ?? '';
    const adminPassword = process.env.ADMIN_PASSWORD ?? '';
    if (!adminEmail || !adminPassword) return false;

    const emailMatches = safeEqual(email.trim().toLowerCase(), adminEmail.trim().toLowerCase());
    const passwordMatches = safeEqual(password, adminPassword);
    return emailMatches && passwordMatches;
}
