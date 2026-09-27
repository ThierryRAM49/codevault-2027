import Link from 'next/link';
import { cookies } from 'next/headers';
import { verifyToken, COOKIE_NAME } from '@/lib/auth';
import { HologramLogo } from './hologram-logo';

export async function Navbar() {
    const token = (await cookies()).get(COOKIE_NAME)?.value;
    const session = token ? await verifyToken(token) : null;

    return (
        <nav className="navbar">
            <Link href="/" className="navbar-logo">
                <HologramLogo />
            </Link>
            <div className="navbar-links">
                <Link href="/#home">Accueil</Link>
                <Link href="/#profil">Profil</Link>
                <Link href="/#projets">Projets</Link>
                <Link href="/#contact">Contact</Link>
                {session ? (
                    <Link href="/projets" className="navbar-admin">Ajouter un Projet</Link>
                ) : (
                    <Link href="/login" className="navbar-admin">Connexion</Link>
                )}
            </div>
        </nav>
    );
}
