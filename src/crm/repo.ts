const IDEMPOTENCY_WINDOW_MS = 5 * 60 * 1000;

export type ClientRecord = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  owner_id?: string;
  tags: string[];
  created_at: string;
  updated_at: string;
};

export type LeadRecord = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  status: 'open' | 'converted';
  converted_at?: string;
  deal_value?: number;
  notes?: string;
  converted_client_id?: string;
  created_at: string;
  updated_at: string;
};

export type ServiceRecord = {
  id: string;
  client_id: string;
  service_code: string;
  qty: number;
  unit_price: number;
  total: number;
  performed_at: string;
  notes?: string;
  created_at: string;
};

export type CreateClientInput = {
  name: string;
  email?: string;
  phone?: string;
  owner_id?: string;
  tags?: string[];
};

export type ConvertLeadInput = {
  lead_id: string;
  converted_at?: string;
  deal_value?: number;
  notes?: string;
};

export type AddServiceInput = {
  client_id: string;
  service_code: string;
  qty: number;
  unit_price: number;
  performed_at?: string;
  notes?: string;
};

export type SearchResult = {
  id: string;
  name: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function makeId(prefix: string, counter: number): string {
  return `${prefix}_${counter.toString().padStart(4, '0')}`;
}

export class CRMRepo {
  private clientCounter = 1000;
  private leadCounter = 1000;
  private serviceCounter = 1000;

  private clients: ClientRecord[] = [];
  private leads: LeadRecord[] = [];
  private services: ServiceRecord[] = [];

  constructor() {
    const createdAt = nowIso();
    this.clients = [
      {
        id: 'client_0001',
        name: 'Northline Dental',
        email: 'hello@northlinedental.com',
        phone: '(816) 555-0101',
        owner_id: 'owner_kyle',
        tags: ['retainer', 'healthcare'],
        created_at: createdAt,
        updated_at: createdAt,
      },
      {
        id: 'client_0002',
        name: 'Mosaic Fitness',
        email: 'team@mosaicfit.co',
        phone: '(913) 555-0189',
        owner_id: 'owner_kyle',
        tags: ['prospect'],
        created_at: createdAt,
        updated_at: createdAt,
      },
    ];

    this.leads = [
      {
        id: '123',
        name: 'ACME Landscaping',
        email: 'a@acme.com',
        phone: '(555) 010-1000',
        status: 'open',
        created_at: createdAt,
        updated_at: createdAt,
      },
      {
        id: 'lead_0002',
        name: 'Summit Legal Group',
        email: 'ops@summitlegalgroup.com',
        phone: '(555) 010-2000',
        status: 'open',
        created_at: createdAt,
        updated_at: createdAt,
      },
    ];

    this.clientCounter = 3;
    this.leadCounter = 3;
    this.serviceCounter = 1;
  }

  createClient(input: CreateClientInput): { client: ClientRecord; idempotent: boolean } {
    const now = Date.now();
    const nameNormalized = normalizeText(input.name);
    const emailNormalized = input.email ? normalizeText(input.email) : null;

    const existing = this.clients.find((candidate) => {
      const createdAtMs = new Date(candidate.created_at).getTime();
      if (now - createdAtMs > IDEMPOTENCY_WINDOW_MS) {
        return false;
      }

      if (emailNormalized) {
        return (
          normalizeText(candidate.name) === nameNormalized &&
          !!candidate.email &&
          normalizeText(candidate.email) === emailNormalized
        );
      }

      return normalizeText(candidate.name) === nameNormalized;
    });

    if (existing) {
      return { client: existing, idempotent: true };
    }

    const timestamp = nowIso();
    const created: ClientRecord = {
      id: makeId('client', this.clientCounter++),
      name: input.name.trim(),
      email: input.email?.trim() || undefined,
      phone: input.phone?.trim() || undefined,
      owner_id: input.owner_id?.trim() || undefined,
      tags: (input.tags ?? []).map((tag) => tag.trim()).filter(Boolean),
      created_at: timestamp,
      updated_at: timestamp,
    };

    this.clients.unshift(created);
    return { client: created, idempotent: false };
  }

  convertLead(input: ConvertLeadInput): {
    lead: LeadRecord;
    client: ClientRecord;
    idempotent: boolean;
  } {
    const lead = this.leads.find((candidate) => candidate.id === input.lead_id);
    if (!lead) {
      throw new Error(`Lead ${input.lead_id} not found.`);
    }

    const convertedAt = input.converted_at || nowIso();
    const updateTimestamp = nowIso();
    lead.status = 'converted';
    lead.converted_at = convertedAt;
    lead.deal_value = input.deal_value;
    lead.notes = input.notes;
    lead.updated_at = updateTimestamp;

    const { client, idempotent } = this.createClient({
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      tags: ['converted-lead'],
    });

    lead.converted_client_id = client.id;
    return { lead, client, idempotent };
  }

  addService(input: AddServiceInput): { service: ServiceRecord; client: ClientRecord } {
    const client = this.clients.find((candidate) => candidate.id === input.client_id);
    if (!client) {
      throw new Error(`Client ${input.client_id} not found.`);
    }

    const created: ServiceRecord = {
      id: makeId('service', this.serviceCounter++),
      client_id: client.id,
      service_code: input.service_code,
      qty: input.qty,
      unit_price: input.unit_price,
      total: input.qty * input.unit_price,
      performed_at: input.performed_at || nowIso(),
      notes: input.notes,
      created_at: nowIso(),
    };

    this.services.unshift(created);
    return { service: created, client };
  }

  searchClients(query: string): SearchResult[] {
    const q = normalizeText(query);
    return this.clients
      .filter((client) => normalizeText(client.name).includes(q))
      .slice(0, 5)
      .map((client) => ({ id: client.id, name: client.name }));
  }

  searchLeads(query: string): SearchResult[] {
    const q = normalizeText(query);
    return this.leads
      .filter((lead) => normalizeText(lead.name).includes(q))
      .slice(0, 5)
      .map((lead) => ({ id: lead.id, name: lead.name }));
  }

  getClientById(clientId: string): ClientRecord | undefined {
    return this.clients.find((client) => client.id === clientId);
  }
}

let repoSingleton: CRMRepo | null = null;

export function getCRMRepo(): CRMRepo {
  if (!repoSingleton) {
    repoSingleton = new CRMRepo();
  }

  return repoSingleton;
}
