import { getOpenAIModel } from '../../src/ai/openaiClient';
import { json } from './shared';

export async function handler(event: { httpMethod: string }) {
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method not allowed.' });
  }

  return json(200, {
    ok: true,
    model: getOpenAIModel(),
  });
}
