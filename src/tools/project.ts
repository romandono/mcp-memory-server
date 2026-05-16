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

export async function handleProjectList(input?: unknown): Promise<any> {
  const params = input ? z.object({ page: z.number().int().positive().optional(), limit: z.number().int().positive().max(200).optional() }).optional().parse(input) : undefined;
  const { data, total } = getAllProjects(params);
  const result: any = { success: true, projects: data };
  if (params?.page || params?.limit) {
    const pageNum = params?.page || 1;
    const limitNum = params?.limit || total;
    result.pagination = { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) || 1 };
  }
  return result;
}

export async function handleProjectGet(input: unknown): Promise<any> {
  const { id } = z.object({ id: z.string().min(1) }).parse(input);
  const project = getProject(id);
  if (!project) return { success: false, message: `Project ${id} not found` };
  const { data: entries } = getProjectEntries(id);
  const { data: tasks } = getProjectTasks(id);
  const classifications = getClassifications('project', id);
  return { success: true, project, entries, tasks, classifications };
}
