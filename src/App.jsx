import { memo, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  DollarSign,
  KanbanSquare,
  LayoutDashboard,
  Loader2,
  MessageSquare,
  Menu,
  LogOut,
  Plus,
  Search,
  SendHorizontal,
  Settings,
  Sparkles,
  UsersRound,
  X,
} from 'lucide-react';
import UnicornScene from 'unicornstudio-react';
import {
  clientProfiles,
  dealsSeed,
  invoicesSeed,
  meetingsSeed,
  paymentsSeed,
  pipelineStages,
  tasksSeed,
} from './data/mockData';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'pipeline', label: 'Pipeline', icon: KanbanSquare },
  { id: 'clients', label: 'Clients', icon: UsersRound },
  { id: 'revenue', label: 'Revenue', icon: DollarSign },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const stageProbabilityMap = {
  'New Lead': 20,
  Qualified: 35,
  Discovery: 50,
  'Proposal Sent': 65,
  Negotiation: 80,
  Won: 100,
  Lost: 0,
};

const userIdFallback = 'krcoffelt@gmail.com';

const demoToday = new Date('2026-02-13T09:00:00');
const AUTH_TOKEN_KEY = 'hometown-crm-auth-token';
const AUTH_USER_ID_KEY = 'hometown-crm-auth-user-id';
const APP_STORAGE_KEYS = {
  deals: 'hometown-crm-deals-v2',
  clients: 'hometown-crm-clients-v2',
  services: 'hometown-crm-services-v3',
  intakeLog: 'hometown-crm-intake-log-v2',
};

const CORE_SERVICE_OPTIONS = [
  { id: 'SRV-001', name: 'Website', category: 'Core', baseRate: 0 },
  { id: 'SRV-002', name: 'Google Business Profile', category: 'Core', baseRate: 0 },
  { id: 'SRV-003', name: 'Domain', category: 'Core', baseRate: 0 },
];

function getStoredAuthToken() {
  if (typeof window === 'undefined') return '';
  return window.sessionStorage.getItem(AUTH_TOKEN_KEY) || '';
}

function getStoredAuthUserId() {
  if (typeof window === 'undefined') return '';
  return window.sessionStorage.getItem(AUTH_USER_ID_KEY) || '';
}

function getInitialAuthState() {
  return Boolean(getStoredAuthToken());
}

function loadStoredArray(key, fallback) {
  if (typeof window === 'undefined') return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return fallback;
    return parsed;
  } catch {
    return fallback;
  }
}

async function parseJsonResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    const fallbackBody = (await response.text()).replace(/\s+/g, ' ').trim();
    const preview = fallbackBody.slice(0, 120);
    const statusLabel = `Request failed (${response.status})`;
    const detail = preview ? `: ${preview}` : '.';
    throw new Error(`${statusLabel} with non-JSON response${detail}`);
  }

  return response.json();
}

async function requestJson(url, init = {}) {
  const response = await fetch(url, init);
  const data = await parseJsonResponse(response);

  if (!response.ok) {
    const message =
      typeof data?.error === 'string' && data.error.trim()
        ? data.error
        : `Request failed (${response.status}).`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return data;
}

function buildId(prefix) {
  const seed = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${seed}`;
}

function getDatePlusDays(daysAhead = 14) {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toISOString().slice(0, 10);
}

function getDefaultServicesFromDeals(sourceDeals) {
  const uniqueServices = [...new Set(sourceDeals.map((deal) => deal.service.trim()))];
  return uniqueServices.map((service, index) => ({
    id: `SRV-${String(index + 1).padStart(3, '0')}`,
    name: service,
    category: index % 2 === 0 ? 'Growth Marketing' : 'Creative',
    baseRate: 2400 + index * 250,
  }));
}

function getInitialLeadForm(services = []) {
  return {
    company: '',
    contact: '',
    service: services[0]?.name ?? '',
    value: '',
    stage: 'New Lead',
    expectedClose: getDatePlusDays(14),
  };
}

function getDefaultLeadEditorState() {
  return {
    id: '',
    company: '',
    contact: '',
    service: '',
    value: '',
    stage: 'New Lead',
    expectedClose: '',
    nextAction: '',
  };
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompactCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function isSameMonth(dateString, compareDate) {
  const date = new Date(dateString);
  return (
    date.getMonth() === compareDate.getMonth() &&
    date.getFullYear() === compareDate.getFullYear()
  );
}

function getInvoiceStatus(invoice) {
  if (invoice.status === 'Paid') return 'Paid';
  if (invoice.status === 'Draft') return 'Draft';

  const dueDate = new Date(invoice.dueDate);
  if (dueDate < demoToday) return 'Overdue';
  return 'Sent';
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(getInitialAuthState);
  const [authToken, setAuthToken] = useState(getStoredAuthToken);
  const [authUserId, setAuthUserId] = useState(getStoredAuthUserId);
  const [authNotice, setAuthNotice] = useState('');
  const [activeView, setActiveView] = useState('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [clients, setClients] = useState(() =>
    loadStoredArray(APP_STORAGE_KEYS.clients, clientProfiles),
  );
  const [deals, setDeals] = useState(() => loadStoredArray(APP_STORAGE_KEYS.deals, dealsSeed));
  const [services, setServices] = useState(() =>
    loadStoredArray(APP_STORAGE_KEYS.services, CORE_SERVICE_OPTIONS),
  );
  const [intakeLog, setIntakeLog] = useState(() =>
    loadStoredArray(APP_STORAGE_KEYS.intakeLog, []),
  );
  const [selectedClientId, setSelectedClientId] = useState('');
  const [quickEntryType, setQuickEntryType] = useState('lead');
  const [leadForm, setLeadForm] = useState(() =>
    getInitialLeadForm(loadStoredArray(APP_STORAGE_KEYS.services, CORE_SERVICE_OPTIONS)),
  );
  const [clientForm, setClientForm] = useState({
    company: '',
    industry: '',
    contactName: '',
    email: '',
    phone: '',
    retainer: '',
  });
  const [serviceForm, setServiceForm] = useState({
    name: '',
    category: 'Growth Marketing',
    baseRate: '',
  });
  const [aiSummary, setAiSummary] = useState('');
  const [aiModel, setAiModel] = useState('gpt-5-nano');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [agentMessages, setAgentMessages] = useState([
    {
      id: 'CHAT-WELCOME',
      role: 'assistant',
      text:
        'CRM Agent is ready. Tell me what changed and I will update leads, clients, and services for you.',
      actions: [],
    },
  ]);
  const [agentInput, setAgentInput] = useState('');
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentError, setAgentError] = useState('');
  const [clientEditor, setClientEditor] = useState({
    id: '',
    company: '',
    industry: '',
    contactName: '',
    email: '',
    phone: '',
    retainer: '',
  });
  const [leadEditorOpen, setLeadEditorOpen] = useState(false);
  const [leadEditorState, setLeadEditorState] = useState(getDefaultLeadEditorState);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(APP_STORAGE_KEYS.clients, JSON.stringify(clients));
  }, [clients]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(APP_STORAGE_KEYS.deals, JSON.stringify(deals));
  }, [deals]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(APP_STORAGE_KEYS.services, JSON.stringify(services));
  }, [services]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(APP_STORAGE_KEYS.intakeLog, JSON.stringify(intakeLog));
  }, [intakeLog]);

  useEffect(() => {
    if (!selectedClientId && clients.length) {
      setSelectedClientId(clients[0].id);
      return;
    }

    if (selectedClientId && !clients.some((client) => client.id === selectedClientId)) {
      setSelectedClientId(clients[0]?.id ?? '');
    }
  }, [clients, selectedClientId]);

  useEffect(() => {
    const coreNames = CORE_SERVICE_OPTIONS.map((service) => service.name);
    if (!leadForm.service || !coreNames.includes(leadForm.service)) {
      setLeadForm((current) => ({ ...current, service: CORE_SERVICE_OPTIONS[0].name }));
    }
  }, [leadForm.service]);

  const filteredDeals = useMemo(() => {
    if (!searchValue.trim()) return deals;

    const query = searchValue.toLowerCase().trim();
    return deals.filter((deal) => {
      return (
        deal.company.toLowerCase().includes(query) ||
        deal.contact.toLowerCase().includes(query) ||
        deal.owner.toLowerCase().includes(query) ||
        deal.service.toLowerCase().includes(query)
      );
    });
  }, [deals, searchValue]);

  const stageData = useMemo(() => {
    return pipelineStages.map((stage) => {
      const stageDeals = deals.filter((deal) => deal.stage === stage);
      const stageValue = stageDeals.reduce((sum, deal) => sum + deal.value, 0);
      return {
        stage,
        count: stageDeals.length,
        value: stageValue,
      };
    });
  }, [deals]);

  const openDeals = useMemo(() => {
    return deals.filter((deal) => deal.stage !== 'Won' && deal.stage !== 'Lost');
  }, [deals]);

  const totalPipelineValue = useMemo(() => {
    return openDeals.reduce((sum, deal) => sum + deal.value, 0);
  }, [openDeals]);

  const weightedForecast = useMemo(() => {
    return openDeals.reduce((sum, deal) => {
      return sum + deal.value * (deal.probability / 100);
    }, 0);
  }, [openDeals]);

  const wonThisMonth = useMemo(() => {
    return deals
      .filter((deal) => deal.stage === 'Won' && isSameMonth(deal.expectedClose, demoToday))
      .reduce((sum, deal) => sum + deal.value, 0);
  }, [deals]);

  const collectedThisMonth = useMemo(() => {
    return paymentsSeed
      .filter((payment) => isSameMonth(payment.paidDate, demoToday))
      .reduce((sum, payment) => sum + payment.amount, 0);
  }, []);

  const overdueInvoiceAmount = useMemo(() => {
    return invoicesSeed.reduce((sum, invoice) => {
      const status = getInvoiceStatus(invoice);
      if (status === 'Overdue') return sum + invoice.amount;
      return sum;
    }, 0);
  }, []);

  const convertedDeals = useMemo(() => {
    return deals.filter((deal) => deal.stage === 'Won' || deal.stage === 'Lost');
  }, [deals]);

  const winRate = useMemo(() => {
    if (!convertedDeals.length) return 0;
    const wins = convertedDeals.filter((deal) => deal.stage === 'Won').length;
    return (wins / convertedDeals.length) * 100;
  }, [convertedDeals]);

  const clientSummaries = useMemo(() => {
    return clients.map((profile) => {
      const clientDeals = deals.filter((deal) => deal.companyId === profile.id);
      const activeDeals = clientDeals.filter(
        (deal) => deal.stage !== 'Won' && deal.stage !== 'Lost',
      );
      const wonDeals = clientDeals.filter((deal) => deal.stage === 'Won');
      const totalValue = clientDeals.reduce((sum, deal) => sum + deal.value, 0);

      let statusLabel = 'Watch';
      let statusClass = 'is-neutral';

      if (activeDeals.some((deal) => deal.stage === 'Negotiation')) {
        statusLabel = 'High Priority';
        statusClass = 'is-dark';
      } else if (wonDeals.length || profile.retainer > 0) {
        statusLabel = 'Active';
        statusClass = 'is-good';
      }

      return {
        ...profile,
        activeDealCount: activeDeals.length,
        totalValue,
        statusLabel,
        statusClass,
      };
    });
  }, [clients, deals]);

  const selectedClient = useMemo(() => {
    if (!clientSummaries.length) return null;
    return (
      clientSummaries.find((client) => client.id === selectedClientId) ??
      clientSummaries[0]
    );
  }, [clientSummaries, selectedClientId]);

  const selectedClientDeals = useMemo(() => {
    if (!selectedClient) return [];
    return deals.filter((deal) => deal.companyId === selectedClient.id);
  }, [deals, selectedClient]);

  const selectedClientTasks = useMemo(() => {
    if (!selectedClient) return [];
    return tasksSeed.filter((task) => task.companyId === selectedClient.id);
  }, [selectedClient]);

  const selectedClientInvoices = useMemo(() => {
    if (!selectedClient) return [];
    return invoicesSeed.filter((invoice) => invoice.companyId === selectedClient.id);
  }, [selectedClient]);

  useEffect(() => {
    if (!selectedClient) return;

    setClientEditor({
      id: selectedClient.id,
      company: selectedClient.company || '',
      industry: selectedClient.industry || '',
      contactName: selectedClient.contactName || '',
      email: selectedClient.email || '',
      phone: selectedClient.phone || '',
      retainer: String(selectedClient.retainer || ''),
    });
  }, [selectedClient]);

  const monthlyRetainerTotal = useMemo(() => {
    return clients.reduce((sum, client) => sum + Number(client.retainer || 0), 0);
  }, [clients]);

  const revenue30d = useMemo(() => {
    const wonDeals = deals.filter((deal) => deal.stage === 'Won');
    const today = new Date(demoToday);
    today.setHours(0, 0, 0, 0);

    return Array.from({ length: 30 }, (_, index) => {
      const dayDate = new Date(today);
      dayDate.setDate(today.getDate() - (29 - index));
      const dayKey = dayDate.toISOString().slice(0, 10);
      const dailyValue = wonDeals
        .filter((deal) => (deal.expectedClose || '').slice(0, 10) === dayKey)
        .reduce((sum, deal) => sum + Number(deal.value || 0), 0);

      return {
        day: index + 1,
        value: dailyValue,
      };
    });
  }, [deals]);

  const nextActions = useMemo(() => {
    return deals
      .filter((deal) => deal.stage !== 'Lost')
      .sort((a, b) => new Date(a.expectedClose) - new Date(b.expectedClose))
      .slice(0, 5);
  }, [deals]);

  const openLeadCount = openDeals.length;
  const activeClientCount = clientSummaries.filter(
    (client) => client.activeDealCount > 0 || Number(client.retainer || 0) > 0,
  ).length;
  const overdueInvoiceCount = invoicesSeed.filter(
    (invoice) => getInvoiceStatus(invoice) === 'Overdue',
  ).length;

  function handleViewChange(nextView) {
    setActiveView(nextView);
    setMobileNavOpen(false);
  }

  function persistAuthSession(token, userId) {
    setAuthToken(token);
    setAuthUserId(userId);
    setIsAuthenticated(true);
    setAuthNotice('');

    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(AUTH_TOKEN_KEY, token);
    window.sessionStorage.setItem(AUTH_USER_ID_KEY, userId);
  }

  function clearAuthSession(notice = '') {
    setIsAuthenticated(false);
    setAuthToken('');
    setAuthUserId('');
    setAuthNotice(notice);
    setMobileNavOpen(false);

    if (typeof window === 'undefined') return;
    window.sessionStorage.removeItem(AUTH_TOKEN_KEY);
    window.sessionStorage.removeItem(AUTH_USER_ID_KEY);
  }

  async function handleLoginAttempt(username, password) {
    const normalizedUsername = username.trim().toLowerCase();

    try {
      const data = await requestJson('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: normalizedUsername,
          password,
        }),
      });

      if (!data?.token || typeof data.token !== 'string') {
        return 'Login succeeded but token was not returned.';
      }

      const userId =
        typeof data.userId === 'string' && data.userId.trim()
          ? data.userId.trim()
          : normalizedUsername;

      persistAuthSession(data.token, userId);
      return '';
    } catch (error) {
      return error instanceof Error ? error.message : 'Unable to sign in right now.';
    }
  }

  function handleLogout() {
    clearAuthSession();
  }

  function getAuthorizedHeaders() {
    if (!authToken) return {};
    return { Authorization: `Bearer ${authToken}` };
  }

  function handleQuickAction(entryType) {
    setActiveView('dashboard');
    if (entryType === 'client') {
      setQuickEntryType('client');
      return;
    }
    setQuickEntryType('lead');
  }

  function addIntakeLog(type, title, detail) {
    const createdAt = new Date();
    setIntakeLog((current) => {
      const next = [
        {
          id: buildId('LOG'),
          type,
          title,
          detail,
          createdAt: createdAt.toLocaleString(),
        },
        ...current,
      ];
      return next.slice(0, 12);
    });
  }

  function handleLeadFormChange(field, value) {
    setLeadForm((current) => ({ ...current, [field]: value }));
  }

  function handleClientFormChange(field, value) {
    setClientForm((current) => ({ ...current, [field]: value }));
  }

  function handleServiceFormChange(field, value) {
    setServiceForm((current) => ({ ...current, [field]: value }));
  }

  function handleLeadCreate(event) {
    event.preventDefault();
    const company = leadForm.company.trim();
    const contact = leadForm.contact.trim();
    const service = leadForm.service.trim();
    const stage = leadForm.stage;
    const expectedClose = leadForm.expectedClose || getDatePlusDays(14);
    const parsedValue = Number(leadForm.value);
    const value = Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 0;

    if (!company || !contact || !service || !value) return;

    const matchingClient = clients.find(
      (client) => client.company.trim().toLowerCase() === company.toLowerCase(),
    );

    let companyId = matchingClient?.id ?? '';

    if (!companyId) {
      const createdClient = {
        id: buildId('CL'),
        company,
        industry: 'Prospect',
        city: 'Unassigned',
        contactName: contact,
        email: '',
        phone: '',
        retainer: 0,
      };

      companyId = createdClient.id;
      setClients((current) => [createdClient, ...current]);
    }

    const createdLead = {
      id: buildId('DL'),
      companyId,
      company,
      contact,
      owner: 'You',
      service,
      value,
      stage,
      probability: stageProbabilityMap[stage] ?? 20,
      expectedClose,
      source: 'Manual Entry',
      lastTouch: new Date().toISOString().slice(0, 10),
      nextAction: 'Follow up in 24 hours',
    };

    setDeals((current) => [createdLead, ...current]);
    addIntakeLog('Lead', `${company} lead added`, `${stage} · ${formatCurrency(value)}`);
    setLeadForm(getInitialLeadForm(CORE_SERVICE_OPTIONS));
  }

  function handleClientCreate(event) {
    event.preventDefault();
    const company = clientForm.company.trim();
    if (!company) return;

    const contactName = clientForm.contactName.trim() || 'Primary Contact';
    const createdClient = {
      id: buildId('CL'),
      company,
      industry: clientForm.industry.trim() || 'General',
      city: 'Local',
      contactName,
      email: clientForm.email.trim(),
      phone: clientForm.phone.trim(),
      retainer: 0,
    };

    setClients((current) => [createdClient, ...current]);
    addIntakeLog(
      'Client',
      `${company} client added`,
      `${contactName} added as primary contact`,
    );
    setClientForm({
      company: '',
      industry: '',
      contactName: '',
      email: '',
      phone: '',
      retainer: '',
    });
  }

  function handleServiceCreate(event) {
    event.preventDefault();
    const name = serviceForm.name.trim();
    if (!name) return;

    const exists = services.some((service) => service.name.toLowerCase() === name.toLowerCase());
    if (exists) return;

    const parsedRate = Number(serviceForm.baseRate);
    const baseRate = Number.isFinite(parsedRate) && parsedRate > 0 ? parsedRate : 0;

    const createdService = {
      id: buildId('SRV'),
      name,
      category: serviceForm.category.trim() || 'Growth Marketing',
      baseRate,
    };

    setServices((current) => [createdService, ...current]);
    addIntakeLog(
      'Service',
      `${name} service added`,
      `${createdService.category} · ${formatCurrency(baseRate)} base`,
    );
    setServiceForm({
      name: '',
      category: 'Growth Marketing',
      baseRate: '',
    });
    setLeadForm((current) => ({ ...current, service: name }));
  }

  function handleClientEditorChange(field, value) {
    setClientEditor((current) => ({ ...current, [field]: value }));
  }

  function handleSaveClientEdits(event) {
    event.preventDefault();
    if (!clientEditor.id) return;

    const retainerValue = Number(clientEditor.retainer);
    setClients((current) =>
      current.map((client) =>
        client.id === clientEditor.id
          ? {
              ...client,
              company: clientEditor.company.trim() || client.company,
              industry: clientEditor.industry.trim() || client.industry,
              contactName: clientEditor.contactName.trim() || client.contactName,
              email: clientEditor.email.trim(),
              phone: clientEditor.phone.trim(),
              retainer:
                Number.isFinite(retainerValue) && retainerValue >= 0
                  ? retainerValue
                  : Number(client.retainer || 0),
            }
          : client,
      ),
    );

    addIntakeLog(
      'Client',
      `Client edited: ${clientEditor.company || 'Client'}`,
      'Updated from manual edit panel',
    );
  }

  function openLeadEditor(deal) {
    if (!deal) return;
    setLeadEditorState({
      id: deal.id,
      company: deal.company || '',
      contact: deal.contact || '',
      service: deal.service || '',
      value: String(deal.value || ''),
      stage: deal.stage || 'New Lead',
      expectedClose: deal.expectedClose || '',
      nextAction: deal.nextAction || '',
    });
    setLeadEditorOpen(true);
  }

  function handleLeadEditorChange(field, value) {
    setLeadEditorState((current) => ({ ...current, [field]: value }));
  }

  function handleSaveLeadEdits(event) {
    event.preventDefault();
    if (!leadEditorState.id) return;

    const valueNumber = Number(leadEditorState.value);
    setDeals((current) =>
      current.map((deal) =>
        deal.id === leadEditorState.id
          ? {
              ...deal,
              company: leadEditorState.company.trim() || deal.company,
              contact: leadEditorState.contact.trim() || deal.contact,
              service: leadEditorState.service.trim() || deal.service,
              value: Number.isFinite(valueNumber) && valueNumber >= 0 ? valueNumber : deal.value,
              stage: leadEditorState.stage || deal.stage,
              expectedClose: leadEditorState.expectedClose || deal.expectedClose,
              nextAction: leadEditorState.nextAction.trim() || deal.nextAction,
              probability:
                stageProbabilityMap[leadEditorState.stage] ?? deal.probability,
            }
          : deal,
      ),
    );

    addIntakeLog(
      'Lead',
      `Lead edited: ${leadEditorState.company || 'Lead'}`,
      `Stage ${leadEditorState.stage || 'Updated'}`,
    );
    setLeadEditorOpen(false);
    setLeadEditorState(getDefaultLeadEditorState());
  }

  function upsertClientFromAgent(agentClient, fallbackName = '') {
    if (!agentClient || typeof agentClient !== 'object') return null;

    const company = (agentClient.name || fallbackName || '').trim();
    if (!company) return null;

    const normalizedCompany = company.toLowerCase();
    const normalizedEmail = typeof agentClient.email === 'string' ? agentClient.email.toLowerCase() : '';

    let resolvedClient = null;
    setClients((current) => {
      const existingIndex = current.findIndex((client) => {
        if (agentClient.id && client.id === agentClient.id) return true;
        const companyMatches = client.company.trim().toLowerCase() === normalizedCompany;
        if (!companyMatches) return false;
        if (!normalizedEmail) return true;
        return (client.email || '').trim().toLowerCase() === normalizedEmail;
      });

      const mappedClient = {
        id:
          agentClient.id ||
          (existingIndex >= 0 ? current[existingIndex].id : buildId('CL')),
        company,
        industry: existingIndex >= 0 ? current[existingIndex].industry : 'Client',
        city: existingIndex >= 0 ? current[existingIndex].city : 'Local',
        contactName: existingIndex >= 0 ? current[existingIndex].contactName : 'Primary Contact',
        email: agentClient.email || (existingIndex >= 0 ? current[existingIndex].email : ''),
        phone: agentClient.phone || (existingIndex >= 0 ? current[existingIndex].phone : ''),
        retainer: existingIndex >= 0 ? current[existingIndex].retainer : 0,
      };

      resolvedClient = mappedClient;

      if (existingIndex >= 0) {
        const next = [...current];
        next[existingIndex] = {
          ...next[existingIndex],
          ...mappedClient,
        };
        return next;
      }

      return [mappedClient, ...current];
    });

    return resolvedClient;
  }

  function applyAgentActions(actions) {
    if (!Array.isArray(actions) || !actions.length) return;

    actions.forEach((action) => {
      if (!action || typeof action !== 'object') return;
      if (action.error) return;

      const toolName = action.tool;
      const result = action.result;

      if (toolName === 'create_client' && result?.client) {
        const mappedClient = upsertClientFromAgent(result.client);
        if (mappedClient) {
          addIntakeLog('Agent', `Client updated: ${mappedClient.company}`, 'Created or reused client');
        }
      }

      if (toolName === 'convert_lead' && result?.client) {
        const mappedClient = upsertClientFromAgent(result.client, result?.lead?.name || '');
        const convertedAtRaw = result?.lead?.converted_at;
        const convertedAt = typeof convertedAtRaw === 'string'
          ? convertedAtRaw.slice(0, 10)
          : new Date().toISOString().slice(0, 10);
        const leadValue = Number(result?.lead?.deal_value || 0);

        if (mappedClient) {
          setDeals((current) => {
            const alreadyExists = current.some(
              (deal) =>
                deal.companyId === mappedClient.id &&
                deal.stage === 'Won' &&
                deal.expectedClose === convertedAt,
            );
            if (alreadyExists) return current;

            return [
              {
                id: buildId('DL'),
                companyId: mappedClient.id,
                company: mappedClient.company,
                contact: mappedClient.contactName,
                owner: 'You',
                service: 'Project Delivery',
                value: leadValue,
                stage: 'Won',
                probability: 100,
                expectedClose: convertedAt,
                source: 'Agent Update',
                lastTouch: convertedAt,
                nextAction: 'Post-project follow-up',
              },
              ...current,
            ];
          });

          addIntakeLog(
            'Agent',
            `Lead converted: ${mappedClient.company}`,
            `Marked won${leadValue ? ` · ${formatCurrency(leadValue)}` : ''}`,
          );
        }
      }

      if (toolName === 'add_service') {
        const servicePayload =
          result?.service && typeof result.service === 'object' ? result.service : result;
        const clientPayload = result?.client && typeof result.client === 'object' ? result.client : null;

        if (clientPayload) {
          upsertClientFromAgent(clientPayload);
        }

        const serviceCode = typeof servicePayload?.service_code === 'string'
          ? servicePayload.service_code.trim()
          : '';
        const unitPrice = Number(servicePayload?.unit_price || 0);
        const qty = Number(servicePayload?.qty || 1);

        if (serviceCode) {
          setServices((current) => {
            const exists = current.some(
              (service) => service.name.trim().toLowerCase() === serviceCode.toLowerCase(),
            );
            if (exists) return current;
            return [
              {
                id: buildId('SRV'),
                name: serviceCode,
                category: 'Agent Added',
                baseRate: unitPrice,
              },
              ...current,
            ];
          });

          const summaryTotal = formatCurrency(qty * unitPrice);
          addIntakeLog('Agent', `Service logged: ${serviceCode}`, `Qty ${qty} · Total ${summaryTotal}`);
        }
      }
    });
  }

  async function handleAgentSubmit(event) {
    event.preventDefault();
    const message = agentInput.trim();
    if (!message || agentLoading) return;

    const userMessage = {
      id: buildId('CHAT'),
      role: 'user',
      text: message,
      actions: [],
    };
    setAgentMessages((current) => [...current, userMessage]);
    setAgentInput('');
    setAgentError('');
    setAgentLoading(true);

    try {
      const data = await requestJson('/api/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthorizedHeaders(),
        },
        body: JSON.stringify({
          message,
          userId: authUserId || userIdFallback,
        }),
      });

      const actions = Array.isArray(data.actions) ? data.actions : [];
      setAgentMessages((current) => [
        ...current,
        {
          id: buildId('CHAT'),
          role: 'assistant',
          text: typeof data.reply === 'string' && data.reply.trim() ? data.reply : 'Done.',
          actions,
        },
      ]);

      applyAgentActions(actions);
    } catch (error) {
      if (error instanceof Error && error.status === 401) {
        clearAuthSession('Session expired. Please sign in again.');
        return;
      }
      const messageText =
        error instanceof Error ? error.message : 'CRM agent request failed.';
      setAgentError(messageText);
      setAgentMessages((current) => [
        ...current,
        {
          id: buildId('CHAT'),
          role: 'assistant',
          text: 'I could not process that update right now.',
          actions: [],
        },
      ]);
    } finally {
      setAgentLoading(false);
    }
  }

  async function handleGenerateAiSnapshot() {
    if (aiLoading) return;

    setAiLoading(true);
    setAiError('');

    try {
      const data = await requestJson('/api/ai/snapshot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthorizedHeaders(),
        },
        body: JSON.stringify({
          metrics: {
            openLeads: openLeadCount,
            activeClients: activeClientCount,
            pipelineValue: formatCurrency(totalPipelineValue),
            weightedForecast: formatCurrency(weightedForecast),
            collectedThisMonth: formatCurrency(collectedThisMonth),
            overdueAmount: formatCurrency(overdueInvoiceAmount),
          },
          topLeads: openDeals.slice(0, 6).map((deal) => ({
            company: deal.company,
            stage: deal.stage,
            value: formatCurrency(deal.value),
            expectedClose: deal.expectedClose,
          })),
          topClients: clientSummaries.slice(0, 6).map((client) => ({
            company: client.company,
            retainer: formatCurrency(Number(client.retainer || 0)),
            activeLeadCount: client.activeDealCount,
          })),
        }),
      });

      setAiSummary(data.text || 'No summary returned.');
      setAiModel(data.model || 'gpt-5-nano');
    } catch (error) {
      if (error instanceof Error && error.status === 401) {
        clearAuthSession('Session expired. Please sign in again.');
        return;
      }
      setAiError(error instanceof Error ? error.message : 'Unable to generate AI snapshot right now.');
    } finally {
      setAiLoading(false);
    }
  }

  function handleDealDragStart(event, dealId) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', dealId);
  }

  function handleDealDrop(event, targetStage) {
    event.preventDefault();
    const dealId = event.dataTransfer.getData('text/plain');
    if (!dealId) return;

    setDeals((currentDeals) => {
      return currentDeals.map((deal) => {
        if (deal.id !== dealId) return deal;
        return {
          ...deal,
          stage: targetStage,
          probability: stageProbabilityMap[targetStage] ?? deal.probability,
        };
      });
    });
  }

  if (!isAuthenticated) {
    return <LoginView onSubmit={handleLoginAttempt} notice={authNotice} />;
  }

  return (
    <div className="app-shell">
      <AnimatedBackground showUnicorn={activeView === 'dashboard'} />

      <Sidebar
        activeView={activeView}
        mobileNavOpen={mobileNavOpen}
        onCloseMobileNav={() => setMobileNavOpen(false)}
        onViewChange={handleViewChange}
      />

      <main className="content-shell">
        <TopBar
          onOpenMobileNav={() => setMobileNavOpen(true)}
          onSearchChange={setSearchValue}
          searchValue={searchValue}
          onQuickAction={handleQuickAction}
          onLogout={handleLogout}
        />

        <AnimatePresence mode="wait">
          <motion.section
            key={activeView}
            className="view-shell"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {activeView === 'dashboard' ? (
              <DashboardView
                deals={deals}
                clients={clientSummaries}
                coreServices={CORE_SERVICE_OPTIONS}
                nextActions={nextActions}
                openLeadCount={openLeadCount}
                activeClientCount={activeClientCount}
                quickEntryType={quickEntryType}
                onQuickEntryTypeChange={setQuickEntryType}
                leadForm={leadForm}
                clientForm={clientForm}
                onLeadFormChange={handleLeadFormChange}
                onClientFormChange={handleClientFormChange}
                onLeadCreate={handleLeadCreate}
                onClientCreate={handleClientCreate}
                agentMessages={agentMessages}
                agentInput={agentInput}
                agentLoading={agentLoading}
                agentError={agentError}
                onAgentInputChange={setAgentInput}
                onAgentSubmit={handleAgentSubmit}
                revenue30d={revenue30d}
                onLeadSelect={openLeadEditor}
              />
            ) : null}

            {activeView === 'pipeline' ? (
              <PipelineView
                deals={filteredDeals}
                stages={pipelineStages}
                onDealDragStart={handleDealDragStart}
                onDealDrop={handleDealDrop}
                onLeadSelect={openLeadEditor}
              />
            ) : null}

            {activeView === 'clients' ? (
              <ClientsView
                clients={clientSummaries}
                selectedClient={selectedClient}
                selectedClientDeals={selectedClientDeals}
                selectedClientTasks={selectedClientTasks}
                selectedClientInvoices={selectedClientInvoices}
                onSelectClient={setSelectedClientId}
                clientEditor={clientEditor}
                onClientEditorChange={handleClientEditorChange}
                onSaveClientEdits={handleSaveClientEdits}
              />
            ) : null}

            {activeView === 'revenue' ? (
              <RevenueView
                invoices={invoicesSeed}
                monthlyRetainerTotal={monthlyRetainerTotal}
                collectedThisMonth={collectedThisMonth}
                weightedForecast={weightedForecast}
                revenue30d={revenue30d}
              />
            ) : null}

            {activeView === 'calendar' ? (
              <CalendarView meetings={meetingsSeed} tasks={tasksSeed} />
            ) : null}

            {activeView === 'settings' ? <SettingsView /> : null}
          </motion.section>
        </AnimatePresence>
      </main>

      <LeadEditModal
        isOpen={leadEditorOpen}
        lead={leadEditorState}
        onChange={handleLeadEditorChange}
        onClose={() => {
          setLeadEditorOpen(false);
          setLeadEditorState(getDefaultLeadEditorState());
        }}
        onSave={handleSaveLeadEdits}
      />
    </div>
  );
}

function LoginView({ onSubmit, notice }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    const result = await onSubmit(username.trim(), password);
    setIsSubmitting(false);
    setErrorMessage(result || '');
  }

  return (
    <div className="auth-shell">
      <div className="auth-scene" aria-hidden="true">
        <div className="auth-scene-fallback" />
        <MemoizedUnicornScene />
        <div className="auth-overlay" />
      </div>

      <motion.section
        className="auth-card"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32 }}
      >
        <div className="auth-brand">
          <div className="brand-badge">HC</div>
          <div>
            <h1>Hometown CRM</h1>
            <p>Marketing Agency Dashboard</p>
          </div>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Username
            <input
              id="auth-username"
              name="username"
              type="email"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              placeholder="Enter your email"
              required
            />
          </label>

          <label>
            Password
            <input
              id="auth-password"
              name="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="Enter your password"
              required
            />
          </label>

          {notice ? <p className="auth-error">{notice}</p> : null}
          {errorMessage ? <p className="auth-error">{errorMessage}</p> : null}

          <button type="submit" className="auth-submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </motion.section>
    </div>
  );
}

const MemoizedUnicornScene = memo(function MemoizedUnicornScene() {
  return (
    <UnicornScene
      projectId="impgffSPUoBe2l8bHxyv"
      sdkUrl="https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v2.0.5/dist/unicornStudio.umd.js"
      width="100%"
      height="100%"
      lazyLoad
      production
    />
  );
});

const AnimatedBackground = memo(function AnimatedBackground({ showUnicorn = false }) {
  return (
    <div className="background-layer" aria-hidden="true">
      {showUnicorn ? (
        <div className="background-unicorn">
          <div className="background-unicorn-fallback" />
          <MemoizedUnicornScene />
        </div>
      ) : null}
      <div className="background-unicorn-overlay" />
      <motion.div
        className="gradient-orb orb-one"
        animate={{ x: [0, 45, -25, 0], y: [0, -30, 25, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="gradient-orb orb-two"
        animate={{ x: [0, -35, 20, 0], y: [0, 40, -20, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
});

function Sidebar({ activeView, onViewChange, mobileNavOpen, onCloseMobileNav }) {
  return (
    <>
      <AnimatePresence>
        {mobileNavOpen ? (
          <motion.button
            className="mobile-nav-backdrop"
            onClick={onCloseMobileNav}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-label="Close navigation"
          />
        ) : null}
      </AnimatePresence>

      <aside className={`sidebar ${mobileNavOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-badge">HC</div>
          <div>
            <p className="brand-title">Hometown CRM</p>
            <p className="brand-subtitle">Agency Command Center</p>
          </div>
          <button className="icon-button mobile-only" onClick={onCloseMobileNav}>
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                className={`sidebar-link ${isActive ? 'active' : ''}`}
                onClick={() => onViewChange(item.id)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <p className="sidebar-footer-title">Focus this week</p>
          <h4>Close 3 proposals</h4>
          <p>Priority accounts: Mosaic, Summit, Northline</p>
        </div>
      </aside>
    </>
  );
}

function TopBar({ onOpenMobileNav, searchValue, onSearchChange, onQuickAction, onLogout }) {
  return (
    <header className="topbar">
      <div className="left-group">
        <button className="icon-button mobile-only" onClick={onOpenMobileNav}>
          <Menu size={18} />
        </button>

        <label className="search-field">
          <Search size={16} />
          <input
            name="global-search"
            type="text"
            placeholder="Search lead, client, owner..."
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>
      </div>

      <div className="topbar-actions">
        <button className="action-button secondary" onClick={() => onQuickAction('lead')}>
          <Plus size={16} />
          <span>New Lead</span>
        </button>
        <button className="action-button secondary" onClick={() => onQuickAction('client')}>
          <Plus size={16} />
          <span>New Client</span>
        </button>
        <button className="icon-button">
          <Bell size={17} />
        </button>
        <button className="action-button secondary" onClick={onLogout}>
          <LogOut size={15} />
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
}

function GlassCard({ className = '', children, delay = 0 }) {
  return (
    <motion.article
      className={`glass-card ${className}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay }}
    >
      {children}
    </motion.article>
  );
}

function DashboardView({
  deals,
  clients,
  coreServices,
  nextActions,
  openLeadCount,
  activeClientCount,
  quickEntryType,
  onQuickEntryTypeChange,
  leadForm,
  clientForm,
  onLeadFormChange,
  onClientFormChange,
  onLeadCreate,
  onClientCreate,
  agentMessages,
  agentInput,
  agentLoading,
  agentError,
  onAgentInputChange,
  onAgentSubmit,
  revenue30d,
  onLeadSelect,
}) {
  const openLeads = deals.filter((deal) => deal.stage !== 'Won' && deal.stage !== 'Lost');
  const wonDeals = deals.filter((deal) => deal.stage === 'Won');
  const openLeadValue = openLeads.reduce((sum, deal) => sum + Number(deal.value || 0), 0);
  const revenue30Total = revenue30d.reduce((sum, point) => sum + Number(point.value || 0), 0);
  const quickMode = quickEntryType === 'client' ? 'client' : 'lead';

  const serviceBreakdown = coreServices.map((service) => {
    const serviceDeals = deals.filter((deal) =>
      (deal.service || '').toLowerCase().includes(service.name.toLowerCase()),
    );
    const completedCount = serviceDeals.filter((deal) => deal.stage === 'Won').length;
    const totalValue = serviceDeals.reduce((sum, deal) => sum + Number(deal.value || 0), 0);

    return {
      name: service.name,
      totalCount: serviceDeals.length,
      completedCount,
      totalValue,
    };
  });

  const serviceMaxValue = Math.max(...serviceBreakdown.map((item) => item.totalValue), 1);

  const leadQueue = [...openLeads]
    .sort((a, b) => new Date(a.expectedClose) - new Date(b.expectedClose))
    .slice(0, 10);

  const clientRankings = [...clients]
    .sort((a, b) => b.activeDealCount - a.activeDealCount || b.totalValue - a.totalValue)
    .slice(0, 8);

  const actionPreview = nextActions.slice(0, 5);

  return (
    <div className="dashboard-focus classic-dashboard">
      <div className="view-header classic-header">
        <div>
          <h1>Dashboard</h1>
          <p>Lead + client command center for Websites, Google Business Profiles, and Domains.</p>
        </div>
        <div className="classic-profile-chip">
          <div className="profile-avatar">KC</div>
          <div>
            <strong>Kyle Coffelt</strong>
            <span>Owner</span>
          </div>
        </div>
      </div>

      <section className="classic-dashboard-grid">
        <div className="classic-main-column">
          <GlassCard className="panel classic-metric-strip">
            <div className="classic-metric-chip">
              <p>Open Leads</p>
              <h3>{openLeadCount}</h3>
            </div>
            <div className="classic-metric-chip">
              <p>Active Clients</p>
              <h3>{activeClientCount}</h3>
            </div>
            <div className="classic-metric-chip">
              <p>Completed</p>
              <h3>{wonDeals.length}</h3>
            </div>
            <div className="classic-metric-chip">
              <p>Revenue 30d</p>
              <h3>{formatCurrency(revenue30Total)}</h3>
            </div>
          </GlassCard>

          <GlassCard className="panel classic-revenue-panel">
            <div className="panel-head">
              <h3>Revenue (Last 30 Days)</h3>
              <span>{formatCurrency(openLeadValue)} open value</span>
            </div>
            <div className="classic-revenue-inner">
              <div className="classic-chart-wrap">
                <RevenueLineChart points={revenue30d} />
              </div>
              <div className="classic-service-stack">
                {serviceBreakdown.map((item) => (
                  <div key={item.name} className="classic-service-row">
                    <div>
                      <h4>{item.name}</h4>
                      <p>
                        {item.totalCount} projects · {item.completedCount} completed
                      </p>
                    </div>
                    <strong>{formatCurrency(item.totalValue)}</strong>
                    <div className="classic-service-track">
                      <span style={{ width: `${Math.max((item.totalValue / serviceMaxValue) * 100, 8)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>

          <GlassCard className="panel classic-leads-panel">
            <div className="panel-head">
              <h3>Lead Queue</h3>
              <span>Click a row to edit details</span>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Service</th>
                    <th>Stage</th>
                    <th>Close</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {leadQueue.map((deal) => (
                    <tr key={deal.id} className="clickable-row" onClick={() => onLeadSelect(deal)}>
                      <td>{deal.company}</td>
                      <td>{deal.service}</td>
                      <td>
                        <span className="status-pill is-neutral">{deal.stage}</span>
                      </td>
                      <td>{deal.expectedClose}</td>
                      <td>{formatCurrency(deal.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>

        <div className="classic-side-column">
          <GlassCard className="panel upcoming-dark-card">
            <div className="panel-head">
              <h3>Upcoming Work</h3>
              <span>Priority actions</span>
            </div>
            <div className="upcoming-list">
              {actionPreview.map((deal) => (
                <div key={deal.id} className="upcoming-row">
                  <h4>{deal.company}</h4>
                  <p>{deal.nextAction}</p>
                  <small>
                    {deal.expectedClose} · {formatCurrency(deal.value)}
                  </small>
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="panel classic-quick-panel">
            <div className="panel-head">
              <h3>Quick Add</h3>
              <span>Lead or client</span>
            </div>

            <div className="capture-tabs two-tabs">
              <button
                type="button"
                className={quickMode === 'lead' ? 'active' : ''}
                onClick={() => onQuickEntryTypeChange('lead')}
              >
                Lead
              </button>
              <button
                type="button"
                className={quickMode === 'client' ? 'active' : ''}
                onClick={() => onQuickEntryTypeChange('client')}
              >
                Client
              </button>
            </div>

            {quickMode === 'lead' ? (
              <form className="capture-form" onSubmit={onLeadCreate}>
                <div className="capture-grid one">
                  <label>
                    Company
                    <input
                      name="lead-company"
                      type="text"
                      value={leadForm.company}
                      onChange={(event) => onLeadFormChange('company', event.target.value)}
                      placeholder="Client company"
                      required
                    />
                  </label>
                  <label>
                    Contact
                    <input
                      name="lead-contact"
                      type="text"
                      value={leadForm.contact}
                      onChange={(event) => onLeadFormChange('contact', event.target.value)}
                      placeholder="Primary contact"
                      required
                    />
                  </label>
                  <label>
                    Service
                    <select
                      name="lead-service"
                      value={leadForm.service}
                      onChange={(event) => onLeadFormChange('service', event.target.value)}
                    >
                      {coreServices.map((service) => (
                        <option key={service.id} value={service.name}>
                          {service.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Value
                    <input
                      name="lead-value"
                      type="number"
                      min="0"
                      value={leadForm.value}
                      onChange={(event) => onLeadFormChange('value', event.target.value)}
                      placeholder="900"
                      required
                    />
                  </label>
                  <label>
                    Stage
                    <select
                      name="lead-stage"
                      value={leadForm.stage}
                      onChange={(event) => onLeadFormChange('stage', event.target.value)}
                    >
                      {pipelineStages
                        .filter((stage) => stage !== 'Won' && stage !== 'Lost')
                        .map((stage) => (
                          <option key={stage} value={stage}>
                            {stage}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Expected Close
                    <input
                      name="lead-expected-close"
                      type="date"
                      value={leadForm.expectedClose}
                      onChange={(event) => onLeadFormChange('expectedClose', event.target.value)}
                      required
                    />
                  </label>
                </div>
                <div className="capture-footer">
                  <button type="submit" className="capture-submit">
                    Add Lead
                  </button>
                </div>
              </form>
            ) : (
              <form className="capture-form" onSubmit={onClientCreate}>
                <div className="capture-grid one">
                  <label>
                    Company
                    <input
                      name="client-company"
                      type="text"
                      value={clientForm.company}
                      onChange={(event) => onClientFormChange('company', event.target.value)}
                      placeholder="Client company"
                      required
                    />
                  </label>
                  <label>
                    Contact
                    <input
                      name="client-contact-name"
                      type="text"
                      value={clientForm.contactName}
                      onChange={(event) => onClientFormChange('contactName', event.target.value)}
                      placeholder="Primary contact"
                    />
                  </label>
                  <label>
                    Email
                    <input
                      name="client-email"
                      type="email"
                      value={clientForm.email}
                      onChange={(event) => onClientFormChange('email', event.target.value)}
                      placeholder="client@company.com"
                    />
                  </label>
                  <label>
                    Phone
                    <input
                      name="client-phone"
                      type="text"
                      value={clientForm.phone}
                      onChange={(event) => onClientFormChange('phone', event.target.value)}
                      placeholder="(000) 000-0000"
                    />
                  </label>
                </div>
                <div className="capture-footer">
                  <button type="submit" className="capture-submit">
                    Add Client
                  </button>
                </div>
              </form>
            )}
          </GlassCard>

          <GlassCard className="panel classic-clients-panel">
            <div className="panel-head">
              <h3>Clients</h3>
              <span>{clientRankings.length} visible</span>
            </div>
            <div className="client-priority-list tight">
              {clientRankings.map((client) => (
                <div key={client.id} className="client-priority-row">
                  <div>
                    <h4>{client.company}</h4>
                    <p>{client.activeDealCount} active leads</p>
                  </div>
                  <div className="client-priority-meta">
                    <strong>{formatCurrency(client.totalValue)}</strong>
                    <span>{client.contactName || 'Contact not set'}</span>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </section>

      <AgentChatDock
        agentMessages={agentMessages}
        agentInput={agentInput}
        agentLoading={agentLoading}
        agentError={agentError}
        onAgentInputChange={onAgentInputChange}
        onAgentSubmit={onAgentSubmit}
      />
    </div>
  );
}
function AgentChatDock({
  agentMessages,
  agentInput,
  agentLoading,
  agentError,
  onAgentInputChange,
  onAgentSubmit,
}) {
  const [isOpen, setIsOpen] = useState(true);
  const visibleMessages = agentMessages.slice(-8);

  return (
    <aside className={`agent-chat-dock ${isOpen ? 'open' : 'closed'}`}>
      <button type="button" className="agent-chat-toggle" onClick={() => setIsOpen((current) => !current)}>
        <MessageSquare size={15} />
        <span>{isOpen ? 'Hide Chat' : 'Open Chat'}</span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen ? (
          <motion.div
            className="agent-chat-card"
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            <div className="panel-head">
              <h3>CRM Agent Chat</h3>
              <span>{agentLoading ? 'Working...' : 'Live'}</span>
            </div>

            <div className="agent-chat-log dock-log">
              {visibleMessages.map((message) => (
                <div
                  key={message.id}
                  className={`chat-bubble ${message.role === 'user' ? 'user' : 'assistant'}`}
                >
                  <p>{message.text}</p>
                  {Array.isArray(message.actions) && message.actions.length ? (
                    <div className="chat-action-list">
                      {message.actions.map((action, index) => (
                        <span key={`${message.id}-${action.tool}-${index}`} className="status-pill is-dark">
                          {action.tool}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            {agentError ? <p className="ai-error">{agentError}</p> : null}

            <form className="agent-chat-form" onSubmit={onAgentSubmit}>
              <label className="search-field chat-input-shell">
                <MessageSquare size={16} />
                <input
                  name="agent-chat-message"
                  type="text"
                  value={agentInput}
                  onChange={(event) => onAgentInputChange(event.target.value)}
                  placeholder="Example: move Northline Dental to Won and add website delivery service"
                />
              </label>
              <button type="submit" className="capture-submit ai-snapshot-btn" disabled={agentLoading}>
                {agentLoading ? (
                  <>
                    <Loader2 size={14} className="spin-icon" />
                    Sending
                  </>
                ) : (
                  <>
                    <SendHorizontal size={14} />
                    Send
                  </>
                )}
              </button>
            </form>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </aside>
  );
}
function PipelineView({ deals, stages, onDealDragStart, onDealDrop, onLeadSelect }) {
  const [hoveredStage, setHoveredStage] = useState('');

  return (
    <div className="pipeline-view">
      <div className="view-header">
        <h1>Pipeline Board</h1>
        <p>Drag deals between stages to update probability and keep forecast current.</p>
      </div>

      <section className="pipeline-lanes">
        {stages.map((stage) => {
          const stageDeals = deals.filter((deal) => deal.stage === stage);
          const stageValue = stageDeals.reduce((sum, deal) => sum + deal.value, 0);

          return (
            <motion.div
              key={stage}
              className={`pipeline-lane ${hoveredStage === stage ? 'is-hovered' : ''}`}
              onDragOver={(event) => {
                event.preventDefault();
                setHoveredStage(stage);
              }}
              onDragLeave={() => setHoveredStage('')}
              onDrop={(event) => {
                onDealDrop(event, stage);
                setHoveredStage('');
              }}
              layout
            >
              <header className="lane-header">
                <h3>{stage}</h3>
                <span>{stageDeals.length}</span>
              </header>
              <p className="lane-value">{formatCompactCurrency(stageValue)}</p>

              <div className="lane-cards">
                {stageDeals.length ? (
                  stageDeals.map((deal) => (
                    <motion.article
                      key={deal.id}
                      className="deal-card"
                      draggable
                      whileHover={{ y: -3 }}
                      onDragStart={(event) => onDealDragStart(event, deal.id)}
                      onClick={() => onLeadSelect(deal)}
                    >
                      <div className="deal-head">
                        <h4>{deal.company}</h4>
                        <span className="probability-chip">{deal.probability}%</span>
                      </div>
                      <p className="deal-service">{deal.service}</p>
                      <div className="deal-meta">
                        <span>{deal.owner}</span>
                        <strong>{formatCurrency(deal.value)}</strong>
                      </div>
                      <div className="deal-meta secondary">
                        <span>{deal.contact}</span>
                        <small>Close: {deal.expectedClose}</small>
                      </div>
                    </motion.article>
                  ))
                ) : (
                  <p className="lane-empty">Drop deals here</p>
                )}
              </div>
            </motion.div>
          );
        })}
      </section>
    </div>
  );
}

function ClientsView({
  clients,
  selectedClient,
  selectedClientDeals,
  selectedClientTasks,
  selectedClientInvoices,
  onSelectClient,
  clientEditor,
  onClientEditorChange,
  onSaveClientEdits,
}) {
  if (!selectedClient) return null;

  return (
    <div className="clients-view">
      <div className="view-header">
        <h1>Client Workspace</h1>
        <p>Track account health, upcoming deliverables, and revenue status by client.</p>
      </div>

      <section className="clients-layout">
        <GlassCard className="client-list-panel">
          <div className="panel-head">
            <h3>Accounts</h3>
            <span>{clients.length} clients</span>
          </div>
          <div className="client-list">
            {clients.map((client) => (
              <button
                key={client.id}
                className={`client-list-item ${client.id === selectedClient.id ? 'active' : ''}`}
                onClick={() => onSelectClient(client.id)}
              >
                <div>
                  <h4>{client.company}</h4>
                  <p>{client.industry}</p>
                </div>
                <div className="client-list-meta">
                  <strong>{formatCompactCurrency(client.totalValue)}</strong>
                  <span className={`status-pill ${client.statusClass}`}>{client.statusLabel}</span>
                </div>
              </button>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="client-detail-panel">
          <div className="client-hero">
            <div>
              <h2>{selectedClient.company}</h2>
              <p>
                {selectedClient.industry} · {selectedClient.city}
              </p>
            </div>
            <span className={`status-pill ${selectedClient.statusClass}`}>
              {selectedClient.statusLabel}
            </span>
          </div>

          <form className="client-edit-form" onSubmit={onSaveClientEdits}>
            <div className="capture-grid two">
              <label>
                Company
                <input
                  name="client-editor-company"
                  type="text"
                  value={clientEditor.company}
                  onChange={(event) => onClientEditorChange('company', event.target.value)}
                />
              </label>
              <label>
                Industry
                <input
                  name="client-editor-industry"
                  type="text"
                  value={clientEditor.industry}
                  onChange={(event) => onClientEditorChange('industry', event.target.value)}
                />
              </label>
              <label>
                Contact
                <input
                  name="client-editor-contact"
                  type="text"
                  value={clientEditor.contactName}
                  onChange={(event) => onClientEditorChange('contactName', event.target.value)}
                />
              </label>
              <label>
                Email
                <input
                  name="client-editor-email"
                  type="email"
                  value={clientEditor.email}
                  onChange={(event) => onClientEditorChange('email', event.target.value)}
                />
              </label>
              <label>
                Phone
                <input
                  name="client-editor-phone"
                  type="text"
                  value={clientEditor.phone}
                  onChange={(event) => onClientEditorChange('phone', event.target.value)}
                />
              </label>
              <label>
                Monthly Retainer
                <input
                  name="client-editor-retainer"
                  type="number"
                  min="0"
                  value={clientEditor.retainer}
                  onChange={(event) => onClientEditorChange('retainer', event.target.value)}
                />
              </label>
            </div>
            <div className="capture-footer">
              <p>Client details are editable here and update immediately.</p>
              <button type="submit" className="capture-submit">
                Save Client
              </button>
            </div>
          </form>

          <div className="client-detail-grid">
            <section>
              <h4>Deals</h4>
              {selectedClientDeals.map((deal) => (
                <div key={deal.id} className="detail-row">
                  <div>
                    <h5>{deal.service}</h5>
                    <p>{deal.stage}</p>
                  </div>
                  <strong>{formatCurrency(deal.value)}</strong>
                </div>
              ))}
            </section>

            <section>
              <h4>Tasks</h4>
              {selectedClientTasks.map((task) => (
                <div key={task.id} className="detail-row">
                  <div>
                    <h5>{task.title}</h5>
                    <p>
                      Due {task.dueDate} · {task.priority}
                    </p>
                  </div>
                  <span className="status-pill is-neutral">{task.status}</span>
                </div>
              ))}
            </section>

            <section>
              <h4>Invoices</h4>
              {selectedClientInvoices.map((invoice) => (
                <div key={invoice.id} className="detail-row">
                  <div>
                    <h5>{invoice.id}</h5>
                    <p>Due {invoice.dueDate}</p>
                  </div>
                  <div className="invoice-inline-meta">
                    <strong>{formatCurrency(invoice.amount)}</strong>
                    <span className={`status-pill ${statusClassForInvoice(getInvoiceStatus(invoice))}`}>
                      {getInvoiceStatus(invoice)}
                    </span>
                  </div>
                </div>
              ))}
            </section>
          </div>
        </GlassCard>
      </section>
    </div>
  );
}

function RevenueView({
  invoices,
  monthlyRetainerTotal,
  collectedThisMonth,
  weightedForecast,
  revenue30d,
}) {
  const overdueTotal = invoices
    .filter((invoice) => getInvoiceStatus(invoice) === 'Overdue')
    .reduce((sum, invoice) => sum + invoice.amount, 0);

  return (
    <div className="revenue-view">
      <div className="view-header">
        <h1>Revenue & Billing</h1>
        <p>Forecast future cash-in and monitor invoice collection health.</p>
      </div>

      <section className="metric-grid">
        <GlassCard className="metric-card">
          <p className="metric-label">Monthly Retainers</p>
          <h2>{formatCurrency(monthlyRetainerTotal)}</h2>
          <p className="metric-delta up">
            <ArrowUpRight size={15} />
            Stable recurring base
          </p>
        </GlassCard>

        <GlassCard className="metric-card">
          <p className="metric-label">Collected This Month</p>
          <h2>{formatCurrency(collectedThisMonth)}</h2>
          <p className="metric-delta up">
            <ArrowUpRight size={15} />
            +9.2% vs last month
          </p>
        </GlassCard>

        <GlassCard className="metric-card">
          <p className="metric-label">Pipeline Forecast</p>
          <h2>{formatCurrency(weightedForecast)}</h2>
          <p className="metric-delta up">
            <ArrowUpRight size={15} />
            Based on current stage probability
          </p>
        </GlassCard>

        <GlassCard className="metric-card">
          <p className="metric-label">Overdue Invoices</p>
          <h2>{formatCurrency(overdueTotal)}</h2>
          <p className="metric-delta down">
            <ArrowDownRight size={15} />
            Follow-up required
          </p>
        </GlassCard>
      </section>

      <section className="revenue-layout">
        <GlassCard className="revenue-chart-panel">
          <div className="panel-head">
            <h3>Revenue Over Last 30 Days</h3>
            <span>Line chart</span>
          </div>
          <RevenueLineChart points={revenue30d} />
          <div className="chart-legend">
            <span>
              <i className="legend-color collected" /> Revenue
            </span>
          </div>
        </GlassCard>

        <GlassCard className="invoice-table-panel">
          <div className="panel-head">
            <h3>Invoice Tracker</h3>
            <span>{invoices.length} invoices</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Client</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => {
                  const status = getInvoiceStatus(invoice);
                  return (
                    <tr key={invoice.id}>
                      <td>{invoice.id}</td>
                      <td>{invoice.company}</td>
                      <td>{invoice.dueDate}</td>
                      <td>
                        <span className={`status-pill ${statusClassForInvoice(status)}`}>{status}</span>
                      </td>
                      <td>{formatCurrency(invoice.amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </section>
    </div>
  );
}

function CalendarView({ meetings, tasks }) {
  return (
    <div className="calendar-view">
      <div className="view-header">
        <h1>Calendar & Priorities</h1>
        <p>Stay ahead on follow-ups, meetings, and this week’s deliverables.</p>
      </div>

      <section className="calendar-layout">
        <GlassCard>
          <div className="panel-head">
            <h3>Upcoming Meetings</h3>
            <span>Next 7 days</span>
          </div>
          <div className="meeting-list">
            {meetings.map((meeting) => (
              <div key={meeting.id} className="meeting-row">
                <div>
                  <h4>{meeting.title}</h4>
                  <p>{meeting.company}</p>
                </div>
                <div className="meeting-meta">
                  <span>{meeting.time}</span>
                  <small>{meeting.owner}</small>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard>
          <div className="panel-head">
            <h3>Task Queue</h3>
            <span>Open work</span>
          </div>
          <div className="task-list">
            {tasks.map((task) => (
              <div key={task.id} className="detail-row">
                <div>
                  <h5>{task.title}</h5>
                  <p>
                    Due {task.dueDate} · {task.priority}
                  </p>
                </div>
                <span className="status-pill is-neutral">{task.status}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      </section>
    </div>
  );
}

function SettingsView() {
  return (
    <div className="settings-view">
      <div className="view-header">
        <h1>Workspace Settings</h1>
        <p>Control notifications, workflow defaults, and team visibility.</p>
      </div>

      <section className="settings-layout">
        <GlassCard>
          <div className="panel-head">
            <h3>Notifications</h3>
            <span>Alert preferences</span>
          </div>
          <div className="setting-list">
            <label className="setting-row">
              <span>Deal moved to Negotiation or Won</span>
              <input type="checkbox" name="notify-deal-stage" defaultChecked />
            </label>
            <label className="setting-row">
              <span>Invoice due in 3 days</span>
              <input type="checkbox" name="notify-invoice-due" defaultChecked />
            </label>
            <label className="setting-row">
              <span>Daily activity digest email</span>
              <input type="checkbox" name="notify-daily-digest" />
            </label>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="panel-head">
            <h3>Pipeline Defaults</h3>
            <span>Scoring and ownership</span>
          </div>
          <div className="setting-list">
            <label className="setting-row">
              <span>Auto-assign inbound form leads to Kyle</span>
              <input type="checkbox" name="pipeline-auto-assign" defaultChecked />
            </label>
            <label className="setting-row">
              <span>Create task when proposal is sent</span>
              <input type="checkbox" name="pipeline-task-on-proposal" defaultChecked />
            </label>
            <label className="setting-row">
              <span>Require loss reason before stage = Lost</span>
              <input type="checkbox" name="pipeline-require-loss-reason" />
            </label>
          </div>
        </GlassCard>
      </section>
    </div>
  );
}

function RevenueLineChart({ points }) {
  const safePoints = Array.isArray(points) ? points : [];
  const width = 760;
  const height = 220;
  const padding = 22;

  const minValue = safePoints.length
    ? Math.min(...safePoints.map((point) => point.value))
    : 0;
  const maxValue = safePoints.length
    ? Math.max(...safePoints.map((point) => point.value))
    : 1;
  const range = Math.max(maxValue - minValue, 1);

  const coordinates = safePoints.map((point, index) => {
    const x =
      padding +
      (index / Math.max(safePoints.length - 1, 1)) * (width - padding * 2);
    const y =
      height -
      padding -
      ((point.value - minValue) / range) * (height - padding * 2);
    return { ...point, x, y };
  });

  const path = coordinates
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  const latest = coordinates[coordinates.length - 1];

  return (
    <div className="line-chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} className="line-chart-svg" role="img" aria-label="Revenue line chart">
        <defs>
          <linearGradient id="line-fill-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255, 252, 242, 0.28)" />
            <stop offset="100%" stopColor="rgba(255, 252, 242, 0)" />
          </linearGradient>
        </defs>
        <path d={`M ${padding} ${height - padding} L ${width - padding} ${height - padding}`} className="line-grid" />
        {path ? <path d={path} className="line-path" /> : null}
        {path ? (
          <path
            d={`${path} L ${latest?.x ?? width - padding} ${height - padding} L ${padding} ${height - padding} Z`}
            className="line-area"
          />
        ) : null}
        {latest ? <circle cx={latest.x} cy={latest.y} r="4" className="line-dot" /> : null}
      </svg>
      <div className="line-chart-meta">
        <span>Day 1</span>
        <strong>{latest ? `Day ${latest.day} · ${formatCurrency(latest.value)}` : 'No data'}</strong>
      </div>
    </div>
  );
}

function LeadEditModal({ isOpen, lead, onChange, onClose, onSave }) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <motion.div
        className="lead-edit-modal"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className="modal-header">
          <h3>Edit Lead</h3>
          <button className="icon-button" onClick={onClose} aria-label="Close lead editor">
            <X size={16} />
          </button>
        </div>

        <form className="capture-form" onSubmit={onSave}>
          <div className="capture-grid two">
            <label>
              Company
              <input
                name="lead-editor-company"
                type="text"
                value={lead.company}
                onChange={(event) => onChange('company', event.target.value)}
                required
              />
            </label>
            <label>
              Contact
              <input
                name="lead-editor-contact"
                type="text"
                value={lead.contact}
                onChange={(event) => onChange('contact', event.target.value)}
                required
              />
            </label>
            <label>
              Service
              <input
                name="lead-editor-service"
                type="text"
                value={lead.service}
                onChange={(event) => onChange('service', event.target.value)}
                required
              />
            </label>
            <label>
              Value
              <input
                name="lead-editor-value"
                type="number"
                min="0"
                value={lead.value}
                onChange={(event) => onChange('value', event.target.value)}
                required
              />
            </label>
            <label>
              Stage
              <select
                name="lead-editor-stage"
                value={lead.stage}
                onChange={(event) => onChange('stage', event.target.value)}
              >
                {pipelineStages.map((stage) => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Expected Close
              <input
                name="lead-editor-expected-close"
                type="date"
                value={lead.expectedClose}
                onChange={(event) => onChange('expectedClose', event.target.value)}
                required
              />
            </label>
          </div>
          <label>
            Next Action
            <input
              name="lead-editor-next-action"
              type="text"
              value={lead.nextAction}
              onChange={(event) => onChange('nextAction', event.target.value)}
            />
          </label>

          <div className="capture-footer">
            <p>Tip: You can also drag stage cards in Pipeline view.</p>
            <div className="modal-actions">
              <button type="button" className="action-button secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="capture-submit">
                Save Lead
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function statusClassForInvoice(status) {
  if (status === 'Paid') return 'is-good';
  if (status === 'Overdue') return 'is-hot';
  if (status === 'Draft') return 'is-neutral';
  return 'is-neutral';
}

export default App;
