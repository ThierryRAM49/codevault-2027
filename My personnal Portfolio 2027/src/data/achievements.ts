import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import type { Project } from '@/types/project';

const DATA_FILE = path.join(process.cwd(), 'src', 'data', 'achievements.json');

export async function getAchievements(): Promise<Project[]> {
    const raw = await readFile(DATA_FILE, 'utf-8');
    return JSON.parse(raw) as Project[];
}

export async function saveAchievements(achievements: Project[]): Promise<void> {
    await writeFile(DATA_FILE, JSON.stringify(achievements, null, 2) + '\n', 'utf-8');
}
