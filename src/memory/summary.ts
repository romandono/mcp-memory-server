import { createHash } from 'crypto';
import { DesignDecision, EntryRelationship, EntrySummary, SddEntry } from '../types/context.js';

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'as', 'at', 'by', 'con', 'de', 'del', 'el', 'en', 'for', 'in', 'la', 'las', 'los',
  'of', 'on', 'or', 'para', 'por', 'the', 'to', 'un', 'una', 'y',
]);

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function clamp(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

function extractKeywords(entry: SddEntry, decisions: DesignDecision[]): string[] {
  const source = `${entry.title} ${entry.content} ${decisions.map(d => d.decision).join(' ')}`.toLowerCase();
  const counts = new Map<string, number>();

  for (const token of source.match(/[a-z0-9_:-]{3,}/g) || []) {
    if (STOP_WORDS.has(token)) continue;
    counts.set(token, (counts.get(token) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([token]) => token);
}

function buildRelationHints(relationships: EntryRelationship[]): string[] {
  return relationships.slice(0, 6).map(rel => `${rel.relationship_type}:${rel.target_entry_id === rel.source_entry_id ? rel.source_entry_id : rel.target_entry_id}`);
}

export function buildEntrySummary(entry: SddEntry, decisions: DesignDecision[], relationships: EntryRelationship[], now = new Date().toISOString()): EntrySummary {
  const keywords = extractKeywords(entry, decisions);
  const contentPreview = clamp(normalizeWhitespace(entry.content), 140);
  const summaryShort = clamp(normalizeWhitespace([entry.title, contentPreview].filter(Boolean).join(' :: ')) || entry.title, 220);
  const denseParts = [
    `sec:${entry.section}`,
    `st:${entry.status}`,
    `title:${clamp(normalizeWhitespace(entry.title), 80)}`,
  ];

  if (contentPreview) denseParts.push(`body:${contentPreview}`);
  if (decisions.length > 0) denseParts.push(`decisions:[${decisions.slice(0, 5).map(d => clamp(normalizeWhitespace(d.decision), 60)).join('|')}]`);
  if (relationships.length > 0) denseParts.push(`relations:[${buildRelationHints(relationships).join('|')}]`);
  if (keywords.length > 0) denseParts.push(`kw:[${keywords.join('|')}]`);

  const sourceHash = createHash('sha256')
    .update(JSON.stringify({
      title: entry.title,
      content: entry.content,
      section: entry.section,
      status: entry.status,
      decisions: decisions.map(d => [d.decision, d.rationale, d.alternatives_considered]),
      relationships: relationships.map(r => [r.source_entry_id, r.target_entry_id, r.relationship_type]),
    }))
    .digest('hex');

  return {
    entry_id: entry.id,
    summary_short: summaryShort,
    summary_dense: denseParts.join('\n'),
    keywords,
    source_hash: sourceHash,
    version: 1,
    updated_at: now,
  };
}
