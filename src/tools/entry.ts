import { z } from 'zod';
import { createEntry, getCompactEntriesByIds, getCompactEntry, getEntry, getProjectEntries, searchCompactEntries, searchEntries, searchAllEntries, updateEntry, deleteEntry } from '../db/schema.js';
import { ResponseFormat, SddEntry } from '../types/context.js';
import { randomUUID } from 'crypto';
import { rebuildEntryMemory } from '../memory/rebuild.js';
import { applyCompactEntryCharBudget, applyCursor, applyItemBudget, buildNextCursor } from '../memory/budget.js';
import { withMetrics } from '../memory/response.js';
import { parseFormat, parseView } from '../memory/view.js';
import { setToonMeta, toToonEntrySummary, toToonSearchResults } from '../memory/toon.js';

function isDefined<T>(value: T | null): value is T {
  return value !== null;
}

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
  view: z.enum(['full', 'summary', 'compact']).optional(),
  format: z.enum(['json', 'toon-r', 'toon-d']).optional(),
  max_items: z.number().int().positive().max(200).optional(),
  max_chars: z.number().int().positive().optional(),
  cursor: z.string().optional(),
});

const SearchSchema = z.object({
  project_id: z.string().min(1),
  query: z.string().min(1),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(200).optional(),
  view: z.enum(['full', 'summary', 'compact']).optional(),
  format: z.enum(['json', 'toon-r', 'toon-d']).optional(),
  max_items: z.number().int().positive().max(200).optional(),
  max_chars: z.number().int().positive().optional(),
  cursor: z.string().optional(),
});

const SearchGlobalSchema = z.object({
  query: z.string().min(1),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(200).optional(),
  view: z.enum(['full', 'summary', 'compact']).optional(),
  format: z.enum(['json', 'toon-r', 'toon-d']).optional(),
  max_items: z.number().int().positive().max(200).optional(),
  max_chars: z.number().int().positive().optional(),
  cursor: z.string().optional(),
});

const BatchSchema = z.object({
  entry_ids: z.array(z.string().min(1)).min(1).max(200),
  format: z.enum(['json', 'toon-r', 'toon-d']).optional(),
  max_items: z.number().int().positive().max(200).optional(),
  max_chars: z.number().int().positive().optional(),
  cursor: z.string().optional(),
});

export async function handleEntryCreate(input: unknown): Promise<any> {
  const v = CreateSchema.parse(input);
  const id = randomUUID();
  const now = new Date().toISOString();
  const entry: SddEntry = { id, project_id: v.project_id, section: v.section, title: v.title, content: v.content || '', status: v.status || 'draft', parent_id: v.parent_id, created_at: now, updated_at: now };
  createEntry(entry);
  rebuildEntryMemory(id);
  return { success: true, id, message: `Entry "${v.title}" created in ${v.section}` };
}

export async function handleEntryGet(input: unknown): Promise<any> {
  const v = GetSchema.parse(input);
  const view = parseView(v.view);
  const format = parseFormat(v.format);
  const params = v.page || v.limit ? { page: v.page, limit: v.limit } : undefined;
  const { data, total } = getProjectEntries(v.project_id, v.section, params);
  if (view !== 'full') {
    const entries = applyCursor(data.map(entry => getCompactEntry(entry.id)).filter(isDefined), v.cursor);
    const itemBudget = applyItemBudget(entries, v.max_items);
    const charBudget = applyCompactEntryCharBudget(itemBudget.items, v.max_chars);
    const truncated = itemBudget.truncated || charBudget.truncated;
    const nextCursor = buildNextCursor(entries, charBudget.items, truncated);
    return format === 'json'
      ? withMetrics({ success: true, count: charBudget.items.length, entries: charBudget.items, truncated, next_cursor: nextCursor })
      : setToonMeta(toToonSearchResults(charBudget.items, format, { truncated, next: nextCursor }), { truncated, next: nextCursor, count: charBudget.items.length });
  }
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
  const view = parseView(v.view);
  const format = parseFormat(v.format);
  const params = v.page || v.limit ? { page: v.page, limit: v.limit } : undefined;
  if (view !== 'full') {
    const { data, total } = searchCompactEntries(v.query, v.project_id, params);
    const cursorData = applyCursor(data, v.cursor);
    const itemBudget = applyItemBudget(cursorData, v.max_items);
    const charBudget = applyCompactEntryCharBudget(itemBudget.items, v.max_chars);
    const truncated = itemBudget.truncated || charBudget.truncated;
    const nextCursor = buildNextCursor(cursorData, charBudget.items, truncated);
    const result: any = format === 'json' ? withMetrics({ success: true, count: charBudget.items.length, results: charBudget.items, truncated, next_cursor: nextCursor }) : setToonMeta(toToonSearchResults(charBudget.items, format, { truncated, next: nextCursor }), { truncated, next: nextCursor, count: charBudget.items.length });
    if (format === 'json' && params) {
      const pageNum = v.page || 1;
      const limitNum = v.limit || total;
      result.pagination = { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) || 1 };
    }
    return result;
  }
  const { data, total } = searchEntries(v.project_id, v.query, params);
  const result: any = { success: true, count: data.length, results: data };
  if (params) {
    const pageNum = v.page || 1;
    const limitNum = v.limit || total;
    result.pagination = { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) || 1 };
  }
  return result;
}

export async function handleGlobalEntrySearch(input: unknown): Promise<any> {
  const v = SearchGlobalSchema.parse(input);
  const view = parseView(v.view);
  const format = parseFormat(v.format);
  const params = v.page || v.limit ? { page: v.page, limit: v.limit } : undefined;
  if (view !== 'full') {
    const { data, total } = searchCompactEntries(v.query, undefined, params);
    const cursorData = applyCursor(data, v.cursor);
    const itemBudget = applyItemBudget(cursorData, v.max_items);
    const charBudget = applyCompactEntryCharBudget(itemBudget.items, v.max_chars);
    const truncated = itemBudget.truncated || charBudget.truncated;
    const nextCursor = buildNextCursor(cursorData, charBudget.items, truncated);
    const result: any = format === 'json' ? withMetrics({ success: true, count: charBudget.items.length, results: charBudget.items, truncated, next_cursor: nextCursor }) : setToonMeta(toToonSearchResults(charBudget.items, format, { truncated, next: nextCursor }), { truncated, next: nextCursor, count: charBudget.items.length });
    if (format === 'json' && params) {
      const pageNum = v.page || 1;
      const limitNum = v.limit || total;
      result.pagination = { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) || 1 };
    }
    return result;
  }
  const { data, total } = searchAllEntries(v.query, params);
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
  rebuildEntryMemory(v.id);
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

const SummarySchema = z.object({
  entry_id: z.string().min(1),
  format: z.enum(['json', 'toon-r', 'toon-d']).optional(),
});

export async function handleEntryGetSummary(input: unknown): Promise<any> {
  const v = SummarySchema.parse(input);
  const format: ResponseFormat = parseFormat(v.format);
  const entry = getCompactEntry(v.entry_id);
  if (!entry) return { success: false, message: `Entry ${v.entry_id} not found` };
  return format === 'json' ? { success: true, entry } : toToonEntrySummary(entry, format);
}

export async function handleEntryBatchGet(input: unknown): Promise<any> {
  const v = BatchSchema.parse(input);
  const format: ResponseFormat = parseFormat(v.format);
  const entries = applyCursor(getCompactEntriesByIds(v.entry_ids), v.cursor);
  const itemBudget = applyItemBudget(entries, v.max_items);
  const charBudget = applyCompactEntryCharBudget(itemBudget.items, v.max_chars);
  const truncated = itemBudget.truncated || charBudget.truncated;
  const nextCursor = buildNextCursor(entries, charBudget.items, truncated);
  return format === 'json'
    ? withMetrics({ success: true, count: charBudget.items.length, entries: charBudget.items, truncated, next_cursor: nextCursor })
    : setToonMeta(toToonSearchResults(charBudget.items, format, { truncated, next: nextCursor }), { truncated, next: nextCursor, count: charBudget.items.length });
}
