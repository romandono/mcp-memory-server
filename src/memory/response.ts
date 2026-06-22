export interface ResponseMetrics {
  bytes: number;
  chars: number;
  estimated_tokens: number;
}

export function estimateTokens(chars: number): number {
  return Math.ceil(chars / 4);
}

export function buildResponseMetrics(payload: unknown): ResponseMetrics {
  const text = JSON.stringify(payload);
  const bytes = Buffer.byteLength(text, 'utf8');
  const chars = text.length;
  return {
    bytes,
    chars,
    estimated_tokens: estimateTokens(chars),
  };
}

export function withMetrics<T extends Record<string, unknown>>(payload: T): T & { metrics: ResponseMetrics } {
  return {
    ...payload,
    metrics: buildResponseMetrics(payload),
  };
}
