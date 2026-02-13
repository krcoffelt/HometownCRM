import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  DollarSign,
  KanbanSquare,
  LayoutDashboard,
  Mail,
  MapPin,
  Menu,
  Plus,
  Search,
  Settings,
  UsersRound,
  X,
} from 'lucide-react';
import {
  activitiesSeed,
  clientProfiles,
  dealsSeed,
  invoicesSeed,
  meetingsSeed,
  monthlyRevenueSeed,
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

const demoToday = new Date('2026-02-13T09:00:00');

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
  const [activeView, setActiveView] = useState('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [deals, setDeals] = useState(dealsSeed);
  const [selectedClientId, setSelectedClientId] = useState(clientProfiles[0]?.id ?? '');

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
    return clientProfiles.map((profile) => {
      const clientDeals = deals.filter((deal) => deal.companyId === profile.id);
      const activeDeals = clientDeals.filter(
        (deal) => deal.stage !== 'Won' && deal.stage !== 'Lost',
      );
      const wonDeals = clientDeals.filter((deal) => deal.stage === 'Won');
      const totalValue = clientDeals.reduce((sum, deal) => sum + deal.value, 0);

      let statusLabel = 'Nurturing';
      let statusClass = 'is-neutral';

      if (activeDeals.some((deal) => deal.stage === 'Negotiation' || deal.stage === 'Proposal Sent')) {
        statusLabel = 'Hot';
        statusClass = 'is-hot';
      } else if (wonDeals.length) {
        statusLabel = 'Active Client';
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
  }, [deals]);

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

  const monthlyRetainerTotal = useMemo(() => {
    return clientProfiles.reduce((sum, client) => sum + client.retainer, 0);
  }, []);

  const nextActions = useMemo(() => {
    return deals
      .filter((deal) => deal.stage !== 'Lost')
      .sort((a, b) => new Date(a.expectedClose) - new Date(b.expectedClose))
      .slice(0, 5);
  }, [deals]);

  function handleViewChange(nextView) {
    setActiveView(nextView);
    setMobileNavOpen(false);
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

  const metricCards = [
    {
      label: 'Open Pipeline',
      value: formatCurrency(totalPipelineValue),
      deltaText: '+8.4%',
      trend: 'up',
    },
    {
      label: 'Weighted Forecast',
      value: formatCurrency(weightedForecast),
      deltaText: '+5.1%',
      trend: 'up',
    },
    {
      label: 'Won This Month',
      value: formatCurrency(wonThisMonth),
      deltaText: `${winRate.toFixed(1)}% win rate`,
      trend: 'up',
    },
    {
      label: 'Collected This Month',
      value: formatCurrency(collectedThisMonth),
      deltaText: `${formatCurrency(overdueInvoiceAmount)} overdue`,
      trend: 'down',
    },
  ];

  return (
    <div className="app-shell">
      <AnimatedBackground />

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
                metricCards={metricCards}
                stageData={stageData}
                deals={deals}
                meetings={meetingsSeed}
                activities={activitiesSeed}
                nextActions={nextActions}
              />
            ) : null}

            {activeView === 'pipeline' ? (
              <PipelineView
                deals={filteredDeals}
                stages={pipelineStages}
                onDealDragStart={handleDealDragStart}
                onDealDrop={handleDealDrop}
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
              />
            ) : null}

            {activeView === 'revenue' ? (
              <RevenueView
                monthlyRevenue={monthlyRevenueSeed}
                invoices={invoicesSeed}
                monthlyRetainerTotal={monthlyRetainerTotal}
                collectedThisMonth={collectedThisMonth}
                weightedForecast={weightedForecast}
              />
            ) : null}

            {activeView === 'calendar' ? (
              <CalendarView meetings={meetingsSeed} tasks={tasksSeed} />
            ) : null}

            {activeView === 'settings' ? <SettingsView /> : null}
          </motion.section>
        </AnimatePresence>
      </main>
    </div>
  );
}

function AnimatedBackground() {
  return (
    <div className="background-layer" aria-hidden="true">
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
}

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

function TopBar({ onOpenMobileNav, searchValue, onSearchChange }) {
  return (
    <header className="topbar">
      <div className="left-group">
        <button className="icon-button mobile-only" onClick={onOpenMobileNav}>
          <Menu size={18} />
        </button>

        <label className="search-field">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search lead, client, owner..."
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>
      </div>

      <div className="topbar-actions">
        <button className="action-button secondary">
          <Plus size={16} />
          <span>New Lead</span>
        </button>
        <button className="action-button primary">
          <Plus size={16} />
          <span>New Invoice</span>
        </button>
        <button className="icon-button">
          <Bell size={17} />
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

function DashboardView({ metricCards, stageData, deals, meetings, activities, nextActions }) {
  const highestStageValue = Math.max(...stageData.map((stage) => stage.value), 1);
  const topDeals = [...deals]
    .filter((deal) => deal.stage !== 'Lost')
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  return (
    <div className="dashboard-view">
      <div className="view-header">
        <h1>Agency Pipeline Dashboard</h1>
        <p>Track lead progress, expected revenue, and next client actions in one workspace.</p>
      </div>

      <section className="metric-grid">
        {metricCards.map((metric, index) => (
          <GlassCard key={metric.label} className="metric-card" delay={index * 0.05}>
            <p className="metric-label">{metric.label}</p>
            <h2>{metric.value}</h2>
            <p className={`metric-delta ${metric.trend}`}>
              {metric.trend === 'up' ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
              {metric.deltaText}
            </p>
          </GlassCard>
        ))}
      </section>

      <section className="dashboard-grid">
        <GlassCard className="panel stage-panel">
          <div className="panel-head">
            <h3>Pipeline By Stage</h3>
            <span>{deals.length} deals tracked</span>
          </div>
          <div className="stage-chart">
            {stageData.map((stage, index) => (
              <div key={stage.stage} className="stage-column">
                <div className="stage-track">
                  <motion.div
                    className="stage-fill"
                    initial={{ height: 0 }}
                    animate={{
                      height: `${Math.max((stage.value / highestStageValue) * 100, 5)}%`,
                    }}
                    transition={{ duration: 0.45, delay: index * 0.05 }}
                  />
                </div>
                <p>{stage.stage}</p>
                <strong>{formatCompactCurrency(stage.value)}</strong>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="panel meetings-panel">
          <div className="panel-head">
            <h3>Upcoming Meetings</h3>
            <span>This week</span>
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

        <GlassCard className="panel deals-table-panel">
          <div className="panel-head">
            <h3>Top Opportunities</h3>
            <span>Sorted by deal value</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Stage</th>
                  <th>Owner</th>
                  <th>Close Date</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {topDeals.map((deal) => (
                  <tr key={deal.id}>
                    <td>{deal.company}</td>
                    <td>
                      <span className={`status-pill ${deal.stage === 'Won' ? 'success' : ''}`}>
                        {deal.stage}
                      </span>
                    </td>
                    <td>{deal.owner}</td>
                    <td>{deal.expectedClose}</td>
                    <td>{formatCurrency(deal.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>

        <GlassCard className="panel activity-panel">
          <div className="panel-head">
            <h3>Activity Feed</h3>
            <span>Latest actions</span>
          </div>
          <div className="activity-feed">
            {activities.map((activity) => (
              <div key={activity.id} className="activity-row">
                <div className="activity-type">{activity.type}</div>
                <div>
                  <h4>{activity.company}</h4>
                  <p>{activity.detail}</p>
                  <small>
                    {activity.owner} · {activity.date}
                  </small>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="panel actions-panel">
          <div className="panel-head">
            <h3>Next Critical Actions</h3>
            <span>Ordered by close date</span>
          </div>
          <div className="next-actions">
            {nextActions.map((deal) => (
              <div key={deal.id} className="action-row">
                <div>
                  <h4>{deal.company}</h4>
                  <p>{deal.nextAction}</p>
                </div>
                <div className="action-meta">
                  <span>{deal.expectedClose}</span>
                  <strong>{formatCompactCurrency(deal.value)}</strong>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </section>
    </div>
  );
}

function PipelineView({ deals, stages, onDealDragStart, onDealDrop }) {
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

          <div className="client-contact-row">
            <div className="mini-stat">
              <UsersRound size={15} />
              <span>{selectedClient.contactName}</span>
            </div>
            <div className="mini-stat">
              <Mail size={15} />
              <span>{selectedClient.email}</span>
            </div>
            <div className="mini-stat">
              <MapPin size={15} />
              <span>{selectedClient.phone}</span>
            </div>
          </div>

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
  monthlyRevenue,
  invoices,
  monthlyRetainerTotal,
  collectedThisMonth,
  weightedForecast,
}) {
  const highestMonthlyAmount = Math.max(
    ...monthlyRevenue.map((item) => Math.max(item.collected, item.forecast)),
    1,
  );

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
            <h3>Collected vs Forecast</h3>
            <span>Last 6 months</span>
          </div>
          <div className="revenue-chart">
            {monthlyRevenue.map((item) => (
              <div key={item.month} className="revenue-column">
                <div className="bar-pair">
                  <div
                    className="bar forecast"
                    style={{ height: `${(item.forecast / highestMonthlyAmount) * 100}%` }}
                  />
                  <div
                    className="bar collected"
                    style={{ height: `${(item.collected / highestMonthlyAmount) * 100}%` }}
                  />
                </div>
                <p>{item.month}</p>
              </div>
            ))}
          </div>
          <div className="chart-legend">
            <span>
              <i className="legend-color forecast" /> Forecast
            </span>
            <span>
              <i className="legend-color collected" /> Collected
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
              <input type="checkbox" defaultChecked />
            </label>
            <label className="setting-row">
              <span>Invoice due in 3 days</span>
              <input type="checkbox" defaultChecked />
            </label>
            <label className="setting-row">
              <span>Daily activity digest email</span>
              <input type="checkbox" />
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
              <input type="checkbox" defaultChecked />
            </label>
            <label className="setting-row">
              <span>Create task when proposal is sent</span>
              <input type="checkbox" defaultChecked />
            </label>
            <label className="setting-row">
              <span>Require loss reason before stage = Lost</span>
              <input type="checkbox" />
            </label>
          </div>
        </GlassCard>
      </section>
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
