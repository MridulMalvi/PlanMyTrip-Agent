// Shared TypeScript types for TravelAgent AI frontend

export interface TripRequest {
  destination: string;
  start_date: string;
  end_date: string;
  duration_days: number;
  budget_usd: number;
  travelers: number;
  preferences?: string;
}

export interface AgentUpdate {
  agent: string;
  status: 'idle' | 'running' | 'done' | 'error';
  message: string;
  output?: string;
}

export interface TripPlan {
  destination: string;
  duration_days: number;
  budget_usd: number;
  travelers: number;
  raw_output: string;
  research_output: string;
  itinerary_output: string;
  budget_output: string;
  local_output: string;
}

export type StreamEventType = 'agent_start' | 'agent_done' | 'plan_complete' | 'error';

export interface StreamEvent {
  type: StreamEventType;
  agent?: string;
  status?: string;
  message?: string;
  output?: string;
  plan?: TripPlan;
  detail?: string;
}

export type AppState = 'idle' | 'streaming' | 'done' | 'error';

export interface TripState {
  appState: AppState;
  agents: AgentUpdate[];
  plan: TripPlan | null;
  error: string | null;
}
