import type { Metadata } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';

const jetbrainsMono = JetBrains_Mono({
    subsets: ['latin'],
    weight: ['400', '500', '700'],
    variable: '--font-jetbrains-mono',
});

export const metadata: Metadata = {
    title: 'Thierry RAMANITRA — Portfolio Dev',
    description: 'Développeur full-stack, DevOps & IA — propositions de projets et réalisations.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="fr" className={jetbrainsMono.variable}>
            <body>
                <video className="site-video-bg" autoPlay loop muted playsInline aria-hidden="true">
                    <source src="/assets/video/ro.mp4" type="video/mp4" />
                </video>
                <div className="site-video-overlay" aria-hidden="true" />
                <Navbar />
                {children}
                <Footer />
            </body>
        </html>
    );
}
