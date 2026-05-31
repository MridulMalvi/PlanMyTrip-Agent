/// <reference types="vite/client" />
// SSE streaming hook — manages the full trip planning state machine
import { useState, useCallback, useRef } from 'react';
import { TripRequest, TripState, AgentUpdate, StreamEvent, TripPlan } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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

/** Map agent name → TripPlan field key */
function agentToField(agentName: string): keyof TripPlan | null {
  switch (agentName) {
    case 'Planning Agent':     return 'research_output';
    case 'Optimization Agent': return 'itinerary_output';
    case 'Budget Agent':       return 'budget_output';
    case 'Local Expert Agent': return 'local_output';
    default:                   return null;
  }
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
      // Buffer accumulates raw bytes; we split on SSE double-newline boundaries
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE messages are separated by \n\n — split on that boundary
        const messages = buffer.split('\n\n');
        // Last element may be an incomplete message — keep it in the buffer
        buffer = messages.pop() ?? '';

        for (const message of messages) {
          // Each SSE message may have multiple lines; find the data line(s)
          for (const line of message.split('\n')) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6).trim();
            if (!raw) continue;

            let event: StreamEvent;
            try {
              event = JSON.parse(raw);
            } catch {
              // Partial JSON — shouldn't happen with \n\n splitting, but skip if so
              console.warn('Failed to parse SSE event:', raw.slice(0, 200));
              continue;
            }

            setState((prev) => applyEvent(prev, event));
          }
        }
      }

      // Process any remaining buffered data after stream closes
      if (buffer.trim()) {
        for (const line of buffer.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const event: StreamEvent = JSON.parse(raw);
            setState((prev) => applyEvent(prev, event));
          } catch { /* ignore */ }
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

      // Immediately populate the corresponding plan field so the tab
      // shows content as soon as each agent finishes (don't wait for plan_complete)
      const field = agentToField(event.agent ?? '');
      let plan = prev.plan;
      if (field && event.output) {
        plan = {
          origin: prev.plan?.origin ?? '',
          destination: prev.plan?.destination ?? '',
          duration_days: prev.plan?.duration_days ?? 0,
          budget_usd: prev.plan?.budget_usd ?? 0,
          travelers: prev.plan?.travelers ?? 1,
          raw_output: prev.plan?.raw_output ?? '',
          research_output: prev.plan?.research_output ?? '',
          itinerary_output: prev.plan?.itinerary_output ?? '',
          budget_output: prev.plan?.budget_output ?? '',
          local_output: prev.plan?.local_output ?? '',
          [field]: event.output,
        } as TripPlan;
      }

      return { ...prev, agents, plan };
    }
    case 'plan_complete': {
      return {
        ...prev,
        appState: 'done',
        // Merge with any partially-built plan from agent_done events
        plan: event.plan
          ? { ...(prev.plan ?? {}), ...event.plan } as TripPlan
          : prev.plan,
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
