import { issueAuthToken, validateCredentials } from '../../src/api/authShared';
import { json, parseBody } from './shared';

type LoginBody = {
  username?: string;
  password?: string;
};

export async function handler(event: { httpMethod: string; body: string | null }) {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed.' });
  }

  const body = parseBody<LoginBody>(event);
  const username = body?.username;
  const password = body?.password;

  if (!username || typeof username !== 'string' || !username.trim()) {
    return json(400, { error: 'username is required and must be a non-empty string.' });
  }

  if (!password || typeof password !== 'string') {
    return json(400, { error: 'password is required and must be a string.' });
  }

  try {
    if (!validateCredentials(username, password)) {
      return json(401, { error: 'Invalid credentials. Please try again.' });
    }

    const normalizedUsername = username.trim().toLowerCase();
    return json(200, {
      token: issueAuthToken(normalizedUsername),
      userId: normalizedUsername,
    });
  } catch (error) {
    return json(500, { error: 'Authentication service is not configured.' });
  }
}
