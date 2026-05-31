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

const DEFAULT_PLAN: TripPlan = {
  origin: "San Francisco",
  destination: "Tokyo",
  duration_days: 7,
  budget_usd: 3500,
  travelers: 2,
  raw_output: "",
  research_output: `
# ✈️ Tokyo Flight Options

Here are the premium flight choices researched for your trip from **San Francisco (SFO)** to **Tokyo, Japan (NRT/HND)**.

---

### 🇸🇬 Option 1 — Singapore Airlines (Highly Recommended)
• **Airline:** Singapore Airlines (SQ)
• **Route:** SFO ➔ NRT (via SIN)
• **Departure:** June 14, 2026 at 10:30 PM
• **Arrival:** June 16, 2026 at 8:45 AM (+1 Day)
• **Duration:** 22h 15m (1 stop in Singapore)
• **Price:** **$1,240 USD** per person
• **Total Cost:** **$2,480 USD** for 2 travelers
• **Key Highlights:** Award-winning cabin service, exceptional legroom, and premium inflight meals.

---

### 🇭🇰 Option 2 — Cathay Pacific
• **Airline:** Cathay Pacific (CX)
• **Route:** SFO ➔ HND (via HKG)
• **Departure:** June 14, 2026 at 11:55 PM
• **Arrival:** June 16, 2026 at 11:20 AM (+1 Day)
• **Duration:** 23h 25m (1 stop in Hong Kong)
• **Price:** **$1,180 USD** per person
• **Total Cost:** **$2,360 USD** for 2 travelers
• **Key Highlights:** Generous baggage allowances, convenient morning arrival, and excellent lounge services.

---

### 🇯🇵 Option 3 — ANA (All Nippon Airways)
• **Airline:** ANA (All Nippon Airways)
• **Route:** SFO ➔ NRT (Non-stop)
• **Departure:** June 14, 2026 at 11:45 AM
• **Arrival:** June 15, 2026 at 3:10 PM (+1 Day)
• **Duration:** 11h 25m (Direct)
• **Price:** **$1,320 USD** per person
• **Total Cost:** **$2,640 USD** for 2 travelers
• **Key Highlights:** Direct flight, premium traditional Japanese meals, and legendary hospitality.
`,
  itinerary_output: `
# 🗓️ Tokyo Trip Itinerary (7 Days)

A day-by-day itinerary optimized for cultural experiences, food, and ease of transit.

---

**Day 1 — Arrival & Neon Shinjuku**
• **Morning:** Land at Tokyo Narita Airport (NRT), complete immigration, and board the comfortable Narita Express (N'EX) to Shinjuku.
• **Afternoon:** Check into your mid-range hotel, freshen up, and take a relaxed stroll through nearby parks.
• **Evening:** Explore Shinjuku's vibrant street scenes, wander through the historic **Omoide Yokocho** alleyways, and grab dinner at a local yakitori stand.
• **Transit:** Narita Express train (75 mins) & subway.

---

**Day 2 — Historic Asakusa & Geek Culture in Akihabara**
• **Morning:** Visit **Senso-ji Temple** in Asakusa, Tokyo's oldest and most iconic Buddhist temple. Stroll down Nakamise shopping street for traditional souvenirs.
• **Afternoon:** Take the Ginza line to **Akihabara**, the world capital of electronics and anime culture.
• **Evening:** Treat yourselves to a delicious, hot bowl of authentic Hakata-style ramen.
• **Transit:** Ginza subway line (15 mins).

---

**Day 3 — Shinto Serenity & The Shibuya Crossing**
• **Morning:** Walk through the forested pathways surrounding the majestic **Meiji Jingu Shrine** in Yoyogi Park.
• **Afternoon:** Explore the colorful fashion boutiques along Takeshita Street in **Harajuku** and the architecture of Omotesando.
• **Evening:** Witness the historic scramble crossing in **Shibuya**, and ascend to **Shibuya Sky** for a stunning panoramic sunset view of Tokyo.
• **Transit:** Yamanote line (10 mins).
`,
  budget_output: `
# 💰 Cost Breakdown & Budget Analysis

Detailed financial summary for 2 travelers against your **$3,500 USD** budget.

---

### 📊 Estimated Expenses (USD)

| Category | Description | Cost |
|---|---|---|
| ✈️ **Flights** | SFO to NRT Round-Trip (Singapore Airlines) | $2,480 |
| 🏨 **Accommodation** | 6 Nights in Mid-Range Shinjuku Hotel | $900 |
| 🍽️ **Food & Dining** | Casual street food, ramen, and mid-range izakayas | $650 |
| 🚌 **Local Transit** | Suica cards & Narita Express airport tickets | $220 |
| 🎟️ **Activities** | Shibuya Sky tickets, temple entry fees, and tours | $180 |
| 🎁 **Miscellaneous** | Pocket Wi-Fi rental & small souvenirs | $150 |

---

### 📝 Verdict

• **Grand Total:** **$4,580 USD** (For 2 travelers)
• **Overage:** **$1,080 USD**
• **Verdict:** ⚠️ **Slightly over the $3,500 target**

### 💡 Suggested Savings Hacks
1. **Switch Flights:** Select Cathay Pacific (saves $120) or check budget Zipair direct options (saves up to $800).
2. **Alternative Stay:** Stay in nearby quiet neighborhoods like Ueno or Asakusa rather than central Shinjuku (saves $250).
3. **Dining Hack:** Utilize Tokyo's amazing convenience stores (Conbini) for delicious breakfasts and take advantage of lunch specials (saves $150).
`,
  local_output: `
# 🌿 Hidden Gems & Cultural Tips

Local expert tips to help you navigate Tokyo like a seasoned native.

---

### 🗺️ Hidden Gems
• **Yanaka Ginza:** A beautiful old-town neighborhood that escaped historical damage. Traditional snacks, quiet temples, and cats.
• **Todoroki Valley:** A quiet, forested river ravine tucked away in urban Tokyo—a perfect nature getaway.
• **Meguro Parasitological Museum:** A wonderfully quirky, free micro-museum for travelers looking for the unusual.

### 🍱 Authentic Eateries
• **Harajuku Gyozaro:** Outstanding, simple pan-fried and steamed gyoza at very affordable prices.
• **Fuunji (Shinjuku):** Legendary dipping ramen (Tsukemen) made with a rich chicken-and-fish broth.
• **Tempura Tsunahachi:** High-quality, traditional tempura serving Tokyo foodies since 1924 in central Shinjuku.

### 🚇 Essential Cultural Tips
• **Transit:** Always stand on the left side of escalators in Tokyo (and let others pass on the right).
• **Tipping:** Tipping is not done in Japan—it can even be seen as slightly confusing or impolite.
• **Cash:** Keep some cash on hand. While modern shops accept credit cards, smaller traditional shrines, street stands, and ticket machines remain cash-only.
`
};

export function useTrip() {
  const [state, setState] = useState<TripState>({
    appState: 'done',
    agents: initialAgents().map(a => ({
      ...a,
      status: 'done',
      message: a.agent === 'Planning Agent' ? 'Flights, hotels & activities researched.' :
               a.agent === 'Optimization Agent' ? 'Day-by-day itinerary optimized.' :
               a.agent === 'Budget Agent' ? 'Budget breakdown complete.' : 'Local insights added.'
    })),
    plan: DEFAULT_PLAN,
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
