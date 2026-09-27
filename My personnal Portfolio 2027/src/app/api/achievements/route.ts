import { getAchievements, saveAchievements } from '@/data/achievements';
import { createProjectRoutes } from '@/lib/project-crud';

export const { GET, POST, PUT, DELETE } = createProjectRoutes(getAchievements, saveAchievements);
