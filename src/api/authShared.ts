import crypto from 'crypto';

const AUTH_TTL_SECONDS = 60 * 60 * 12;
const DEFAULT_USERNAME = 'krcoffelt@gmail.com';
const DEFAULT_PASSWORD = 'Bvstars_1995';
const DEFAULT_AUTH_SECRET = 'hometown-crm-default-auth-secret';

type AuthTokenPayload = {
  sub: string;
  iat: number;
  exp: number;
};

function toBase64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function getConfiguredUsername(): string {
  const username = process.env.AUTH_USERNAME?.trim() || DEFAULT_USERNAME;
  return username.trim().toLowerCase();
}

function getConfiguredPassword(): string {
  const password = process.env.AUTH_PASSWORD || DEFAULT_PASSWORD;
  return password;
}

function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET || DEFAULT_AUTH_SECRET;
  return secret;
}

function signPayload(encodedPayload: string): string {
  return crypto
    .createHmac('sha256', getAuthSecret())
    .update(encodedPayload)
    .digest('base64url');
}

export function validateCredentials(username: string, password: string): boolean {
  const normalized = username.trim().toLowerCase();
  return normalized === getConfiguredUsername() && password === getConfiguredPassword();
}

export function issueAuthToken(username: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: AuthTokenPayload = {
    sub: username.trim().toLowerCase(),
    iat: now,
    exp: now + AUTH_TTL_SECONDS,
  };

  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyAuthToken(token: string): AuthTokenPayload | null {
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return null;

  const expectedSignature = signPayload(encodedPayload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (signatureBuffer.length !== expectedBuffer.length) {
    return null;
  }
  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload)) as Partial<AuthTokenPayload>;
    if (!payload || typeof payload !== 'object') return null;
    if (typeof payload.sub !== 'string' || !payload.sub.trim()) return null;
    if (typeof payload.iat !== 'number' || typeof payload.exp !== 'number') return null;

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now) return null;

    return {
      sub: payload.sub,
      iat: payload.iat,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

export function extractBearerToken(value: string | undefined): string | null {
  if (!value) return null;
  const [scheme, token] = value.split(' ');
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== 'bearer') return null;
  return token.trim() || null;
}
