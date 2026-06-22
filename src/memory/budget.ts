import { CompactEntry, MemoryFact } from '../types/context.js';

export interface BudgetOptions {
  maxItems?: number;
  maxChars?: number;
}

export interface BudgetResult<T> {
  items: T[];
  truncated: boolean;
}

export interface CursorResult<T> extends BudgetResult<T> {
  nextCursor: string | null;
}

export function applyItemBudget<T>(items: T[], maxItems?: number): BudgetResult<T> {
  if (!maxItems || maxItems <= 0 || items.length <= maxItems) return { items, truncated: false };
  return { items: items.slice(0, maxItems), truncated: true };
}

export function applyCompactEntryCharBudget(entries: CompactEntry[], maxChars?: number): BudgetResult<CompactEntry> {
  if (!maxChars || maxChars <= 0) return { items: entries, truncated: false };
  const result: CompactEntry[] = [];
  let total = 0;
  for (const entry of entries) {
    const size = entry.title.length + entry.summary_short.length + entry.summary_dense.length + entry.keywords.join('').length;
    if (result.length > 0 && total + size > maxChars) return { items: result, truncated: true };
    result.push(entry);
    total += size;
  }
  return { items: result, truncated: false };
}

export function applyFactCharBudget(facts: MemoryFact[], maxChars?: number): BudgetResult<MemoryFact> {
  if (!maxChars || maxChars <= 0) return { items: facts, truncated: false };
  const result: MemoryFact[] = [];
  let total = 0;
  for (const fact of facts) {
    const size = fact.kind.length + fact.subject.length + fact.predicate.length + fact.object.length;
    if (result.length > 0 && total + size > maxChars) return { items: result, truncated: true };
    result.push(fact);
    total += size;
  }
  return { items: result, truncated: false };
}

export function applyCursor<T extends { id: string }>(items: T[], cursor?: string): T[] {
  if (!cursor) return items;
  const index = items.findIndex(item => item.id === cursor);
  if (index === -1) return items;
  return items.slice(index + 1);
}

export function buildNextCursor<T extends { id: string }>(sourceItems: T[], returnedItems: T[], truncated: boolean): string | null {
  if (!truncated || returnedItems.length === 0) return null;
  const lastId = returnedItems[returnedItems.length - 1]?.id;
  if (!lastId) return null;
  const sourceIndex = sourceItems.findIndex(item => item.id === lastId);
  return sourceIndex >= 0 && sourceIndex < sourceItems.length - 1 ? lastId : null;
}
