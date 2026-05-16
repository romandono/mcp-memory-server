import { z } from 'zod';
import { createProject, getProject, getAllProjects } from '../db/schema.js';
import { getClassifications } from '../db/schema.js';
import { getProjectEntries, getProjectTasks } from '../db/schema.js';
import { Project } from '../types/context.js';
import { randomUUID } from 'crypto';

const CreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export async function handleProjectCreate(input: unknown): Promise<any> {
  const v = CreateSchema.parse(input);
  const id = randomUUID();
  const now = new Date().toISOString();
  const project: Project = { id, name: v.name, description: v.description, status: 'active', created_at: now, updated_at: now };
  createProject(project);
  return { success: true, id, message: `Project "${v.name}" created` };
}

export async function handleProjectList(): Promise<any> {
  return { success: true, projects: getAllProjects() };
}

export async function handleProjectGet(input: unknown): Promise<any> {
  const { id } = z.object({ id: z.string().min(1) }).parse(input);
  const project = getProject(id);
  if (!project) return { success: false, message: `Project ${id} not found` };
  const entries = getProjectEntries(id);
  const tasks = getProjectTasks(id);
  const classifications = getClassifications('project', id);
  return { success: true, project, entries, tasks, classifications };
}
