import { z } from 'zod';
import { getAuditLog } from '../db/schema.js';

const GetAuditSchema = z.object({
  entity_type: z.enum(['entry', 'task']).optional(),
  entity_id: z.string().optional(),
  project_id: z.string().optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(200).optional(),
});

export async function handleAuditGet(input: unknown): Promise<any> {
  const v = GetAuditSchema.parse(input);
  const params = v.page || v.limit ? { page: v.page, limit: v.limit } : undefined;
  const { data, total } = getAuditLog(
    { entity_type: v.entity_type, entity_id: v.entity_id, project_id: v.project_id },
    params,
  );
  const result: any = { success: true, count: data.length, entries: data };
  if (params) {
    const pageNum = v.page || 1;
    const limitNum = v.limit || total;
    result.pagination = { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) || 1 };
  }
  return result;
}
