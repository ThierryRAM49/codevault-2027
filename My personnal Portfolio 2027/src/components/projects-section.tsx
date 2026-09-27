'use client';

import { useState } from 'react';
import type { Project } from '@/types/project';
import { ProjectCard } from './project-card';

type FormState = {
    title: string;
    description: string;
    category: string;
    tech: string;
};

function toFormState(project: Project): FormState {
    return {
        title: project.title,
        description: project.description,
        category: project.category,
        tech: project.tech.join(', '),
    };
}

export function ProjectsSection({
    initialProjects,
    isAdmin,
    endpoint = '/api/projects',
}: {
    initialProjects: Project[];
    isAdmin: boolean;
    endpoint?: string;
}) {
    const [projects, setProjects] = useState(initialProjects);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<FormState | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    function startEdit(project: Project) {
        setEditingId(project.id);
        setForm(toFormState(project));
        setError(null);
    }

    function cancelEdit() {
        setEditingId(null);
        setForm(null);
        setError(null);
    }

    async function handleSave(id: string) {
        if (!form) return;
        setSaving(true);
        setError(null);

        try {
            const res = await fetch(endpoint, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id,
                    title: form.title.trim(),
                    description: form.description.trim(),
                    category: form.category.trim(),
                    tech: form.tech.split(',').map((t) => t.trim()).filter(Boolean),
                }),
            });
            const data = await res.json();

            if (!data.success) {
                setError(data.message ?? 'Enregistrement impossible.');
                return;
            }

            setProjects((prev) => prev.map((p) => (p.id === id ? data.project : p)));
            cancelEdit();
        } catch {
            setError('Erreur réseau.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="projects-grid">
            {projects.map((project) => {
                if (editingId === project.id && form) {
                    return (
                        <div key={project.id} className="project-card project-card-editing">
                            <input
                                value={form.title}
                                onChange={(e) => setForm({ ...form, title: e.target.value })}
                                placeholder="Titre"
                            />
                            <textarea
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                rows={3}
                                placeholder="Description"
                            />
                            <input
                                value={form.category}
                                onChange={(e) => setForm({ ...form, category: e.target.value })}
                                placeholder="Catégorie"
                            />
                            <input
                                value={form.tech}
                                onChange={(e) => setForm({ ...form, tech: e.target.value })}
                                placeholder="Technologies séparées par des virgules"
                            />
                            {error && <p className="admin-message">{error}</p>}
                            <div className="project-card-edit-actions">
                                <button type="button" onClick={() => handleSave(project.id)} disabled={saving}>
                                    {saving ? 'Sauvegarde…' : 'Enregistrer'}
                                </button>
                                <button type="button" onClick={cancelEdit} disabled={saving}>
                                    Annuler
                                </button>
                            </div>
                        </div>
                    );
                }

                return (
                    <ProjectCard
                        key={project.id}
                        project={project}
                        editable={isAdmin}
                        onClick={isAdmin ? () => startEdit(project) : undefined}
                    />
                );
            })}
        </div>
    );
}
