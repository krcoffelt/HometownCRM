import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import {
  extractBearerToken,
  issueAuthToken,
  validateCredentials,
  verifyAuthToken,
} from './authShared';

export const authRouter = Router();

authRouter.post('/auth/login', (req, res) => {
  const body = req.body as Partial<{ username: string; password: string }>;
  const username = body.username;
  const password = body.password;

  if (!username || typeof username !== 'string' || !username.trim()) {
    res.status(400).json({ error: 'username is required and must be a non-empty string.' });
    return;
  }

  if (!password || typeof password !== 'string') {
    res.status(400).json({ error: 'password is required and must be a string.' });
    return;
  }

  try {
    const isValid = validateCredentials(username, password);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid credentials. Please try again.' });
      return;
    }

    const normalizedUsername = username.trim().toLowerCase();
    res.json({
      token: issueAuthToken(normalizedUsername),
      userId: normalizedUsername,
    });
  } catch (error) {
    res.status(500).json({ error: 'Authentication service is not configured.' });
  }
});

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    res.status(401).json({ error: 'Missing bearer token.' });
    return;
  }

  try {
    const payload = verifyAuthToken(token);
    if (!payload) {
      res.status(401).json({ error: 'Session expired or invalid token.' });
      return;
    }

    res.locals.userId = payload.sub;
    next();
  } catch (error) {
    res.status(500).json({ error: 'Authentication failed.' });
  }
}
