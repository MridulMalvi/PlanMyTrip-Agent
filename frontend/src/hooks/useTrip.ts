/// <reference types="vite/client" />
// SSE streaming hook — manages the full trip planning state machine
import { useState, useCallback, useRef } from 'react';
import { TripRequest, TripState, AgentUpdate, StreamEvent } from '../types';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

const AGENT_NAMES = [
  'Planning Agent',
  'Optimization Agent',
  'Budget Agent',
  'Local Expert Agent',
];

function initialAgents(): AgentUpdate[] {
  return AGENT_NAMES.map((name) => ({
    agent: name,
    status: 'idle',
    message: 'Waiting to start…',
    output: undefined,
  }));
}

export function useTrip() {
  const [state, setState] = useState<TripState>({
    appState: 'idle',
    agents: initialAgents(),
    plan: null,
    error: null,
  });

  const abortRef = useRef<AbortController | null>(null);

  const planTrip = useCallback(async (request: TripRequest) => {
    // Abort any previous request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({
      appState: 'streaming',
      agents: initialAgents(),
      plan: null,
      error: null,
    });

    try {
      const response = await fetch(`${API_BASE}/api/trip/plan/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(err.detail ?? 'Server error');
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          let event: StreamEvent;
          try {
            event = JSON.parse(raw);
          } catch {
            continue;
          }

          setState((prev) => applyEvent(prev, event));
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setState((prev) => ({
        ...prev,
        appState: 'error',
        error: err.message ?? 'Unknown error',
      }));
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState({ appState: 'idle', agents: initialAgents(), plan: null, error: null });
  }, []);

  return { state, planTrip, reset };
}

// Pure state reducer applied per SSE event
function applyEvent(prev: TripState, event: StreamEvent): TripState {
  switch (event.type) {
    case 'agent_start': {
      const agents = prev.agents.map((a) =>
        a.agent === event.agent
          ? { ...a, status: 'running' as const, message: event.message ?? '' }
          : a
      );
      return { ...prev, agents };
    }
    case 'agent_done': {
      const agents = prev.agents.map((a) =>
        a.agent === event.agent
          ? { ...a, status: 'done' as const, message: event.message ?? '', output: event.output }
          : a
      );
      return { ...prev, agents };
    }
    case 'plan_complete': {
      return {
        ...prev,
        appState: 'done',
        plan: event.plan ?? null,
      };
    }
    case 'error': {
      return {
        ...prev,
        appState: 'error',
        error: event.detail ?? 'An unknown error occurred.',
      };
    }
    default:
      return prev;
  }
}
