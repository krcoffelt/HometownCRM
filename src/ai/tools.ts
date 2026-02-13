import { z } from 'zod';
import type {
  AddServiceInput,
  CRMRepo,
  ConvertLeadInput,
  CreateClientInput,
} from '../crm/repo';

const optionalDateString = z.string().min(1).optional();

export const createClientSchema = z
  .object({
    name: z.string().min(1),
    email: z.string().email().optional(),
    phone: z.string().min(1).optional(),
    owner_id: z.string().min(1).optional(),
    tags: z.array(z.string().min(1)).optional(),
  })
  .strict();

export const convertLeadSchema = z
  .object({
    lead_id: z.string().min(1),
    converted_at: optionalDateString,
    deal_value: z.number().nonnegative().optional(),
    notes: z.string().min(1).optional(),
  })
  .strict();

export const addServiceSchema = z
  .object({
    client_id: z.string().min(1),
    service_code: z.string().min(1),
    qty: z.number().positive(),
    unit_price: z.number().nonnegative(),
    performed_at: optionalDateString,
    notes: z.string().min(1).optional(),
  })
  .strict();

export const searchClientSchema = z
  .object({
    query: z.string().min(1),
  })
  .strict();

export const searchLeadSchema = z
  .object({
    query: z.string().min(1),
  })
  .strict();

export const toolSchemas = {
  create_client: createClientSchema,
  convert_lead: convertLeadSchema,
  add_service: addServiceSchema,
  search_client: searchClientSchema,
  search_lead: searchLeadSchema,
} as const;

export type ToolName = keyof typeof toolSchemas;

export type ToolArgs = {
  create_client: z.infer<typeof createClientSchema>;
  convert_lead: z.infer<typeof convertLeadSchema>;
  add_service: z.infer<typeof addServiceSchema>;
  search_client: z.infer<typeof searchClientSchema>;
  search_lead: z.infer<typeof searchLeadSchema>;
};

export type ToolExecutionContext = {
  repo: CRMRepo;
};

export const mutationTools = new Set<ToolName>([
  'create_client',
  'convert_lead',
  'add_service',
]);

export const openAITools = [
  {
    type: 'function',
    name: 'create_client',
    description:
      'Create a CRM client. Required: name. Optional: email, phone, owner_id, tags.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: { type: 'string' },
        email: { type: 'string', format: 'email' },
        phone: { type: 'string' },
        owner_id: { type: 'string' },
        tags: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['name'],
    },
  },
  {
    type: 'function',
    name: 'convert_lead',
    description:
      'Convert an existing lead to a client. Required: lead_id. Optional: converted_at, deal_value, notes.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        lead_id: { type: 'string' },
        converted_at: { type: 'string' },
        deal_value: { type: 'number' },
        notes: { type: 'string' },
      },
      required: ['lead_id'],
    },
  },
  {
    type: 'function',
    name: 'add_service',
    description:
      'Add a performed service line item to a client. Required: client_id, service_code, qty, unit_price.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        client_id: { type: 'string' },
        service_code: { type: 'string' },
        qty: { type: 'number' },
        unit_price: { type: 'number' },
        performed_at: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['client_id', 'service_code', 'qty', 'unit_price'],
    },
  },
  {
    type: 'function',
    name: 'search_client',
    description: 'Search clients by name and return top 5 { id, name }.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        query: { type: 'string' },
      },
      required: ['query'],
    },
  },
  {
    type: 'function',
    name: 'search_lead',
    description: 'Search leads by name and return top 5 { id, name }.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        query: { type: 'string' },
      },
      required: ['query'],
    },
  },
] as const;

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length ? issue.path.join('.') : 'args';
      return `${path}: ${issue.message}`;
    })
    .join('; ');
}

export function validateToolArgs<K extends ToolName>(
  toolName: K,
  args: unknown,
): { success: true; data: ToolArgs[K] } | { success: false; error: string } {
  const parsed = toolSchemas[toolName].safeParse(args);
  if (!parsed.success) {
    return { success: false, error: formatZodError(parsed.error) };
  }

  return {
    success: true,
    data: parsed.data as ToolArgs[K],
  };
}

export async function executeTool(
  toolName: ToolName,
  args: ToolArgs[ToolName],
  context: ToolExecutionContext,
): Promise<unknown> {
  const { repo } = context;

  switch (toolName) {
    case 'create_client': {
      const result = repo.createClient(args as CreateClientInput);
      return result;
    }

    case 'convert_lead': {
      const result = repo.convertLead(args as ConvertLeadInput);
      return result;
    }

    case 'add_service': {
      const result = repo.addService(args as AddServiceInput);
      return result;
    }

    case 'search_client': {
      return repo.searchClients((args as ToolArgs['search_client']).query);
    }

    case 'search_lead': {
      return repo.searchLeads((args as ToolArgs['search_lead']).query);
    }

    default: {
      const exhaustiveCheck: never = toolName;
      throw new Error(`Unknown tool: ${exhaustiveCheck}`);
    }
  }
}
