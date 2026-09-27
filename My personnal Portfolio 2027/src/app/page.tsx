import { cookies } from 'next/headers';
import { getProjects } from '@/data/projects';
import { getAchievements } from '@/data/achievements';
import { verifyToken, COOKIE_NAME } from '@/lib/auth';
import { ProjectsSection } from '@/components/projects-section';

export default async function HomePage() {
    const [proposals, achievements] = await Promise.all([getProjects(), getAchievements()]);
    const token = (await cookies()).get(COOKIE_NAME)?.value;
    const isAdmin = token ? Boolean(await verifyToken(token)) : false;

    return (
        <main>
            <section id="home" className="hero">
                <div>
                    <h1>
                        <span className="hero-accent">DEV PRO</span> — Projet réalisé par Thierry RAMANITRA
                    </h1>
                    <p className="subtitle">Flexbox + Grid + Bash + Vidéo MP4 = GOD MODE</p>
                    <a href="#profil" className="cta-button">Voir mes projets</a>
                </div>
            </section>

            <section id="profil">
                <header className="profil-header">
                    <h2>Thierry RAMANITRA</h2>
                    <p className="subtitle">Développeur Full-Stack • Compositeur • Pentester</p>
                    <div className="tags">
                        <span className="tag">Electron.js</span>
                        <span className="tag">Kali Linux</span>
                        <span className="tag">Cybersécurité</span>
                        <span className="tag">Musique & Code</span>
                        <span className="tag">Autodidacte 20 ans</span>
                    </div>
                </header>

                <h2>Mes Projets Clés</h2>
                {isAdmin && <p className="section-intro">Cliquez sur une carte pour la modifier.</p>}
                <ProjectsSection initialProjects={achievements} isAdmin={isAdmin} endpoint="/api/achievements" />

                <div className="profil-contact">
                    <h2>Me Contacter</h2>
                    <div className="contact-links">
                        <a href="mailto:riad-design@gmx.com" className="btn">📧 Email</a>
                        <a href="https://github.com/ThierryRAM49/" className="btn btn-secondary" target="_blank" rel="noreferrer">🐙 GitHub</a>
                    </div>
                </div>
            </section>

            <section id="projets">
                <h2>Propositions de projets</h2>
                <p className="section-intro">
                    Ce que je peux développer pour vous, du prototype à la mise en production.
                    {isAdmin && ' Cliquez sur une carte pour la modifier.'}
                </p>
                <ProjectsSection initialProjects={proposals} isAdmin={isAdmin} />
            </section>

            <section id="contact">
                <h2>Contactez-moi</h2>
                <form className="contact-form" action="mailto:riad-design@gmx.com" method="post" encType="text/plain">
                    <label htmlFor="name">Nom</label>
                    <input type="text" id="name" name="name" placeholder="Votre nom" required />
                    <label htmlFor="email">Email</label>
                    <input type="email" id="email" name="email" placeholder="Votre email" required />
                    <label htmlFor="message">Message</label>
                    <textarea id="message" name="message" rows={6} placeholder="Votre message" required />
                    <button type="submit" className="cta-button contact-submit">Envoyer</button>
                </form>
            </section>
        </main>
    );
}
