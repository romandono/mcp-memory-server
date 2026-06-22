import { ResponseFormat, ResponseView } from '../types/context.js';

export function parseView(value: unknown): ResponseView {
  return value === 'summary' || value === 'compact' ? value : 'full';
}

export function parseFormat(value: unknown): ResponseFormat {
  return value === 'toon-r' || value === 'toon-d' ? value : 'json';
}
