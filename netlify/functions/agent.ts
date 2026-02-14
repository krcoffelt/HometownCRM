import { runAgent } from '../../src/ai/agentRunner';
import { getCRMRepo } from '../../src/crm/repo';
import { getAuthorizedUserId, json, parseBody } from './shared';

type AgentBody = {
  message?: string;
  userId?: string;
};

function canMutate(_userId: string): boolean {
  return true;
}

export async function handler(event: {
  httpMethod: string;
  body: string | null;
  headers: Record<string, string | undefined>;
}) {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed.' });
  }

  const authorizedUserId = getAuthorizedUserId(event);
  if (!authorizedUserId) {
    return json(401, { error: 'Session expired or invalid token.' });
  }

  const body = parseBody<AgentBody>(event);
  const message = body?.message;
  const userId = authorizedUserId || body?.userId;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return json(400, { error: 'message is required and must be a non-empty string.' });
  }

  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    return json(400, { error: 'userId is required and must be a non-empty string.' });
  }

  try {
    const result = await runAgent({
      message,
      userId,
      repo: getCRMRepo(),
      canMutate,
    });

    return json(200, result);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to run AI CRM assistant.';
    return json(500, { error: errorMessage });
  }
}
