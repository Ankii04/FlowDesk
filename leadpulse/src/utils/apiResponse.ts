import { Response } from 'express';

// ─────────────────────────────────────────────
// Standard API Response Helpers
// All controllers use these to return consistent shapes:
// { success, data, message, meta }
// ─────────────────────────────────────────────

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ApiSuccessResponse<T> {
  success: true;
  message?: string;
  data: T;
  meta?: PaginationMeta;
}

/**
 * Send a 200 OK success response
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = 200,
): Response {
  const body: ApiSuccessResponse<T> = { success: true, data };
  if (message) body.message = message;
  return res.status(statusCode).json(body);
}

/**
 * Send a 201 Created response
 */
export function sendCreated<T>(res: Response, data: T, message?: string): Response {
  return sendSuccess(res, data, message ?? 'Resource created successfully', 201);
}

/**
 * Send a paginated list response
 */
export function sendPaginated<T>(
  res: Response,
  data: T[],
  total: number,
  page: number,
  limit: number,
  message?: string,
): Response {
  const totalPages = Math.ceil(total / limit);
  const body: ApiSuccessResponse<T[]> = {
    success: true,
    data,
    meta: { page, limit, total, totalPages },
  };
  if (message) body.message = message;
  return res.status(200).json(body);
}

/**
 * Parse pagination query params with safe defaults
 */
export function parsePagination(query: Record<string, unknown>): {
  page: number;
  limit: number;
  skip: number;
} {
  const page = Math.max(1, parseInt(String(query.page ?? '1'), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit ?? '20'), 10)));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}
