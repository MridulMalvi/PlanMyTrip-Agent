"""
Root crew orchestrator — builds and runs the full CrewAI pipeline.

Exposes two entry points:
  - build_crew(request, settings)              → blocking, returns dict
  - build_crew_streaming(request, settings, callback) → streaming with per-task callback
"""
import sys
import os

_HERE = os.path.dirname(os.path.abspath(__file__))
_BACKEND = os.path.join(_HERE, "backend")
for _p in (_HERE, _BACKEND):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from typing import Callable, Optional
from crewai import Crew, Task, Process, LLM

from agents.planning_agent import build_planning_agent
from agents.optimization_agent import build_optimization_agent
from agents.budget_agent import build_budget_agent
from agents.local_expert_agent import build_local_expert_agent
from api.schemas import TripRequest
from core.config import Settings


# ---------------------------------------------------------------------------
# Shared task definitions
# ---------------------------------------------------------------------------

def _make_tasks(request: TripRequest, planner, optimizer, budgeter, local_exp):
    """Build the four CrewAI tasks and return them in execution order."""

    trip_context = (
        f"Origin (departure city): {request.origin}\n"
        f"Destination: {request.destination}\n"
        f"Route: {request.origin} → {request.destination}\n"
        f"Travel dates: {request.start_date} → {request.end_date} "
        f"({request.duration_days} days)\n"
        f"Total budget: ${request.budget_usd:,.0f} USD\n"
        f"Number of travelers: {request.travelers}\n"
        f"Preferences / constraints: {request.preferences or 'none specified'}"
    )

    task_plan = Task(
        description=(
            f"Research the following trip and compile concrete options:\n\n"
            f"{trip_context}\n\n"
            "Deliverables:\n"
            "1. FLIGHTS — 2–3 options flying from "
            f"{request.origin} to {request.destination} "
            "with airline, route, estimated price per person, "
            "and typical flight duration.\n"
            "2. HOTELS — 2–3 options with name, star rating, location, nightly rate, "
            "and a brief pro/con note.\n"
            "3. ACTIVITIES — 10+ attractions, tours, or experiences with name, "
            "category (culture / nature / food / adventure), estimated cost, "
            "and a one-line description.\n\n"
            "Use web search to ensure prices and availability are current. "
            "Always include estimated costs in USD."
        ),
        expected_output=(
            "A structured markdown document with three sections — FLIGHTS, HOTELS, "
            "ACTIVITIES — each containing the researched options with names, "
            "descriptions, and estimated USD costs."
        ),
        agent=planner,
    )

    task_optimize = Task(
        description=(
            f"Using the research compiled above, create a complete day-by-day itinerary "
            f"for {request.duration_days} days in {request.destination}.\n\n"
            "Rules:\n"
            "- Group geographically nearby attractions on the same day.\n"
            "- Use the Maps Distance Calculator to verify transit times between stops.\n"
            "- Structure each day as: 🌅 Morning | ☀️ Afternoon | 🌙 Evening.\n"
            "- Include realistic time allocations for each activity.\n"
            "- Add commute notes between each stop (e.g., '10-min subway ride').\n"
            "- Leave at least 1 hour of buffer per day for meals, rest, or detours.\n"
            "- Day 1 should account for arrival; last day for departure logistics."
        ),
        expected_output=(
            "A day-by-day itinerary formatted as:\n"
            "**Day N — [Theme/Neighbourhood]**\n"
            "🌅 Morning: ...\n"
            "☀️ Afternoon: ...\n"
            "🌙 Evening: ...\n"
            "🚇 Transit notes: ...\n\n"
            "Repeated for each day of the trip."
        ),
        agent=optimizer,
        context=[task_plan],
    )

    task_budget = Task(
        description=(
            f"Analyse the complete trip plan and produce a detailed cost breakdown "
            f"for {request.travelers} traveler(s) against a budget of "
            f"${request.budget_usd:,.0f} USD total.\n\n"
            "Cost categories to cover:\n"
            "✈️ Flights | 🏨 Accommodation | 🍽️ Food & Dining | "
            "🎟️ Activities & Entry Fees | 🚌 Local Transport | 🎁 Miscellaneous\n\n"
            "For each category: list individual items with unit cost and subtotal.\n"
            "Then provide:\n"
            "- Grand total (all travelers)\n"
            "- Remaining budget or overage amount\n"
            "- Budget verdict: ✅ Within budget / ⚠️ Slightly over / ❌ Over budget\n"
            "- If over budget: suggest 3+ specific, named alternatives with new prices."
        ),
        expected_output=(
            "A cost breakdown table or structured list by category, a grand total, "
            "a budget verdict, and — if needed — a list of specific money-saving "
            "alternatives with estimated savings per substitution."
        ),
        agent=budgeter,
        context=[task_plan, task_optimize],
    )

    task_local = Task(
        description=(
            f"Research and compile insider knowledge for {request.destination}. "
            f"Assume the traveller has the following preferences: "
            f"{request.preferences or 'no specific preferences'}.\n\n"
            "Deliverables:\n"
            "1. HIDDEN GEMS — 3–5 lesser-known locations tourists typically miss. "
            "For each: name, why it's special, best time to visit, how to get there.\n"
            "2. LOCAL RESTAURANTS — 5+ authentic eateries (NOT tourist traps). "
            "For each: name, cuisine type, must-order dish, price range, neighbourhood.\n"
            "3. CULTURAL TIPS — 5+ practical tips covering etiquette, customs, "
            "local transport hacks, safety advice, and money-saving tricks.\n\n"
            "Use web search to find current recommendations and recent local reviews."
        ),
        expected_output=(
            "A curated guide with three sections — HIDDEN GEMS, LOCAL RESTAURANTS, "
            "CULTURAL TIPS — each with the required number of richly detailed entries."
        ),
        agent=local_exp,
    )

    return task_plan, task_optimize, task_budget, task_local


# ---------------------------------------------------------------------------
# Blocking entry point (original)
# ---------------------------------------------------------------------------

def build_crew(request: TripRequest, settings: Settings) -> dict:
    """Run the crew synchronously and return a result dict."""
    llm = LLM(
        model=settings.gemini_model,
        api_key=settings.gemini_api_key,
        temperature=0.3,
        max_retries=6,          # auto-retry on 429 / transient errors
        timeout=120,            # seconds per LLM call
    )

    planner   = build_planning_agent(llm)
    optimizer = build_optimization_agent(llm)
    budgeter  = build_budget_agent(llm)
    local_exp = build_local_expert_agent(llm)

    task_plan, task_optimize, task_budget, task_local = _make_tasks(
        request, planner, optimizer, budgeter, local_exp
    )

    crew = Crew(
        agents=[planner, optimizer, budgeter, local_exp],
        tasks=[task_plan, task_optimize, task_budget, task_local],
        process=Process.sequential,
        verbose=True,
    )

    result = crew.kickoff()
    outputs = result.tasks_output if hasattr(result, "tasks_output") else []

    def _get(idx: int) -> str:
        try:
            return str(outputs[idx].raw) if idx < len(outputs) else ""
        except Exception:
            return ""

    return {
        "agent_updates": [
            {"agent": "Planning Agent",     "status": "done", "message": "Flights, hotels & activities researched.", "output": _get(0)},
            {"agent": "Optimization Agent", "status": "done", "message": f"Day-by-day itinerary created for {request.duration_days} days.", "output": _get(1)},
            {"agent": "Budget Agent",       "status": "done", "message": f"Cost breakdown complete — budget ${request.budget_usd:,.0f} USD analysed.", "output": _get(2)},
            {"agent": "Local Expert Agent", "status": "done", "message": "Hidden gems, authentic restaurants & cultural tips added.", "output": _get(3)},
        ],
        "plan": {
            "origin": request.origin,
            "destination": request.destination,
            "duration_days": request.duration_days,
            "budget_usd": request.budget_usd,
            "travelers": request.travelers,
            "raw_output": str(result),
            "research_output": _get(0),
            "itinerary_output": _get(1),
            "budget_output": _get(2),
            "local_output": _get(3),
        },
    }


# ---------------------------------------------------------------------------
# Streaming entry point — runs each task individually and calls back
# ---------------------------------------------------------------------------

AGENT_META = [
    ("Planning Agent",     "Researching flights, hotels & activities…",  "Flights, hotels & activities researched."),
    ("Optimization Agent", "Building day-by-day itinerary…",             "Day-by-day itinerary optimised."),
    ("Budget Agent",       "Analysing costs & budget…",                  "Budget breakdown complete."),
    ("Local Expert Agent", "Finding hidden gems & local tips…",          "Local insights added."),
]


def build_crew_streaming(
    request: TripRequest,
    settings: Settings,
    callback: Callable[[str, str, str, str], None],
) -> dict:
    """
    Run the crew sequentially, calling `callback` after each agent finishes.

    callback(agent_name, status, message, output)
      status: "done" | "error"
    """
    llm = LLM(
        model=settings.gemini_model,
        api_key=settings.gemini_api_key,
        temperature=0.3,
        max_retries=6,          # auto-retry on 429 / transient errors
        timeout=120,            # seconds per LLM call
    )

    planner   = build_planning_agent(llm)
    optimizer = build_optimization_agent(llm)
    budgeter  = build_budget_agent(llm)
    local_exp = build_local_expert_agent(llm)

    task_plan, task_optimize, task_budget, task_local = _make_tasks(
        request, planner, optimizer, budgeter, local_exp
    )

    tasks = [task_plan, task_optimize, task_budget, task_local]
    agents = [planner, optimizer, budgeter, local_exp]
    outputs: list[str] = []

    # Run each task sequentially as its own single-task crew so we can
    # emit streaming callbacks between tasks.
    for i, (task, agent, meta) in enumerate(zip(tasks, agents, AGENT_META)):
        agent_name, start_msg, done_msg = meta
        callback(agent_name, "running", start_msg, "")

        # Pacing: Sleep for 15 seconds before starting subsequent agents
        # to respect the Gemini free tier's 5 requests-per-minute (RPM) rate limit.
        import time
        if i > 0:
            time.sleep(15)

        # Attach context outputs from previous tasks
        if i > 0 and outputs:
            context_str = "\n\n---\n\n".join(outputs)
            task.description = task.description + f"\n\n[CONTEXT FROM PREVIOUS AGENTS]\n{context_str}"

        mini_crew = Crew(
            agents=[agent],
            tasks=[task],
            process=Process.sequential,
            verbose=True,
        )
        try:
            mini_result = mini_crew.kickoff()
            raw = ""
            if hasattr(mini_result, "tasks_output") and mini_result.tasks_output:
                raw = str(mini_result.tasks_output[0].raw)
            else:
                raw = str(mini_result)
            outputs.append(raw)
            callback(agent_name, "done", done_msg, raw)
        except Exception as exc:
            outputs.append("")
            callback(agent_name, "error", str(exc), "")

    research_out   = outputs[0] if len(outputs) > 0 else ""
    itinerary_out  = outputs[1] if len(outputs) > 1 else ""
    budget_out     = outputs[2] if len(outputs) > 2 else ""
    local_out      = outputs[3] if len(outputs) > 3 else ""

    return {
        "origin": request.origin,
        "destination": request.destination,
        "duration_days": request.duration_days,
        "budget_usd": request.budget_usd,
        "travelers": request.travelers,
        "raw_output": "\n\n".join(outputs),
        "research_output": research_out,
        "itinerary_output": itinerary_out,
        "budget_output": budget_out,
        "local_output": local_out,
    }
