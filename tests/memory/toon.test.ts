import { describe, expect, it } from 'vitest';
import { toToonEntrySummary } from '../../src/memory/toon.js';
import { CompactEntry } from '../../src/types/context.js';

describe('TOON serializer', () => {
  const entry: CompactEntry = {
    id: 'e1',
    project_id: 'p1',
    section: 'design',
    status: 'draft',
    title: 'Release flow',
    summary_short: 'Publish package',
    summary_dense: 'sec:design',
    keywords: ['release', 'npm'],
  };

  it('serializes readable summary envelope', () => {
    const result = toToonEntrySummary(entry, 'toon-r') as any;
    expect(result.v).toBe(1);
    expect(result.fmt).toBe('toon-r');
    expect(result.d.sec).toBe('d');
  });

  it('serializes dense summary envelope', () => {
    const result = toToonEntrySummary(entry, 'toon-d') as any;
    expect(result.fmt).toBe('toon-d');
    expect(result.d[2]).toBe('d');
  });
});
