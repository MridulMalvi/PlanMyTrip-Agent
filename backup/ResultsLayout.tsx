import { useState } from 'react';
import { TripPlan, AgentUpdate } from '../types';
import { ItineraryViewer } from './ItineraryViewer';
import { MapVisualization } from './MapVisualization';

type View = 'itinerary' | 'map' | 'split';

interface Props {
  plan: TripPlan | null;
  agents: AgentUpdate[];
  isStreaming: boolean;
}

export function ResultsLayout({ plan, agents, isStreaming }: Props) {
  const [view, setView] = useState<View>('itinerary');

  const viewBtns: { key: View; icon: string; label: string }[] = [
    { key: 'itinerary', icon: '📋', label: 'Itinerary' },
    { key: 'map',       icon: '🗺️', label: 'Map' },
    { key: 'split',     icon: '⧉',  label: 'Split' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* View switcher — always visible */}
      <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '10px 24px',
          borderBottom: '1px solid var(--c-border)',
          background: 'var(--c-bg)',
        }}>
          {viewBtns.map(b => (
            <button
              key={b.key}
              onClick={() => setView(b.key)}
              style={{
                padding: '6px 16px',
                borderRadius: 'var(--r-sm)',
                border: '1.5px solid ' + (view === b.key ? 'var(--c-accent)' : 'var(--c-border)'),
                background: view === b.key ? 'var(--c-accent-soft)' : 'transparent',
                color: view === b.key ? 'var(--c-accent)' : 'var(--c-text-muted)',
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '0.83rem',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s',
              }}
            >
              {b.icon} {b.label}
            </button>
          ))}
        </div>

      {/* Content area */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {view === 'itinerary' && (
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <ItineraryViewer plan={plan} agents={agents} isStreaming={isStreaming} />
          </div>
        )}
        {view === 'map' && (
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <MapVisualization plan={plan} isStreaming={isStreaming} />
          </div>
        )}
        {view === 'split' && (
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden' }}>
            <div style={{ overflow: 'hidden', borderRight: '1px solid var(--c-border)' }}>
              <ItineraryViewer plan={plan} agents={agents} isStreaming={isStreaming} />
            </div>
            <div style={{ overflow: 'hidden' }}>
              <MapVisualization plan={plan} isStreaming={isStreaming} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
