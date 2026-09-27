import { SignJWT, jwtVerify } from 'jose';

export type AuthPayload = {
    email: string;
    role: 'admin';
};

const COOKIE_NAME = 'auth_token';
const SESSION_DURATION = '2h';

function getSecretKey() {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET is not configured');
    }
    return new TextEncoder().encode(secret);
}

export async function createToken(email: string): Promise<string> {
    return new SignJWT({ email, role: 'admin' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(SESSION_DURATION)
        .sign(getSecretKey());
}

export async function verifyToken(token: string): Promise<AuthPayload | null> {
    try {
        const { payload } = await jwtVerify(token, getSecretKey());
        if (payload.role !== 'admin' || typeof payload.email !== 'string') {
            return null;
        }
        return { email: payload.email, role: 'admin' };
    } catch {
        return null;
    }
}

export { COOKIE_NAME };
