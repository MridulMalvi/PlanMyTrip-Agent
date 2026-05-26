"""
API routes for the TravelAgent AI backend.
Includes both blocking and Server-Sent Events (SSE) streaming endpoints.
"""
import json
import logging
from typing import AsyncGenerator

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse

from api.schemas import TripRequest, TripPlanResponse, AgentUpdate, TripPlan, StreamEvent
from core.config import Settings, get_settings
from crew import build_crew, build_crew_streaming

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["Trip Planning"])


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@router.get("/health")
async def health_check():
    """Simple liveness check."""
    return {"status": "ok", "service": "TravelAgent AI"}


# ---------------------------------------------------------------------------
# Blocking endpoint (kept for compatibility / Swagger testing)
# ---------------------------------------------------------------------------

@router.post(
    "/trip/plan",
    response_model=TripPlanResponse,
    summary="Generate a full AI-powered trip plan (blocking)",
)
async def plan_trip(
    request: TripRequest,
    settings: Settings = Depends(get_settings),
) -> TripPlanResponse:
    logger.info("Blocking plan request: %s", request.destination)

    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY not configured.")

    try:
        result = build_crew(request, settings)
        return TripPlanResponse(
            success=True,
            agent_updates=[AgentUpdate(**u) for u in result["agent_updates"]],
            plan=TripPlan(**result["plan"]),
        )
    except Exception as exc:
        logger.exception("Crew failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Streaming SSE endpoint  — POST /api/trip/plan/stream
# ---------------------------------------------------------------------------

def _sse(event: StreamEvent) -> str:
    """Format a StreamEvent as a Server-Sent Event string."""
    return f"data: {event.model_dump_json()}\n\n"


async def _stream_plan(
    request: TripRequest,
    settings: Settings,
) -> AsyncGenerator[str, None]:
    """
    Async generator that runs the crew in a thread and yields SSE strings
    for each agent completion event, then a final plan_complete event.
    """
    import asyncio
    import concurrent.futures

    queue: asyncio.Queue[StreamEvent | None] = asyncio.Queue()
    loop = asyncio.get_event_loop()

    def callback(agent_name: str, status: str, message: str, output: str):
        """Called from worker thread — put event onto the async queue."""
        event = StreamEvent(
            type="agent_start" if status == "running" else "agent_done",
            agent=agent_name,
            status=status,
            message=message,
            output=output if status == "done" else None,
        )
        loop.call_soon_threadsafe(queue.put_nowait, event)

    def run_crew():
        try:
            plan_dict = build_crew_streaming(request, settings, callback)
            plan = TripPlan(**plan_dict)
            done_event = StreamEvent(type="plan_complete", plan=plan)
            loop.call_soon_threadsafe(queue.put_nowait, done_event)
        except Exception as exc:
            error_event = StreamEvent(type="error", detail=str(exc))
            loop.call_soon_threadsafe(queue.put_nowait, error_event)
        finally:
            loop.call_soon_threadsafe(queue.put_nowait, None)  # sentinel

    executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
    loop.run_in_executor(executor, run_crew)

    while True:
        event = await queue.get()
        if event is None:
            break
        yield _sse(event)
        if event.type in ("plan_complete", "error"):
            break


@router.post(
    "/trip/plan/stream",
    summary="Generate a trip plan with real-time SSE streaming",
    description=(
        "Returns a Server-Sent Events stream. Each event is a JSON payload with "
        "`type` = 'agent_start' | 'agent_done' | 'plan_complete' | 'error'."
    ),
)
async def plan_trip_stream(
    request: TripRequest,
    settings: Settings = Depends(get_settings),
):
    logger.info("Streaming plan request: %s", request.destination)

    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY not configured.")

    return StreamingResponse(
        _stream_plan(request, settings),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
