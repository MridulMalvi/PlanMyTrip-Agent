import { useState } from 'react';
import { TripPlan, AgentUpdate } from '../types';

// Lightweight markdown → HTML (handles headers, bold, lists, hr, code)
function renderMarkdown(md: string): string {
  if (!md) return '';
  let html = md
    // Escape
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold / italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // HR
    .replace(/^---$/gm, '<hr/>')
    // Lists
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Paragraphs
    .replace(/\n\n/g, '</p><p>')
    // Emoji lines → preserve
    .replace(/(<li>.*?<\/li>)/g, '<ul>$1</ul>');

  // Collapse adjacent uls
  html = html.replace(/<\/ul>\s*<ul>/g, '');
  return `<p>${html}</p>`;
}

interface TabDef {
  key: string;
  label: string;
  icon: string;
  content: string;
  agentName: string;
}

interface Props {
  plan: TripPlan | null;
  agents: AgentUpdate[];
  isStreaming: boolean;
}

export function ItineraryViewer({ plan, agents, isStreaming }: Props) {
  const [activeTab, setActiveTab] = useState('research');

  const tabs: TabDef[] = [
    { key: 'research',  label: 'Research',  icon: '🔍', content: plan?.research_output  ?? '', agentName: 'Planning Agent'     },
    { key: 'itinerary', label: 'Itinerary', icon: '🗓️', content: plan?.itinerary_output ?? '', agentName: 'Optimization Agent' },
    { key: 'budget',    label: 'Budget',    icon: '💰', content: plan?.budget_output    ?? '', agentName: 'Budget Agent'       },
    { key: 'local',     label: 'Local Tips',icon: '🌿', content: plan?.local_output     ?? '', agentName: 'Local Expert Agent' },
  ];

  if (!plan && !isStreaming) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🌍</div>
        <div className="empty-title">Your itinerary will appear here</div>
        <div className="empty-subtitle">
          Fill in the form on the left and click "Plan My Trip" to watch the AI agents build your perfect trip in real time.
        </div>
      </div>
    );
  }

  function getAgentStatus(name: string) {
    return agents.find(a => a.agent === name)?.status ?? 'idle';
  }

  return (
    <div className="results-panel">
      {/* Tab bar */}
      <div className="results-tabs">
        {tabs.map((tab) => {
          const status = getAgentStatus(tab.agentName);
          return (
            <button
              key={tab.key}
              className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <span>{tab.icon}</span>
              {tab.label}
              {status === 'running' && (
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: 'var(--c-running)',
                  animation: 'pulse-dot 1.2s infinite',
                  display: 'inline-block',
                }} />
              )}
              {status === 'done' && (
                <span style={{ color: 'var(--c-success)', fontSize: '0.7rem' }}>✓</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tabs.map((tab) => {
        if (tab.key !== activeTab) return null;
        const agentStatus = getAgentStatus(tab.agentName);

        return (
          <div key={tab.key} className="tab-content fade-in">
            {agentStatus === 'running' && (
              <LoadingSkeleton />
            )}
            {agentStatus === 'error' && (
              <div className="error-banner" style={{ margin: 0, marginBottom: 20 }}>
                ⚠️ This agent encountered an error. Other agents may still complete.
              </div>
            )}
            {tab.content ? (
              <div
                className="markdown-body"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(tab.content) }}
              />
            ) : agentStatus === 'idle' && !isStreaming ? (
              <div className="empty-state" style={{ height: 'auto', paddingTop: 60 }}>
                <div className="empty-icon">{tab.icon}</div>
                <div className="empty-title">Waiting for {tab.agentName}</div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 700 }}>
      {[80, 60, 90, 70, 50, 85, 65].map((w, i) => (
        <div key={i} className="skeleton" style={{ height: 16, width: `${w}%` }} />
      ))}
      <div style={{ height: 24 }} />
      {[75, 55, 88, 66, 44].map((w, i) => (
        <div key={i} className="skeleton" style={{ height: 16, width: `${w}%` }} />
      ))}
    </div>
  );
}
