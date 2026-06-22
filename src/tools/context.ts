import { z } from 'zod';
import { addDesignDecision, addEntryRelationship, getCompactEntryContext, getEntryContext, getEntry, listMemoryFacts } from '../db/schema.js';
import { DesignDecision, EntryRelationship } from '../types/context.js';
import { randomUUID } from 'crypto';
import { rebuildEntryMemory } from '../memory/rebuild.js';
import { applyCursor, applyFactCharBudget, applyItemBudget, buildNextCursor } from '../memory/budget.js';
import { withMetrics } from '../memory/response.js';
import { parseFormat, parseView } from '../memory/view.js';
import { setToonMeta, toToonEntryContext, toToonFacts } from '../memory/toon.js';

const AddDecisionSchema = z.object({
  entry_id: z.string().min(1),
  decision: z.string().min(1),
  rationale: z.string().min(1),
  alternatives_considered: z.string().optional(),
});

const AddRelationshipSchema = z.object({
  source_entry_id: z.string().min(1),
  target_entry_id: z.string().min(1),
  relationship_type: z.enum(['depends_on', 'implements', 'related_to', 'supersedes']),
});

const GetContextSchema = z.object({
  entry_id: z.string().min(1),
  view: z.enum(['full', 'summary', 'compact']).optional(),
  format: z.enum(['json', 'toon-r', 'toon-d']).optional(),
});

const GetFactsSchema = z.object({
  project_id: z.string().optional(),
  entry_id: z.string().optional(),
  kind: z.string().optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(200).optional(),
  format: z.enum(['json', 'toon-r', 'toon-d']).optional(),
  max_items: z.number().int().positive().max(200).optional(),
  max_chars: z.number().int().positive().optional(),
  cursor: z.string().optional(),
});

export async function handleAddDecision(input: unknown): Promise<any> {
  const v = AddDecisionSchema.parse(input);
  const existing = getEntry(v.entry_id);
  if (!existing) return { success: false, message: `Entry ${v.entry_id} not found` };

  const id = randomUUID();
  const now = new Date().toISOString();
  const dd: DesignDecision = {
    id, entry_id: v.entry_id, decision: v.decision,
    rationale: v.rationale, alternatives_considered: v.alternatives_considered,
    created_at: now,
  };
  addDesignDecision(dd);
  rebuildEntryMemory(v.entry_id);
  return { success: true, id, message: `Decision "${v.decision}" recorded` };
}

export async function handleAddRelationship(input: unknown): Promise<any> {
  const v = AddRelationshipSchema.parse(input);
  const source = getEntry(v.source_entry_id);
  if (!source) return { success: false, message: `Source entry ${v.source_entry_id} not found` };
  const target = getEntry(v.target_entry_id);
  if (!target) return { success: false, message: `Target entry ${v.target_entry_id} not found` };

  const id = randomUUID();
  const now = new Date().toISOString();
  const rel: EntryRelationship = {
    id, source_entry_id: v.source_entry_id, target_entry_id: v.target_entry_id,
    relationship_type: v.relationship_type, created_at: now,
  };
  addEntryRelationship(rel);
  rebuildEntryMemory(v.source_entry_id);
  rebuildEntryMemory(v.target_entry_id);
  return { success: true, id, message: `Relationship "${v.relationship_type}" created` };
}

export async function handleGetEntryContext(input: unknown): Promise<any> {
  const v = GetContextSchema.parse(input);
  const view = parseView(v.view);
  const format = parseFormat(v.format);
  if (view !== 'full') {
    const ctx = getCompactEntryContext(v.entry_id);
    if (!ctx) return { success: false, message: `Entry ${v.entry_id} not found` };
    return format === 'json' ? withMetrics({ success: true, context: ctx }) : setToonMeta(toToonEntryContext(ctx, format), { count: 1 });
  }
  const ctx = getEntryContext(v.entry_id);
  if (!ctx) return { success: false, message: `Entry ${v.entry_id} not found` };
  return { success: true, context: ctx };
}

export async function handleMemoryFactsGet(input: unknown): Promise<any> {
  const v = GetFactsSchema.parse(input);
  const format = parseFormat(v.format);
  const params = v.page || v.limit ? { page: v.page, limit: v.limit } : undefined;
  const { data, total } = listMemoryFacts({ project_id: v.project_id, entry_id: v.entry_id, kind: v.kind }, params);
  const cursorData = applyCursor(data, v.cursor);
  const itemBudget = applyItemBudget(cursorData, v.max_items);
  const charBudget = applyFactCharBudget(itemBudget.items, v.max_chars);
  const truncated = itemBudget.truncated || charBudget.truncated;
  const nextCursor = buildNextCursor(cursorData, charBudget.items, truncated);
  const result: any = format === 'json' ? withMetrics({ success: true, count: charBudget.items.length, facts: charBudget.items, truncated, next_cursor: nextCursor }) : setToonMeta(toToonFacts(charBudget.items, format), { truncated, next: nextCursor, count: charBudget.items.length });
  if (format === 'json' && params) {
    const pageNum = v.page || 1;
    const limitNum = v.limit || total;
    result.pagination = { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) || 1 };
  }
  return result;
}
