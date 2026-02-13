import { describe, expect, it, vi } from 'vitest';
import type OpenAI from 'openai';
import { runAgent } from '../src/ai/agentRunner';
import { CRMRepo } from '../src/crm/repo';

describe('agent tool loop', () => {
  it('executes tool calls and returns machine-readable actions', async () => {
    const mockCreate = vi
      .fn()
      .mockResolvedValueOnce({
        id: 'resp_1',
        output_text: '',
        output: [
          {
            type: 'function_call',
            name: 'create_client',
            call_id: 'call_1',
            arguments: JSON.stringify({
              name: 'ACME Landscaping',
              email: 'a@acme.com',
            }),
          },
        ],
      })
      .mockResolvedValueOnce({
        id: 'resp_2',
        output_text: 'Done — created client ACME Landscaping.',
        output: [
          {
            type: 'message',
            role: 'assistant',
            content: [{ type: 'output_text', text: 'Done — created client ACME Landscaping.' }],
          },
        ],
      });

    const mockOpenAI = {
      responses: {
        create: mockCreate,
      },
    } as unknown as OpenAI;

    const repo = new CRMRepo();
    const result = await runAgent({
      message: 'Create a client named ACME Landscaping, email a@acme.com',
      userId: 'user_1',
      repo,
      openai: mockOpenAI,
      canMutate: () => true,
    });

    expect(result.reply).toContain('Done');
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]?.tool).toBe('create_client');
    expect(result.actions[0]?.error).toBeUndefined();
    expect((result.actions[0]?.result as { client: { name: string } }).client.name).toBe(
      'ACME Landscaping',
    );

    expect(mockCreate).toHaveBeenCalledTimes(2);
    const secondCallPayload = mockCreate.mock.calls[1]?.[0] as {
      input: Array<{ type: string }>;
      previous_response_id: string;
    };
    expect(secondCallPayload.previous_response_id).toBe('resp_1');
    expect(secondCallPayload.input[0]?.type).toBe('function_call_output');
  });
});
