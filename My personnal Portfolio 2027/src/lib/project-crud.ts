import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import type { Project } from '@/types/project';

function isValidProjectInput(body: unknown): body is Omit<Project, 'id'> {
    if (!body || typeof body !== 'object') return false;
    const b = body as Record<string, unknown>;
    return (
        typeof b.title === 'string' && b.title.trim().length > 0 &&
        typeof b.description === 'string' && b.description.trim().length > 0 &&
        typeof b.category === 'string' && b.category.trim().length > 0 &&
        Array.isArray(b.tech) && b.tech.every((t) => typeof t === 'string')
    );
}

// Middleware already restricts every method on routes built from this factory to a valid admin session.
export function createProjectRoutes(getAll: () => Promise<Project[]>, saveAll: (items: Project[]) => Promise<void>) {
    async function GET() {
        const items = await getAll();
        return NextResponse.json({ success: true, projects: items });
    }

    async function POST(request: NextRequest) {
        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ success: false, message: 'Requête invalide' }, { status: 400 });
        }

        if (!isValidProjectInput(body)) {
            return NextResponse.json({ success: false, message: 'Champs de projet invalides' }, { status: 400 });
        }

        const items = await getAll();
        const newItem: Project = { id: randomUUID(), ...body };
        items.push(newItem);
        await saveAll(items);

        return NextResponse.json({ success: true, project: newItem });
    }

    async function PUT(request: NextRequest) {
        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ success: false, message: 'Requête invalide' }, { status: 400 });
        }

        const b = body as Record<string, unknown>;
        const id = b.id;
        if (typeof id !== 'string' || !isValidProjectInput(b)) {
            return NextResponse.json({ success: false, message: 'Champs de projet invalides' }, { status: 400 });
        }

        const items = await getAll();
        const index = items.findIndex((p) => p.id === id);
        if (index === -1) {
            return NextResponse.json({ success: false, message: 'Projet introuvable' }, { status: 404 });
        }

        const updated: Project = { id, ...b };
        items[index] = updated;
        await saveAll(items);

        return NextResponse.json({ success: true, project: updated });
    }

    async function DELETE(request: NextRequest) {
        const id = request.nextUrl.searchParams.get('id');
        if (!id) {
            return NextResponse.json({ success: false, message: 'Identifiant requis' }, { status: 400 });
        }

        const items = await getAll();
        const filtered = items.filter((p) => p.id !== id);
        if (filtered.length === items.length) {
            return NextResponse.json({ success: false, message: 'Projet introuvable' }, { status: 404 });
        }

        await saveAll(filtered);
        return NextResponse.json({ success: true });
    }

    return { GET, POST, PUT, DELETE };
}
