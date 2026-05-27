import { useEffect } from 'react';
import { useTrip } from './hooks/useTrip';
import { TripForm } from './components/TripForm';
import { AgentPanel } from './components/AgentPanel';
import { ResultsLayout } from './components/ResultsLayout';
import { TripRequest } from './types';

export default function App() {
  const { state, planTrip, reset } = useTrip();
  const { appState, agents, plan, error } = state;

  const isStreaming = appState === 'streaming';
  const isDone = appState === 'done';
  const doneCount = agents.filter(a => a.status === 'done').length;

  // Auto-focus map tab after plan arrives
  useEffect(() => {
    if (isDone && plan) {
      const route = plan.origin ? `${plan.origin} → ${plan.destination}` : plan.destination;
      document.title = `${route} — TravelAgent AI`;
    } else {
      document.title = 'TravelAgent AI — AI-Powered Trip Planner';
    }
  }, [isDone, plan]);

  function handleSubmit(req: TripRequest) {
    planTrip(req);
  }

  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="header">
        <div className="header-logo">
          <div className="header-logo-icon">✈️</div>
          <span className="header-logo-text">TravelAgent AI</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {isDone && plan && (
            <div style={{
              fontSize: '0.78rem',
              color: 'var(--c-text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: 'var(--c-success)',
                display: 'inline-block',
              }} />
              Plan ready · {plan.origin ? `${plan.origin} → ${plan.destination}` : plan.destination}
            </div>
          )}

          {isStreaming && (
            <div style={{
              fontSize: '0.78rem',
              color: 'var(--c-running)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: 'var(--c-running)',
                display: 'inline-block',
                animation: 'pulse-dot 1.2s infinite',
              }} />
              {doneCount}/4 agents complete
            </div>
          )}

          {(isStreaming || isDone) && (
            <button
              onClick={reset}
              className="btn-secondary"
              style={{ width: 'auto', padding: '6px 16px', marginTop: 0 }}
            >
              ↩ New Trip
            </button>
          )}

          <span className="header-badge">Powered by CrewAI</span>
        </div>
      </header>

      {/* ── Main ── */}
      <div className="main">
        {/* Sidebar */}
        <aside className="sidebar">
          <TripForm onSubmit={handleSubmit} disabled={isStreaming} />

          {/* Destination hero once plan is streaming/done */}
          {plan && (
                      <div className="dest-hero fade-in">
              {plan.origin && (
                <div style={{ fontSize: '0.75rem', color: 'var(--c-text-muted)', marginBottom: 4, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  {plan.origin}
                </div>
              )}
              <div className="dest-name" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {plan.origin && <span style={{ fontSize: '0.7em', opacity: 0.5 }}>✈️</span>}
                {plan.destination}
              </div>
              <div className="dest-meta">
                <span className="dest-chip">📅 {plan.duration_days} days</span>
                <span className="dest-chip">👥 {plan.travelers} traveler{plan.travelers !== 1 ? 's' : ''}</span>
                <span className="dest-chip">💵 ${plan.budget_usd.toLocaleString()}</span>
              </div>
            </div>
          )}

          {/* Agent panel — always visible once planning starts */}
          {(isStreaming || isDone || error) && (
            <AgentPanel
              agents={agents}
              doneCount={doneCount}
              total={agents.length}
            />
          )}

          {/* Error */}
          {error && (
            <div className="error-banner">
              <span>⚠️</span>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Planning failed</div>
                <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>{error}</div>
              </div>
            </div>
          )}
        </aside>

        {/* Results */}
        <main style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <ResultsLayout
            plan={plan}
            agents={agents}
            isStreaming={isStreaming}
          />
        </main>
      </div>
    </div>
  );
}
