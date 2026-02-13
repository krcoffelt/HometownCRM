import type OpenAI from 'openai';
import type { Response, ResponseFunctionToolCall } from 'openai/resources/responses/responses';
import { getOpenAIClient, getOpenAIModel } from './openaiClient';
import {
  executeTool,
  mutationTools,
  openAITools,
  type ToolName,
  validateToolArgs,
} from './tools';
import type { CRMRepo } from '../crm/repo';

const MAX_AGENT_STEPS = 8;

const AGENT_INSTRUCTIONS = `
You are an AI CRM assistant operating a strict tool allowlist.
Rules:
1) Never guess required fields.
2) If required data is missing or ambiguous, ask a follow-up question.
3) Use search tools to resolve unknown IDs before mutating.
4) Only call provided tools; never invent tool names.
5) Keep final confirmations concise and explicit about changes.
6) This CRM focuses on leads, clients, and project/service progress.
7) If a user says a project was completed and paid, capture completion using convert_lead and/or add_service with notes.
8) Do not invent payment ledgers or invoice systems.
`;

export type AgentAction = {
  tool: string;
  args: unknown;
  result?: unknown;
  error?: string;
};

export type AgentRunParams = {
  message: string;
  userId: string;
  repo: CRMRepo;
  openai?: OpenAI;
  canMutate?: (userId: string) => boolean;
};

export type AgentRunResult = {
  reply: string;
  actions: AgentAction[];
};

function parseToolArguments(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return { __raw: raw };
  }
}

function getFunctionCalls(response: Response): ResponseFunctionToolCall[] {
  return response.output.filter(
    (item): item is ResponseFunctionToolCall => item.type === 'function_call',
  );
}

function extractReplyText(response: Response): string {
  if (response.output_text?.trim()) {
    return response.output_text.trim();
  }

  const message = response.output.find((item) => item.type === 'message');
  if (!message || message.type !== 'message') {
    return 'No assistant reply generated.';
  }

  const textParts = message.content
    .filter((part) => part.type === 'output_text')
    .map((part) => part.text);
  if (!textParts.length) {
    return 'No assistant reply generated.';
  }

  return textParts.join('\n').trim();
}

function buildAuditSummary(result: unknown): string {
  if (typeof result === 'string') return result;
  if (result && typeof result === 'object') {
    const maybeObject = result as Record<string, unknown>;
    if (typeof maybeObject.id === 'string') return `id=${maybeObject.id}`;
    if (typeof maybeObject.status === 'string') return `status=${maybeObject.status}`;
  }
  return 'ok';
}

export async function runAgent({
  message,
  userId,
  repo,
  openai = getOpenAIClient(),
  canMutate = defaultCanMutate,
}: AgentRunParams): Promise<AgentRunResult> {
  const model = getOpenAIModel();
  const actions: AgentAction[] = [];

  let response = await openai.responses.create({
    model,
    user: userId,
    instructions: AGENT_INSTRUCTIONS,
    input: [{ role: 'user', content: message }],
    tools: [...openAITools],
    tool_choice: 'auto',
  });

  for (let step = 0; step < MAX_AGENT_STEPS; step += 1) {
    const functionCalls = getFunctionCalls(response);
    if (!functionCalls.length) {
      return {
        reply: extractReplyText(response),
        actions,
      };
    }

    const toolOutputs: Array<{ type: 'function_call_output'; call_id: string; output: string }> = [];

    for (const call of functionCalls) {
      const toolName = call.name as ToolName;
      const parsedArgs = parseToolArguments(call.arguments);

      if (!Object.hasOwn(openAIToolsByName, toolName)) {
        const error = `Tool "${toolName}" is not allowed.`;
        actions.push({ tool: toolName, args: parsedArgs, error });
        toolOutputs.push({
          type: 'function_call_output',
          call_id: call.call_id,
          output: JSON.stringify({ ok: false, error }),
        });
        continue;
      }

      const validated = validateToolArgs(toolName, parsedArgs);
      if (!validated.success) {
        const error = `Invalid arguments for ${toolName}: ${validated.error}`;
        actions.push({ tool: toolName, args: parsedArgs, error });
        toolOutputs.push({
          type: 'function_call_output',
          call_id: call.call_id,
          output: JSON.stringify({ ok: false, error }),
        });
        continue;
      }

      if (mutationTools.has(toolName) && !canMutate(userId)) {
        const error = `User ${userId} is not allowed to mutate CRM records.`;
        actions.push({ tool: toolName, args: validated.data, error });
        toolOutputs.push({
          type: 'function_call_output',
          call_id: call.call_id,
          output: JSON.stringify({ ok: false, error }),
        });
        continue;
      }

      try {
        const result = await executeTool(toolName, validated.data, { repo });
        actions.push({
          tool: toolName,
          args: validated.data,
          result,
        });

        if (mutationTools.has(toolName)) {
          auditMutation({
            userId,
            tool: toolName,
            args: validated.data,
            resultSummary: buildAuditSummary(result),
          });
        }

        toolOutputs.push({
          type: 'function_call_output',
          call_id: call.call_id,
          output: JSON.stringify({ ok: true, result }),
        });
      } catch (error) {
        const messageText =
          error instanceof Error ? error.message : 'Tool execution failed.';
        actions.push({
          tool: toolName,
          args: validated.data,
          error: messageText,
        });
        toolOutputs.push({
          type: 'function_call_output',
          call_id: call.call_id,
          output: JSON.stringify({ ok: false, error: messageText }),
        });
      }
    }

    response = await openai.responses.create({
      model,
      user: userId,
      instructions: AGENT_INSTRUCTIONS,
      previous_response_id: response.id,
      input: toolOutputs,
      tools: [...openAITools],
      tool_choice: 'auto',
    });
  }

  return {
    reply:
      'I could not finish that request in a safe number of tool steps. Please simplify and try again.',
    actions,
  };
}

export function defaultCanMutate(_userId: string): boolean {
  // TODO: Replace with real authZ policy checks (role/tenant/resource scope).
  return true;
}

function auditMutation(params: {
  userId: string;
  tool: ToolName;
  args: unknown;
  resultSummary: string;
}): void {
  const event = {
    timestamp: new Date().toISOString(),
    userId: params.userId,
    tool: params.tool,
    args: params.args,
    resultSummary: params.resultSummary,
  };
  // eslint-disable-next-line no-console
  console.log('[crm-audit]', JSON.stringify(event));
}

const openAIToolsByName: Record<string, unknown> = Object.fromEntries(
  openAITools.map((tool: { name: string }) => [tool.name, tool]),
);
