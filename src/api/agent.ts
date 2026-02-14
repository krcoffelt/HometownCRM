import { Router } from 'express';
import { runAgent } from '../ai/agentRunner';
import { getCRMRepo } from '../crm/repo';
import { requireAuth } from './auth';

export const agentRouter = Router();
agentRouter.use(requireAuth);

export function canMutate(_userId: string): boolean {
  // TODO: enforce role-based and tenant-level authorization.
  return true;
}

agentRouter.post('/agent', async (req, res) => {
  const body = req.body as Partial<{ message: string; userId: string }>;
  const message = body.message;
  const userId = (res.locals.userId as string | undefined) || body.userId;

  if (!message || typeof message !== 'string' || !message.trim()) {
    res.status(400).json({ error: 'message is required and must be a non-empty string.' });
    return;
  }

  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    res.status(400).json({ error: 'userId is required and must be a non-empty string.' });
    return;
  }

  try {
    const result = await runAgent({
      message,
      userId,
      repo: getCRMRepo(),
      canMutate,
    });

    res.json(result);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to run AI CRM assistant.';
    res.status(500).json({ error: errorMessage });
  }
});
