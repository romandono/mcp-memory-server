import { createHash } from 'crypto';
import { DesignDecision, EntryRelationship, MemoryFact, SddEntry } from '../types/context.js';

function factId(parts: string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 24);
}

export function buildEntryFacts(entry: SddEntry, decisions: DesignDecision[], relationships: EntryRelationship[], now = new Date().toISOString()): MemoryFact[] {
  const facts: MemoryFact[] = [];
  const subject = `entry:${entry.id}`;

  facts.push({
    id: factId([entry.id, 'section', entry.section]),
    project_id: entry.project_id,
    entry_id: entry.id,
    kind: 'section',
    subject,
    predicate: 'has_section',
    object: entry.section,
    weight: 1,
    source: 'entry',
    created_at: now,
  });

  facts.push({
    id: factId([entry.id, 'status', entry.status]),
    project_id: entry.project_id,
    entry_id: entry.id,
    kind: 'status',
    subject,
    predicate: 'has_status',
    object: entry.status,
    weight: 1,
    source: 'entry',
    created_at: now,
  });

  for (const decision of decisions) {
    facts.push({
      id: factId([entry.id, 'decision', decision.id]),
      project_id: entry.project_id,
      entry_id: entry.id,
      kind: 'decision',
      subject,
      predicate: 'decides',
      object: decision.decision,
      weight: 0.9,
      source: `decision:${decision.id}`,
      created_at: now,
    });
  }

  for (const relationship of relationships) {
    const relatedEntryId = relationship.source_entry_id === entry.id ? relationship.target_entry_id : relationship.source_entry_id;
    facts.push({
      id: factId([entry.id, 'relationship', relationship.id]),
      project_id: entry.project_id,
      entry_id: entry.id,
      kind: 'relationship',
      subject,
      predicate: relationship.relationship_type,
      object: `entry:${relatedEntryId}`,
      weight: 0.8,
      source: `relationship:${relationship.id}`,
      created_at: now,
    });
  }

  return facts;
}
