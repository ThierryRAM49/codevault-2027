import { getProjects } from '@/data/projects';
import { ProjectsAdmin } from './projects-admin';

export default async function ProjetsAdminPage() {
    const projects = await getProjects();

    return (
        <main>
            <section className="admin-page">
                <ProjectsAdmin initialProjects={projects} />
            </section>
        </main>
    );
}
