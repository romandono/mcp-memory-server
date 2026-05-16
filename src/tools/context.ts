import { z } from 'zod';
import { addFileChange, addDesignDecision, addEntryRelationship, getEntryContext, getEntry } from '../db/schema.js';
import { FileChange, DesignDecision, EntryRelationship } from '../types/context.js';
import { randomUUID } from 'crypto';

const AddFileChangeSchema = z.object({
  entry_id: z.string().min(1),
  file_path: z.string().min(1),
  change_type: z.enum(['added', 'modified', 'removed']),
  line_start: z.number().int().positive().optional(),
  line_end: z.number().int().positive().optional(),
  summary: z.string().min(1),
});

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
});

export async function handleAddFileChange(input: unknown): Promise<any> {
  const v = AddFileChangeSchema.parse(input);
  const existing = getEntry(v.entry_id);
  if (!existing) return { success: false, message: `Entry ${v.entry_id} not found` };

  const id = randomUUID();
  const now = new Date().toISOString();
  const fc: FileChange = {
    id, entry_id: v.entry_id, file_path: v.file_path,
    change_type: v.change_type, line_start: v.line_start, line_end: v.line_end,
    summary: v.summary, created_at: now,
  };
  addFileChange(fc);
  return { success: true, id, message: `File change recorded for ${v.file_path}` };
}

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
  return { success: true, id, message: `Relationship "${v.relationship_type}" created` };
}

export async function handleGetEntryContext(input: unknown): Promise<any> {
  const v = GetContextSchema.parse(input);
  const ctx = getEntryContext(v.entry_id);
  if (!ctx) return { success: false, message: `Entry ${v.entry_id} not found` };
  return { success: true, context: ctx };
}
