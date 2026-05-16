import { z } from 'zod';
import { createEntry, getEntry, getProjectEntries, searchEntries, updateEntry, deleteEntry, getClassifications } from '../db/schema.js';
import { SddEntry } from '../types/context.js';
import { randomUUID } from 'crypto';

const CreateSchema = z.object({
  project_id: z.string().min(1),
  section: z.enum(['plan', 'design', 'tasks', 'general']),
  title: z.string().min(1),
  content: z.string().optional().default(''),
  status: z.enum(['draft', 'review', 'done']).optional().default('draft'),
  parent_id: z.string().optional(),
});

const GetSchema = z.object({
  project_id: z.string().min(1),
  section: z.enum(['plan', 'design', 'tasks', 'general']).optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(200).optional(),
});

const SearchSchema = z.object({
  project_id: z.string().min(1),
  query: z.string().min(1),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(200).optional(),
});

export async function handleEntryCreate(input: unknown): Promise<any> {
  const v = CreateSchema.parse(input);
  const id = randomUUID();
  const now = new Date().toISOString();
  const entry: SddEntry = { id, project_id: v.project_id, section: v.section, title: v.title, content: v.content || '', status: v.status || 'draft', parent_id: v.parent_id, created_at: now, updated_at: now };
  createEntry(entry);
  return { success: true, id, message: `Entry "${v.title}" created in ${v.section}` };
}

export async function handleEntryGet(input: unknown): Promise<any> {
  const v = GetSchema.parse(input);
  const params = v.page || v.limit ? { page: v.page, limit: v.limit } : undefined;
  const { data, total } = getProjectEntries(v.project_id, v.section, params);
  const result: any = { success: true, count: data.length, entries: data };
  if (params) {
    const pageNum = v.page || 1;
    const limitNum = v.limit || total;
    result.pagination = { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) || 1 };
  }
  return result;
}

export async function handleEntrySearch(input: unknown): Promise<any> {
  const v = SearchSchema.parse(input);
  const params = v.page || v.limit ? { page: v.page, limit: v.limit } : undefined;
  const { data, total } = searchEntries(v.project_id, v.query, params);
  const result: any = { success: true, count: data.length, results: data };
  if (params) {
    const pageNum = v.page || 1;
    const limitNum = v.limit || total;
    result.pagination = { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) || 1 };
  }
  return result;
}

const UpdateSchema = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  content: z.string().optional(),
  status: z.enum(['draft', 'review', 'done']).optional(),
  section: z.enum(['plan', 'design', 'tasks', 'general']).optional(),
  parent_id: z.string().optional().nullable(),
});

export async function handleEntryUpdate(input: unknown): Promise<any> {
  const v = UpdateSchema.parse(input);
  const existing = getEntry(v.id);
  if (!existing) return { success: false, message: `Entry ${v.id} not found` };
  const updates: Partial<SddEntry> = {};
  if (v.title !== undefined) updates.title = v.title;
  if (v.content !== undefined) updates.content = v.content;
  if (v.status !== undefined) updates.status = v.status;
  if (v.section !== undefined) updates.section = v.section;
  if (v.parent_id !== undefined) updates.parent_id = v.parent_id || undefined;
  updateEntry(v.id, updates);
  const updated = getEntry(v.id);
  return { success: true, entry: updated, message: `Entry ${v.id} updated` };
}

const DeleteSchema = z.object({
  id: z.string().min(1),
});

export async function handleEntryDelete(input: unknown): Promise<any> {
  const v = DeleteSchema.parse(input);
  const existing = getEntry(v.id);
  if (!existing) return { success: false, message: `Entry ${v.id} not found` };
  deleteEntry(v.id);
  return { success: true, message: `Entry ${v.id} deleted` };
}
