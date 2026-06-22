import { z } from 'zod';
import { addDesignDecision, addEntryRelationship, getEntryContext, getEntry } from '../db/schema.js';
import { DesignDecision, EntryRelationship } from '../types/context.js';
import { randomUUID } from 'crypto';

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
