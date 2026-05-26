import { AgentUpdate } from '../types';

interface Props {
  agents: AgentUpdate[];
  doneCount: number;
  total: number;
}

const AGENT_META: Record<string, { icon: string; color: string; colorVar: string }> = {
  'Planning Agent':     { icon: '🔍', color: '#818cf8', colorVar: '--c-agent-plan' },
  'Optimization Agent': { icon: '🗺️', color: '#34d399', colorVar: '--c-agent-opt'  },
  'Budget Agent':       { icon: '💰', color: '#f59e0b', colorVar: '--c-agent-bud'  },
  'Local Expert Agent': { icon: '🌿', color: '#f472b6', colorVar: '--c-agent-loc'  },
};

export function AgentPanel({ agents, doneCount, total }: Props) {
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  return (
    <div className="agent-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <p className="section-title" style={{ margin: 0 }}>🤖 AI Agents</p>
        {doneCount > 0 && (
          <span style={{ fontSize: '0.75rem', color: 'var(--c-aurora-4)', fontWeight: 600 }}>
            {pct}% complete
          </span>
        )}
      </div>

      {doneCount > 0 && doneCount < total && (
        <div className="progress-bar" style={{ margin: '0 0 16px 0' }}>
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
      )}

      <div className="agent-cards">
        {agents.map((agent) => {
          const meta = AGENT_META[agent.agent] ?? { icon: '🤖', color: '#64748b', colorVar: '' };
          return (
            <div
              key={agent.agent}
              className={`agent-card status-${agent.status} fade-in`}
              style={{ '--agent-color': meta.color } as any}
            >
              <div
                className="agent-icon"
                style={{
                  background: agent.status === 'idle'
                    ? 'rgba(255,255,255,0.04)'
                    : `${meta.color}1a`,
                  border: agent.status !== 'idle' ? `1px solid ${meta.color}33` : undefined,
                }}
              >
                {meta.icon}
              </div>

              <div className="agent-info">
                <div className="agent-name">{agent.agent}</div>
                <div className="agent-message">
                  {agent.status === 'running' && (
                    <span style={{ color: 'var(--c-running)' }}>
                      <TypingDots /> {agent.message}
                    </span>
                  )}
                  {agent.status === 'done' && (
                    <span style={{ color: 'var(--c-success)' }}>✓ {agent.message}</span>
                  )}
                  {agent.status === 'error' && (
                    <span style={{ color: 'var(--c-error)' }}>✗ {agent.message}</span>
                  )}
                  {agent.status === 'idle' && (
                    <span>{agent.message}</span>
                  )}
                </div>
              </div>

              <div className={`agent-status-dot ${agent.status === 'idle' ? '' : agent.status}`} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 3, marginRight: 4, verticalAlign: 'middle' }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 4,
            height: 4,
            borderRadius: '50%',
            background: 'var(--c-running)',
            display: 'inline-block',
            animation: `pulse-dot 1.2s ${i * 0.2}s ease-in-out infinite`,
          }}
        />
      ))}
    </span>
  );
}
