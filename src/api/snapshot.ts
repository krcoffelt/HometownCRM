import { Router } from 'express';
import { getOpenAIClient, getOpenAIModel } from '../ai/openaiClient';

export const snapshotRouter = Router();

snapshotRouter.get('/health', (_req, res) => {
  res.json({
    ok: true,
    model: getOpenAIModel(),
  });
});

snapshotRouter.post('/ai/snapshot', async (req, res) => {
  const payload = req.body as {
    metrics?: Record<string, unknown>;
    topLeads?: unknown[];
    topClients?: unknown[];
  };

  const metrics = payload.metrics || {};
  const topLeads = Array.isArray(payload.topLeads) ? payload.topLeads : [];
  const topClients = Array.isArray(payload.topClients) ? payload.topClients : [];

  const prompt = `
You are a concise operations strategist for a small marketing agency.
Write a short snapshot with:
1) Most urgent lead action
2) Most important client action
3) Revenue risk and revenue opportunity
4) One focus recommendation for the next 48 hours

Keep it under 140 words and use plain language.

Metrics:
${JSON.stringify(metrics, null, 2)}

Top leads:
${JSON.stringify(topLeads, null, 2)}

Top clients:
${JSON.stringify(topClients, null, 2)}
`.trim();

  try {
    const openai = getOpenAIClient();
    const model = getOpenAIModel();
    const response = await openai.responses.create({
      model,
      input: prompt,
      max_output_tokens: 260,
    });

    res.json({
      model,
      text: response.output_text || 'No summary returned.',
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'OpenAI request failed.';
    res.status(500).json({ error: errorMessage });
  }
});
