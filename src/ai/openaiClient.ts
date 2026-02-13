import OpenAI from 'openai';

let clientSingleton: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY in environment.');
  }

  if (!clientSingleton) {
    clientSingleton = new OpenAI({ apiKey });
  }

  return clientSingleton;
}

export function getOpenAIModel(): string {
  return process.env.OPENAI_MODEL || 'gpt-5-nano';
}
