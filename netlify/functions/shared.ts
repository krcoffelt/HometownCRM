import { extractBearerToken, verifyAuthToken } from '../../src/api/authShared';

export function json(statusCode: number, body: Record<string, unknown>) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(body),
  };
}

export function parseBody<T>(event: { body: string | null }): T | null {
  if (!event.body) return null;
  try {
    return JSON.parse(event.body) as T;
  } catch {
    return null;
  }
}

export function getAuthorizedUserId(event: { headers: Record<string, string | undefined> }): string | null {
  const authHeader = event.headers.authorization || event.headers.Authorization;
  const token = extractBearerToken(authHeader);
  if (!token) return null;

  const payload = verifyAuthToken(token);
  return payload?.sub || null;
}
