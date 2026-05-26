"""
Pydantic schemas for the TravelAgent AI API.
"""
from typing import Any, Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Request
# ---------------------------------------------------------------------------

class TripRequest(BaseModel):
    """Payload that the user submits to kick off a trip-planning session."""

    destination: str = Field(
        ...,
        examples=["Tokyo, Japan"],
        description="City and country (or region) to visit.",
    )
    start_date: str = Field(
        ...,
        examples=["2025-07-01"],
        description="Departure date in YYYY-MM-DD format.",
    )
    end_date: str = Field(
        ...,
        examples=["2025-07-10"],
        description="Return date in YYYY-MM-DD format.",
    )
    duration_days: int = Field(
        ...,
        ge=1,
        le=60,
        examples=[9],
        description="Number of full days at the destination.",
    )
    budget_usd: float = Field(
        ...,
        gt=0,
        examples=[3000],
        description="Total per-person budget in USD, including flights.",
    )
    travelers: int = Field(
        default=1,
        ge=1,
        le=20,
        examples=[2],
        description="Number of travelers.",
    )
    preferences: Optional[str] = Field(
        default=None,
        examples=["vegetarian food, avoid crowded tourist spots, prefer walking"],
        description="Free-text preferences, dietary restrictions, travel style.",
    )


# ---------------------------------------------------------------------------
# Response — per-agent status update
# ---------------------------------------------------------------------------

class AgentUpdate(BaseModel):
    """Lightweight status message produced by a single CrewAI agent."""

    agent: str
    status: str  # "running" | "done" | "error"
    message: str
    output: Optional[str] = None   # full agent task output when done


# ---------------------------------------------------------------------------
# Response — full trip plan
# ---------------------------------------------------------------------------

class TripPlan(BaseModel):
    """Structured fields extracted from the crew output."""

    destination: str
    duration_days: int
    budget_usd: float
    travelers: int
    raw_output: str = Field(
        ..., description="Full concatenated output from the CrewAI crew."
    )
    # Per-agent outputs stored separately for the frontend tabs
    research_output: str = ""
    itinerary_output: str = ""
    budget_output: str = ""
    local_output: str = ""


class TripPlanResponse(BaseModel):
    """Top-level API response for /api/trip/plan."""

    success: bool = True
    agent_updates: list[AgentUpdate]
    plan: TripPlan


# ---------------------------------------------------------------------------
# SSE streaming event
# ---------------------------------------------------------------------------

class StreamEvent(BaseModel):
    """
    Single Server-Sent Event payload.

    type:
      "agent_start"    — agent has begun its task
      "agent_done"     — agent finished; output field populated
      "plan_complete"  — all agents done; plan field populated
      "error"          — pipeline failed; detail field populated
    """
    type: str
    agent: Optional[str] = None
    status: Optional[str] = None
    message: Optional[str] = None
    output: Optional[str] = None
    plan: Optional[TripPlan] = None
    detail: Optional[str] = None
