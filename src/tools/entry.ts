import { z } from 'zod';
import { createEntry, getEntry, getProjectEntries, searchEntries, getClassifications } from '../db/schema.js';
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
});

const SearchSchema = z.object({
  project_id: z.string().min(1),
  query: z.string().min(1),
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
  const entries = getProjectEntries(v.project_id, v.section);
  return { success: true, count: entries.length, entries };
}

export async function handleEntrySearch(input: unknown): Promise<any> {
  const v = SearchSchema.parse(input);
  const results = searchEntries(v.project_id, v.query);
  return { success: true, count: results.length, results };
}
