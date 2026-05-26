"""
Google Maps Distance Matrix tool for CrewAI agents.

Calculates travel times and distances between locations to help the
Optimization Agent create geographically efficient itineraries.
Falls back to a mock response when no API key is configured.
"""
import logging
import os
from typing import Optional
from urllib.parse import quote

import httpx
from crewai.tools import tool

logger = logging.getLogger(__name__)

MAPS_DISTANCE_URL = "https://maps.googleapis.com/maps/api/distancematrix/json"


@tool("Maps Distance Calculator")
def google_maps_distance(origins: str, destinations: str, mode: str = "transit") -> str:
    """
    Calculate travel time and distance between locations using Google Maps.

    Use this tool when building a day-by-day itinerary to:
    - Check how far apart two attractions are
    - Estimate transit / walking / driving time between stops
    - Identify which activities are close together (to minimise travel)
    - Validate that a day's plan is realistic time-wise

    Args:
        origins: Starting location(s), e.g. "Eiffel Tower, Paris" or pipe-separated
                 list of multiple origins "Louvre Museum, Paris|Notre-Dame Cathedral, Paris"
        destinations: Destination(s), same format as origins.
        mode: Travel mode — one of "transit", "walking", "driving", "bicycling".
              Default is "transit" (best for city tourism).

    Returns:
        Formatted string with distance and travel-time information.
    """
    api_key: Optional[str] = os.getenv("GOOGLE_MAPS_API_KEY")

    if not api_key:
        logger.warning("GOOGLE_MAPS_API_KEY not set — returning mock distance estimate.")
        return _mock_distance(origins, destinations, mode)

    try:
        params = {
            "origins": origins,
            "destinations": destinations,
            "mode": mode,
            "key": api_key,
            "units": "metric",
        }

        with httpx.Client(timeout=10) as client:
            response = client.get(MAPS_DISTANCE_URL, params=params)
            response.raise_for_status()
            data = response.json()

        if data.get("status") != "OK":
            error_msg = data.get("error_message", data.get("status", "Unknown error"))
            return f"Maps API error: {error_msg}"

        # Parse and format the matrix
        origin_addresses = data.get("origin_addresses", [])
        dest_addresses = data.get("destination_addresses", [])
        rows = data.get("rows", [])

        lines: list[str] = []
        lines.append(f"Travel mode: {mode.upper()}\n")

        for i, row in enumerate(rows):
            origin_label = origin_addresses[i] if i < len(origin_addresses) else f"Origin {i+1}"
            for j, element in enumerate(row.get("elements", [])):
                dest_label = dest_addresses[j] if j < len(dest_addresses) else f"Destination {j+1}"
                status = element.get("status", "UNKNOWN")

                if status == "OK":
                    distance = element["distance"]["text"]
                    duration = element["duration"]["text"]
                    lines.append(
                        f"From: {origin_label}\n"
                        f"To:   {dest_label}\n"
                        f"  Distance: {distance}\n"
                        f"  Travel time ({mode}): {duration}\n"
                    )
                else:
                    lines.append(
                        f"From: {origin_label} → To: {dest_label}: {status}\n"
                    )

        return "\n".join(lines)

    except httpx.HTTPError as exc:
        logger.error("Maps API HTTP error: %s", exc)
        return f"Maps API request failed: {exc}. Using estimated times instead."
    except Exception as exc:  # noqa: BLE001
        logger.error("Unexpected Maps tool error: %s", exc)
        return f"Maps tool error: {exc}"


def _mock_distance(origins: str, destinations: str, mode: str) -> str:
    """Return plausible placeholder distances when no API key is configured."""
    return (
        f"[MOCK] Travel estimate: {origins!r} → {destinations!r} via {mode}\n\n"
        "Note: Set GOOGLE_MAPS_API_KEY in your .env for real distances.\n\n"
        "Estimated travel time: 15–25 minutes by transit/taxi.\n"
        "Estimated distance: 2–5 km.\n"
        "Tip: Group attractions in the same neighbourhood to minimize transit time.\n"
    )
