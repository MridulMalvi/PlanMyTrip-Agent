"""
Integration tests for the /api/trip/plan route.

These tests use FastAPI's TestClient and mock out the `build_crew`
function to avoid real LLM or external API calls.
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


# ---------------------------------------------------------------------------
# Trip planning endpoint
# ---------------------------------------------------------------------------

SAMPLE_REQUEST = {
    "destination": "Tokyo, Japan",
    "start_date": "2025-09-01",
    "end_date": "2025-09-08",
    "duration_days": 7,
    "budget_usd": 3000,
    "travelers": 2,
    "preferences": "vegetarian food, art museums, avoid crowds",
}

MOCK_CREW_RESULT = {
    "agent_updates": [
        {"agent": "Planning Agent",     "status": "done", "message": "Research complete."},
        {"agent": "Optimization Agent", "status": "done", "message": "Itinerary created."},
        {"agent": "Budget Agent",       "status": "done", "message": "Budget analysed."},
        {"agent": "Local Expert Agent", "status": "done", "message": "Tips added."},
    ],
    "plan": {
        "destination": "Tokyo, Japan",
        "duration_days": 7,
        "budget_usd": 3000,
        "travelers": 2,
        "raw_output": "Mock crew output for Tokyo trip.",
    },
}


@patch("api.routes.get_settings")
@patch("api.routes.build_crew", return_value=MOCK_CREW_RESULT)
def test_plan_trip_success(mock_build_crew, mock_get_settings):
    mock_settings = MagicMock()
    mock_settings.openai_api_key = "sk-test-key"
    mock_get_settings.return_value = mock_settings

    response = client.post("/api/trip/plan", json=SAMPLE_REQUEST)

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert len(body["agent_updates"]) == 4
    assert body["plan"]["destination"] == "Tokyo, Japan"
    mock_build_crew.assert_called_once()


@patch("api.routes.get_settings")
def test_plan_trip_missing_api_key(mock_get_settings):
    mock_settings = MagicMock()
    mock_settings.openai_api_key = ""  # Missing key
    mock_get_settings.return_value = mock_settings

    response = client.post("/api/trip/plan", json=SAMPLE_REQUEST)

    assert response.status_code == 503
    assert "OPENAI_API_KEY" in response.json()["detail"]


def test_plan_trip_invalid_payload():
    """Missing required fields should return 422."""
    response = client.post("/api/trip/plan", json={"destination": "Paris"})
    assert response.status_code == 422


def test_plan_trip_negative_budget():
    """Budget must be > 0."""
    bad_request = {**SAMPLE_REQUEST, "budget_usd": -500}
    response = client.post("/api/trip/plan", json=bad_request)
    assert response.status_code == 422
