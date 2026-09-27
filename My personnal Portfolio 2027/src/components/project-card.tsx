import type { Project } from '@/types/project';

export function ProjectCard({
    project,
    onClick,
    editable,
}: {
    project: Project;
    onClick?: () => void;
    editable?: boolean;
}) {
    return (
        <article
            className={editable ? 'project-card project-card-clickable' : 'project-card'}
            onClick={onClick}
            title={editable ? 'Cliquer pour modifier' : undefined}
        >
            <p className="project-category">{project.category}</p>
            <h3 className="project-title">{project.title}</h3>
            <p className="project-desc">{project.description}</p>
            <div className="tech-stack">
                {project.tech.map((tech) => (
                    <span key={tech} className="tech">{tech}</span>
                ))}
            </div>
        </article>
    );
}
