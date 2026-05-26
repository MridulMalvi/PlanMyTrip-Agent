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
      {/* View switcher */}
      {(plan || isStreaming) && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '10px 24px',
          borderBottom: '1px solid var(--c-border)',
          background: 'rgba(13,19,32,0.5)',
          backdropFilter: 'blur(10px)',
        }}>
          {viewBtns.map(b => (
            <button
              key={b.key}
              onClick={() => setView(b.key)}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--r-sm)',
                border: '1px solid ' + (view === b.key ? 'var(--c-aurora-2)' : 'var(--c-border)'),
                background: view === b.key ? 'rgba(14,165,233,0.1)' : 'transparent',
                color: view === b.key ? 'var(--c-aurora-2)' : 'var(--c-text-muted)',
                fontSize: '0.8rem',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s',
                fontFamily: 'inherit',
              }}
            >
              {b.icon} {b.label}
            </button>
          ))}
        </div>
      )}

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
