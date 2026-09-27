import { getProjects, saveProjects } from '@/data/projects';
import { createProjectRoutes } from '@/lib/project-crud';

export const { GET, POST, PUT, DELETE } = createProjectRoutes(getProjects, saveProjects);
