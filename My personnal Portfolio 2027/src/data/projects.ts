import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import type { Project } from '@/types/project';

const DATA_FILE = path.join(process.cwd(), 'src', 'data', 'projects.json');

export async function getProjects(): Promise<Project[]> {
    const raw = await readFile(DATA_FILE, 'utf-8');
    return JSON.parse(raw) as Project[];
}

export async function saveProjects(projects: Project[]): Promise<void> {
    await writeFile(DATA_FILE, JSON.stringify(projects, null, 2) + '\n', 'utf-8');
}
