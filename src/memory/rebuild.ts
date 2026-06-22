import {
  getDesignDecisions,
  getAllEntries,
  getEntry,
  getEntryRelationships,
  replaceEntryFacts,
  upsertEntrySummary,
} from '../db/schema.js';
import { buildEntryFacts } from './facts.js';
import { buildEntrySummary } from './summary.js';

export function rebuildEntryMemory(entryId: string): boolean {
  const entry = getEntry(entryId);
  if (!entry) return false;

  const decisions = getDesignDecisions(entryId);
  const relationships = getEntryRelationships(entryId);
  const summary = buildEntrySummary(entry, decisions, relationships);
  const facts = buildEntryFacts(entry, decisions, relationships, summary.updated_at);

  upsertEntrySummary(summary);
  replaceEntryFacts(entryId, facts);
  return true;
}

export function rebuildProjectMemory(projectId: string): number {
  const { data: entries } = getAllEntries();
  for (const entry of entries) {
    if (entry.project_id === projectId) rebuildEntryMemory(entry.id);
  }
  return entries.filter(entry => entry.project_id === projectId).length;
}

export function rebuildAllMemory(): number {
  const { data: entries } = getAllEntries();
  for (const entry of entries) {
    rebuildEntryMemory(entry.id);
  }
  return entries.length;
}
