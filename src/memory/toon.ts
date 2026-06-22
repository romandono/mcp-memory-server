import {
  CompactEntry,
  CompactEntryContext,
  CompactTask,
  DesignDecision,
  EntryRelationship,
  MemoryFact,
  ProjectCompact,
  ResponseFormat,
} from '../types/context.js';

function encodeSection(section: string): string {
  return ({ plan: 'p', design: 'd', tasks: 't', general: 'g' } as Record<string, string>)[section] || section;
}

function encodeEntryStatus(status: string): string {
  return ({ draft: 'dr', review: 'rv', done: 'dn' } as Record<string, string>)[status] || status;
}

function encodeTaskStatus(status: string): string {
  return ({ pending: 'pd', in_progress: 'ip', completed: 'cp', cancelled: 'cx' } as Record<string, string>)[status] || status;
}

function encodePriority(priority: string): string {
  return ({ low: 'l', medium: 'm', high: 'h', critical: 'c' } as Record<string, string>)[priority] || priority;
}

function encodeRelationship(type: string): string {
  return ({ depends_on: 'dep', implements: 'imp', related_to: 'rel', supersedes: 'sup' } as Record<string, string>)[type] || type;
}

function encodeEntry(entry: CompactEntry, format: ResponseFormat): unknown {
  if (format === 'toon-d') {
    return [entry.id, entry.project_id, encodeSection(entry.section), encodeEntryStatus(entry.status), entry.title, entry.summary_short, entry.keywords];
  }

  return {
    id: entry.id,
    p: entry.project_id,
    sec: encodeSection(entry.section),
    st: encodeEntryStatus(entry.status),
    ttl: entry.title,
    sum: entry.summary_short,
    kw: entry.keywords,
  };
}

function encodeDecision(decision: DesignDecision, format: ResponseFormat): unknown {
  if (format === 'toon-d') return [decision.id, decision.decision, decision.rationale];
  return { id: decision.id, d: decision.decision, r: decision.rationale };
}

function encodeRelationshipEntry(relationship: EntryRelationship, format: ResponseFormat): unknown {
  if (format === 'toon-d') return [relationship.source_entry_id, relationship.target_entry_id, encodeRelationship(relationship.relationship_type)];
  return { s: relationship.source_entry_id, t: relationship.target_entry_id, rt: encodeRelationship(relationship.relationship_type) };
}

function encodeFact(fact: MemoryFact, format: ResponseFormat): unknown {
  if (format === 'toon-d') return [fact.kind, fact.subject, fact.predicate, fact.object, fact.weight];
  return { k: fact.kind, s: fact.subject, p: fact.predicate, o: fact.object, w: fact.weight };
}

function encodeTask(task: CompactTask, format: ResponseFormat): unknown {
  if (format === 'toon-d') return [task.id, task.project_id, task.sdd_entry_id || null, task.title, encodeTaskStatus(task.status), encodePriority(task.priority)];
  return { id: task.id, p: task.project_id, e: task.sdd_entry_id || null, ttl: task.title, st: encodeTaskStatus(task.status), pr: encodePriority(task.priority) };
}

export function wrapToon(type: string, data: unknown, format: ResponseFormat, meta?: { truncated?: boolean; count?: number; next?: string | null }): unknown {
  if (format === 'json') return data;
  return {
    v: 1,
    fmt: format,
    t: type,
    ok: 1,
    d: data,
    m: { tr: meta?.truncated ? 1 : 0, n: meta?.count || 0, next: meta?.next || null },
  };
}

export function toToonEntrySummary(entry: CompactEntry, format: ResponseFormat): unknown {
  return wrapToon('entry_summary', encodeEntry(entry, format), format, { count: 1 });
}

export function toToonEntryContext(context: CompactEntryContext, format: ResponseFormat): unknown {
  return wrapToon('entry_ctx', {
    e: encodeEntry(context.entry, format),
    ds: context.decisions.map(decision => encodeDecision(decision, format)),
    rs: context.relationships.map(relationship => encodeRelationshipEntry(relationship, format)),
    fs: context.facts.map(fact => encodeFact(fact, format)),
  }, format, { count: 1 });
}

export function toToonSearchResults(entries: CompactEntry[], format: ResponseFormat, meta?: { truncated?: boolean; next?: string | null }): unknown {
  return wrapToon('entry_search', { es: entries.map(entry => encodeEntry(entry, format)) }, format, { count: entries.length, truncated: meta?.truncated, next: meta?.next || null });
}

export function toToonProjectCompact(projectCompact: ProjectCompact, format: ResponseFormat): unknown {
  return wrapToon('project_compact', {
    p: format === 'toon-d'
      ? [projectCompact.project.id, projectCompact.project.name, projectCompact.project.status]
      : { id: projectCompact.project.id, n: projectCompact.project.name, st: projectCompact.project.status },
    es: projectCompact.entries.map(entry => encodeEntry(entry, format)),
    ts: projectCompact.tasks.map(task => encodeTask(task, format)),
    cs: projectCompact.classifications.map(classification => format === 'toon-d'
      ? [classification.id, classification.tag, classification.confidence]
      : { id: classification.id, t: classification.tag, c: classification.confidence }),
  }, format, { count: projectCompact.entries.length + projectCompact.tasks.length });
}

export function toToonFacts(facts: MemoryFact[], format: ResponseFormat): unknown {
  return wrapToon('facts', { fs: facts.map(fact => encodeFact(fact, format)) }, format, { count: facts.length });
}

export function setToonMeta(payload: any, meta: { truncated?: boolean; next?: string | null; count?: number }): any {
  if (!payload || typeof payload !== 'object' || !('m' in payload)) return payload;
  payload.m = {
    ...payload.m,
    tr: meta.truncated ? 1 : payload.m.tr,
    next: meta.next !== undefined ? meta.next : payload.m.next,
    n: meta.count !== undefined ? meta.count : payload.m.n,
  };
  return payload;
}
