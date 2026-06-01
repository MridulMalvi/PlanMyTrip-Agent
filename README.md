# PlanMyTrip AI

> A full-stack, multi-agent AI travel planner powered by **CrewAI**, **Google Gemini**, and **FastAPI** — with real-time Server-Sent Events streaming to a **React + Vite** frontend.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Agent Pipeline](#agent-pipeline)
4. [Backend](#backend)
   - [Tech Stack](#backend-tech-stack)
   - [Project Structure](#backend-project-structure)
   - [API Endpoints](#api-endpoints)
   - [SSE Streaming Protocol](#sse-streaming-protocol)
5. [Frontend](#frontend)
   - [Tech Stack](#frontend-tech-stack)
   - [Project Structure](#frontend-project-structure)
   - [State Machine](#state-machine)
   - [Component Tree](#component-tree)
6. [Environment Variables](#environment-variables)
7. [Getting Started](#getting-started)
8. [How It Works — End to End](#how-it-works--end-to-end)

---

## Overview

PlanMyTrip AI accepts a trip request (origin, destination, dates, budget, traveler count, and preferences) and spins up a **crew of 4 specialised AI agents** that research and plan the trip in sequence. Results stream back to the browser in real time via SSE — each agent's output appears in its own tab as soon as it finishes, without waiting for the full pipeline to complete.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        Browser (React)                       │
│  TripForm → useTrip hook → fetch POST /api/trip/plan/stream  │
│            ↕ SSE (ReadableStream)                            │
│  AgentPanel + ItineraryViewer + MapVisualization             │
└────────────────────────┬─────────────────────────────────────┘
                         │ HTTP / SSE
┌────────────────────────▼─────────────────────────────────────┐
│              FastAPI Backend  (port 8000)                     │
│  POST /api/trip/plan/stream → StreamingResponse              │
│  ThreadPoolExecutor runs crew in background thread           │
│  asyncio.Queue bridges thread → SSE generator                │
└────────────────────────┬─────────────────────────────────────┘
                         │ Python function calls
┌────────────────────────▼─────────────────────────────────────┐
│                    CrewAI Pipeline                           │
│   Planning Agent → Optimization Agent → Budget Agent         │
│                           → Local Expert Agent               │
│   (Sequential process, each task feeds context to next)      │
└────────────────────────┬─────────────────────────────────────┘
                         │ Tool calls
              ┌──────────┴──────────┐
              ▼                     ▼
     Google Gemini API         Tavily Search API
     (LLM inference)           (live web search)
```

---

## Agent Pipeline

The crew runs **4 agents in strict sequential order**. Each agent receives the outputs of all previous agents as context.

| # | Agent | Role | Key Tools | Output Tab |
|---|---|---|---|---|
| 1 | **Planning Agent** | Researches flights, hotels, and 10+ activities. Pulls live prices from the web. | Tavily Search, Maps Distance Calculator | 🔍 Research |
| 2 | **Optimization Agent** | Builds a day-by-day itinerary from the research, grouping nearby attractions and adding transit notes. | Maps Distance Calculator | 🗓️ Itinerary |
| 3 | **Budget Agent** | Produces a full cost breakdown by category (flights, accommodation, food, activities, transport, misc.) and issues a budget verdict. | — | 💰 Budget |
| 4 | **Local Expert Agent** | Adds hidden gems, authentic local restaurants, and cultural tips based on traveler preferences. | Tavily Search | 🌿 Local Tips |

### Rate Limiting
A **15-second sleep** is inserted between agents (configurable in `crew.py`) to stay within the Gemini free tier's 5 requests-per-minute (RPM) limit.

### Context Propagation
In streaming mode, each agent's raw output is prepended to the next task's description as `[CONTEXT FROM PREVIOUS AGENTS]`. This ensures downstream agents have full awareness of prior work even when running as independent single-task mini-crews.

---

## Backend

### Backend Tech Stack

| Layer | Technology |
|---|---|
| Web framework | FastAPI 0.115 |
| ASGI server | Uvicorn |
| Agent orchestration | CrewAI ≥ 0.80 |
| LLM | Google Gemini 2.0 Flash (via `langchain-google-genai`) |
| Web search | Tavily Python SDK |
| Data validation | Pydantic v2 + pydantic-settings |
| HTTP client | httpx |
| Testing | pytest + pytest-asyncio |

### Backend Project Structure

```
Travel Agent/
├── crew.py                     # Root orchestrator — build_crew() & build_crew_streaming()
├── requirements.txt
├── .env / .env.example
└── backend/
    ├── main.py                 # FastAPI app factory, CORS, router registration
    ├── agents/
    │   ├── planning_agent.py       # Planning Agent definition
    │   ├── optimization_agent.py   # Optimization Agent definition
    │   ├── budget_agent.py         # Budget Agent definition
    │   └── local_expert_agent.py   # Local Expert Agent definition
    ├── api/
    │   ├── routes.py               # POST /api/trip/plan and /api/trip/plan/stream
    │   └── schemas.py              # Pydantic models: TripRequest, TripPlan, StreamEvent…
    ├── core/
    │   ├── config.py               # Settings (pydantic-settings, loads .env)
    │   └── logging.py              # Structured logging setup
    └── tools/                      # Custom CrewAI tool wrappers
```

### API Endpoints

#### `GET /api/health`
Simple liveness check. Returns `{"status": "ok"}`.

---

#### `POST /api/trip/plan` — Blocking
Runs the entire 4-agent crew synchronously. Useful for Swagger testing (`/docs`).

**Request body:**
```json
{
  "origin": "San Francisco, USA",
  "destination": "Tokyo, Japan",
  "start_date": "2026-06-14",
  "end_date": "2026-06-21",
  "duration_days": 7,
  "budget_usd": 3500,
  "travelers": 2,
  "preferences": "Food, culture, walking. Mid-range hotels."
}
```

**Response:** `TripPlanResponse` containing `agent_updates[]` and a `plan` object with `research_output`, `itinerary_output`, `budget_output`, `local_output`.

---

#### `POST /api/trip/plan/stream` — SSE Streaming ⭐
The primary endpoint used by the frontend. Returns `Content-Type: text/event-stream`.

**Request body:** Same as blocking endpoint.

**Stream events** — each line is `data: <JSON>\n\n`:

| `type` | When emitted | Key fields |
|---|---|---|
| `agent_start` | Agent begins working | `agent`, `message` |
| `agent_done` | Agent finishes | `agent`, `message`, `output` (full markdown) |
| `plan_complete` | All 4 agents done | `plan` (complete `TripPlan` object) |
| `error` | Any failure | `detail` (error message) |

### SSE Streaming Protocol

The stream is implemented using an **asyncio Queue + ThreadPoolExecutor** bridge pattern:

```python
# routes.py (simplified)
queue = asyncio.Queue()
loop = asyncio.get_event_loop()

def callback(agent_name, status, message, output):
    # Called from worker thread — safely puts events onto the async queue
    event = StreamEvent(...)
    loop.call_soon_threadsafe(queue.put_nowait, event)

# Run blocking CrewAI in a thread
loop.run_in_executor(executor, run_crew)

# Async generator yields SSE-formatted strings
while True:
    event = await queue.get()
    yield f"data: {event.model_dump_json()}\n\n"
```

This keeps the FastAPI event loop non-blocking while the CPU-bound LLM calls run on a separate thread.

---

## Frontend

### Frontend Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 |
| Build tool | Vite 8 |
| Language | TypeScript 6 |
| Styling | Vanilla CSS (custom design system — Warm Sand theme) |
| Fonts | Space Grotesk (headings) + DM Sans (body) |
| Maps | Google Maps JavaScript API |
| State | Custom hook (`useTrip`) — no Redux/Zustand |

### Frontend Project Structure

```
frontend/
├── index.html
└── src/
    ├── main.tsx                    # React root mount
    ├── App.tsx                     # Root layout — header, sidebar, results pane
    ├── index.css                   # Full design system (CSS custom properties)
    ├── types.ts                    # Shared TS interfaces: TripRequest, TripPlan, StreamEvent…
    ├── hooks/
    │   └── useTrip.ts              # SSE streaming state machine
    └── components/
        ├── TripForm.tsx            # Left sidebar form — origin, destination, dates, budget, travelers
        ├── AgentPanel.tsx          # Live agent status cards with progress bar
        ├── ResultsLayout.tsx       # Itinerary / Map / Split view switcher
        ├── ItineraryViewer.tsx     # Tabbed markdown viewer (Research / Itinerary / Budget / Local Tips)
        └── MapVisualization.tsx    # Google Maps pane with geocoded location markers
```

### State Machine

All streaming state lives in `useTrip.ts`. The `AppState` transitions are:

```
idle ──► streaming ──► done
              │
              └──► error
```

The hook opens an `AbortController`-managed `fetch` to the SSE endpoint, reads the `ReadableStream` chunk by chunk, splits on `\n\n` SSE boundaries, parses each `data:` line as JSON, and applies a **pure reducer** (`applyEvent`) to update state:

- `agent_start` → marks that agent as `running` in the `agents[]` array
- `agent_done` → marks agent as `done`, immediately writes its `output` into the corresponding `TripPlan` field so the tab shows content **without waiting** for `plan_complete`
- `plan_complete` → sets `appState = 'done'` and deep-merges the final plan
- `error` → sets `appState = 'error'`

### Component Tree

```
App
├── <header>  (logo, status indicator, New Trip button, badge)
└── <main>
    ├── <aside> (sidebar)
    │   ├── TripForm         — form fields + submit
    │   ├── dest-hero        — destination chip (shown after plan starts)
    │   └── AgentPanel       — 4 agent cards with live status dots
    └── ResultsLayout        — view switcher
        ├── [itinerary view]
        │   └── ItineraryViewer
        │       ├── results-tabs  (Research / Itinerary / Budget / Local Tips)
        │       └── tab-content   (markdown rendered as HTML)
        ├── [map view]
        │   └── MapVisualization  (Google Maps + geocoded markers)
        └── [split view]
            ├── ItineraryViewer (left half)
            └── MapVisualization (right half)
```

#### Markdown Rendering
`ItineraryViewer` includes a lightweight custom Markdown → HTML renderer (`renderMarkdown`) that handles headers (`#`, `##`, `###`), bold/italic, inline code, horizontal rules, and unordered/ordered lists — with no external markdown library dependency.

#### Map Integration
`MapVisualization` lazily loads the Google Maps JS SDK via a `<script>` tag. Once a plan is available, it uses the Maps **Geocoder API** to place up to 12 location markers extracted from bold-text patterns (`**Location Name**`) in the itinerary output.

---

## Environment Variables

### Root `.env` (backend)

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | ✅ | Google AI Studio API key |
| `GEMINI_MODEL` | ✅ | Model name, e.g. `gemini-2.0-flash` |
| `TAVILY_API_KEY` | ✅ | Tavily web search API key |
| `GOOGLE_MAPS_API_KEY` | Optional | Enables map visualization |
| `DEBUG` | Optional | Enables verbose logging (default: `false`) |
| `CORS_ORIGINS` | Optional | JSON array of allowed frontend origins |

### `frontend/.env.local`

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | Optional | Backend URL (default: `http://localhost:8000`) |
| `VITE_GOOGLE_MAPS_KEY` | Optional | Google Maps JS API key for the map tab |

---

## Getting Started

### Prerequisites
- Python ≥ 3.11
- Node.js ≥ 18
- API keys: Gemini, Tavily (required); Google Maps (optional)

### 1. Clone & configure

```bash
git clone <repo-url>
cd "Travel Agent"

# Copy and fill in environment variables
cp .env.example .env
# Edit .env with your API keys
```

### 2. Install Python dependencies

```bash
pip install -r requirements.txt
```

### 3. Start the backend

```bash
cd backend
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.
Interactive docs: `http://localhost:8000/docs`

### 4. Install and start the frontend

```bash
cd frontend
npm install
npm run dev
```

The app will be available at `http://localhost:5173` (or the next available port).

### 5. Plan a trip

1. Enter your **origin** and **destination**
2. Set your **travel dates**, **budget**, and **traveler count**
3. Optionally add **preferences** (e.g. "vegetarian food, avoid crowds")
4. Click **Plan My Trip with AI**
5. Watch all 4 agents work in real time in the sidebar — results appear tab-by-tab as each agent finishes

---

## How It Works — End to End

```
User submits form
       │
       ▼
useTrip.planTrip(request)
  └─► POST /api/trip/plan/stream   (SSE connection opened)
              │
              ▼
      FastAPI spawns worker thread
              │
              ├─► Planning Agent starts
              │     • Tavily search: flights, hotels, activities
              │     • LLM: structure results into markdown
              │     ──► SSE: { type: "agent_start", agent: "Planning Agent" }
              │     ──► SSE: { type: "agent_done", agent: "Planning Agent", output: "..." }
              │         → Frontend: Research tab populates immediately
              │
              ├─► [15s pause — rate limit]
              │
              ├─► Optimization Agent starts
              │     • Context: Planning Agent output injected into prompt
              │     • LLM: day-by-day itinerary with transit notes
              │     ──► SSE: agent_start + agent_done (Itinerary tab populates)
              │
              ├─► [15s pause]
              │
              ├─► Budget Agent starts
              │     • Context: Planning + Optimization outputs
              │     • LLM: cost breakdown, budget verdict
              │     ──► SSE: agent_start + agent_done (Budget tab populates)
              │
              ├─► [15s pause]
              │
              └─► Local Expert Agent starts
                    • Tavily search: hidden gems, local restaurants
                    • LLM: curated local guide
                    ──► SSE: agent_start + agent_done (Local Tips tab populates)
                    ──► SSE: { type: "plan_complete", plan: { ... } }
                        → Frontend: appState = "done", New Trip button activates
```
