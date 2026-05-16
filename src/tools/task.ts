import { z } from 'zod';
import { createTask, getTask, getProjectTasks, updateTask } from '../db/schema.js';
import { Task } from '../types/context.js';
import { randomUUID } from 'crypto';

const CreateSchema = z.object({
  project_id: z.string().min(1),
  sdd_entry_id: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional().default('medium'),
});

const ListSchema = z.object({
  project_id: z.string().min(1),
  sdd_entry_id: z.string().optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(200).optional(),
});

const UpdateSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']),
});

export async function handleTaskCreate(input: unknown): Promise<any> {
  const v = CreateSchema.parse(input);
  const id = randomUUID();
  const now = new Date().toISOString();
  const task: Task = { id, project_id: v.project_id, sdd_entry_id: v.sdd_entry_id, title: v.title, description: v.description, status: 'pending', priority: v.priority || 'medium', created_at: now, updated_at: now };
  createTask(task);
  return { success: true, id, message: `Task "${v.title}" created` };
}

export async function handleTaskList(input: unknown): Promise<any> {
  const v = ListSchema.parse(input);
  const params = v.page || v.limit ? { page: v.page, limit: v.limit } : undefined;
  const { data, total } = getProjectTasks(v.project_id, v.sdd_entry_id, params);
  const result: any = { success: true, count: data.length, tasks: data };
  if (params) {
    const pageNum = v.page || 1;
    const limitNum = v.limit || total;
    result.pagination = { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) || 1 };
  }
  return result;
}

export async function handleTaskUpdate(input: unknown): Promise<any> {
  const v = UpdateSchema.parse(input);
  const existing = getTask(v.id);
  if (!existing) return { success: false, message: `Task ${v.id} not found` };
  updateTask(v.id, { status: v.status });
  return { success: true, message: `Task ${v.id} updated to ${v.status}` };
}
