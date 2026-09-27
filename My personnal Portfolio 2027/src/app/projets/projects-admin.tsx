'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { Project } from '@/types/project';

type FormState = {
    id: string | null;
    title: string;
    description: string;
    category: string;
    tech: string;
};

const EMPTY_FORM: FormState = { id: null, title: '', description: '', category: '', tech: '' };

export function ProjectsAdmin({ initialProjects }: { initialProjects: Project[] }) {
    const router = useRouter();
    const [projects, setProjects] = useState(initialProjects);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [message, setMessage] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    async function handleLogout() {
        await fetch('/api/logout', { method: 'POST' });
        router.push('/');
        router.refresh();
    }

    function startEdit(project: Project) {
        setForm({
            id: project.id,
            title: project.title,
            description: project.description,
            category: project.category,
            tech: project.tech.join(', '),
        });
    }

    async function handleDelete(id: string) {
        if (!confirm('Supprimer cette proposition de projet ?')) return;
        const res = await fetch(`/api/projects?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            setProjects((prev) => prev.filter((p) => p.id !== id));
            setMessage('Projet supprimé.');
        } else {
            setMessage(data.message ?? 'Suppression impossible.');
        }
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        const payload = {
            id: form.id ?? undefined,
            title: form.title.trim(),
            description: form.description.trim(),
            category: form.category.trim(),
            tech: form.tech.split(',').map((t) => t.trim()).filter(Boolean),
        };

        try {
            const res = await fetch('/api/projects', {
                method: form.id ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();

            if (!data.success) {
                setMessage(data.message ?? 'Enregistrement impossible.');
                return;
            }

            if (form.id) {
                setProjects((prev) => prev.map((p) => (p.id === form.id ? data.project : p)));
                setMessage('Projet mis à jour.');
            } else {
                setProjects((prev) => [...prev, data.project]);
                setMessage('Projet ajouté.');
            }
            setForm(EMPTY_FORM);
        } catch {
            setMessage('Erreur réseau.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <>
            <div className="admin-header">
                <h1>Gérer les propositions de projets</h1>
                <button onClick={handleLogout}>Déconnexion</button>
            </div>

            <form className="admin-form" onSubmit={handleSubmit}>
                <input
                    placeholder="Titre"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    required
                />
                <textarea
                    placeholder="Description"
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    required
                />
                <input
                    placeholder="Catégorie (ex: Développement web)"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    required
                />
                <input
                    placeholder="Technologies séparées par des virgules"
                    value={form.tech}
                    onChange={(e) => setForm({ ...form, tech: e.target.value })}
                />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button type="submit" disabled={saving}>
                        {form.id ? 'Mettre à jour' : 'Ajouter'}
                    </button>
                    {form.id && (
                        <button type="button" onClick={() => setForm(EMPTY_FORM)}>
                            Annuler
                        </button>
                    )}
                </div>
                {message && <p className="admin-message">{message}</p>}
            </form>

            {projects.map((project) => (
                <div key={project.id} className="admin-project-row">
                    <div>
                        <strong>{project.title}</strong>
                        <p className="admin-message">{project.category}</p>
                    </div>
                    <div className="actions">
                        <button onClick={() => startEdit(project)}>Modifier</button>
                        <button onClick={() => handleDelete(project.id)}>Supprimer</button>
                    </div>
                </div>
            ))}
        </>
    );
}
