"""
Unit tests for the four CrewAI agents.

These tests validate that each agent can be built (instantiated) correctly
and that key configuration properties are set as expected.

CrewAI validates the `llm` field as either a model-name string or a BaseLLM
instance, so tests pass the model name as a string (no real API calls needed
for agent construction).
"""
import sys
import os

# Patch path so imports resolve from backend/
_BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
_ROOT = os.path.abspath(os.path.join(_BACKEND, ".."))
for _p in (_BACKEND, _ROOT):
    if _p not in sys.path:
        sys.path.insert(0, _p)

import pytest
from crewai import Agent


# CrewAI accepts a model-name string as the `llm` argument.
# This avoids real API calls while satisfying Pydantic validation.
MOCK_MODEL = "gpt-4o"


# ---------------------------------------------------------------------------
# Planning Agent
# ---------------------------------------------------------------------------

def test_planning_agent_builds():
    from agents.planning_agent import build_planning_agent

    agent = build_planning_agent(MOCK_MODEL)

    assert isinstance(agent, Agent)
    assert agent.role  # non-empty role
    assert agent.goal
    assert agent.backstory
    assert agent.memory  # memory enabled (CrewAI stores this as a Memory object)


def test_planning_agent_has_search_tool():
    from agents.planning_agent import build_planning_agent

    agent = build_planning_agent(MOCK_MODEL)
    tool_names = [t.name for t in agent.tools]
    assert any("search" in name.lower() or "web" in name.lower() for name in tool_names), (
        f"Expected a web search tool, got: {tool_names}"
    )


def test_planning_agent_no_delegation():
    from agents.planning_agent import build_planning_agent

    agent = build_planning_agent(MOCK_MODEL)
    assert agent.allow_delegation is False


# ---------------------------------------------------------------------------
# Optimization Agent
# ---------------------------------------------------------------------------

def test_optimization_agent_builds():
    from agents.optimization_agent import build_optimization_agent

    agent = build_optimization_agent(MOCK_MODEL)

    assert isinstance(agent, Agent)
    assert agent.role
    assert agent.goal
    assert agent.backstory
    assert agent.memory  # memory enabled (CrewAI stores this as a Memory object)


def test_optimization_agent_has_maps_tool():
    from agents.optimization_agent import build_optimization_agent

    agent = build_optimization_agent(MOCK_MODEL)
    tool_names = [t.name for t in agent.tools]
    assert any("map" in name.lower() or "distance" in name.lower() for name in tool_names), (
        f"Expected a maps/distance tool, got: {tool_names}"
    )


def test_optimization_agent_no_delegation():
    from agents.optimization_agent import build_optimization_agent

    agent = build_optimization_agent(MOCK_MODEL)
    assert agent.allow_delegation is False


# ---------------------------------------------------------------------------
# Budget Agent
# ---------------------------------------------------------------------------

def test_budget_agent_builds():
    from agents.budget_agent import build_budget_agent

    agent = build_budget_agent(MOCK_MODEL)

    assert isinstance(agent, Agent)
    assert agent.role
    assert agent.goal
    assert agent.backstory
    assert agent.memory  # memory enabled


def test_budget_agent_has_no_tools():
    """Budget Agent relies on reasoning only — no external tools needed."""
    from agents.budget_agent import build_budget_agent

    agent = build_budget_agent(MOCK_MODEL)
    assert agent.tools == [], f"Expected no tools, got: {agent.tools}"


# ---------------------------------------------------------------------------
# Local Expert Agent
# ---------------------------------------------------------------------------

def test_local_expert_agent_builds():
    from agents.local_expert_agent import build_local_expert_agent

    agent = build_local_expert_agent(MOCK_MODEL)

    assert isinstance(agent, Agent)
    assert agent.role
    assert agent.goal
    assert agent.backstory
    assert agent.memory  # memory enabled


def test_local_expert_agent_has_search_tool():
    from agents.local_expert_agent import build_local_expert_agent

    agent = build_local_expert_agent(MOCK_MODEL)
    tool_names = [t.name for t in agent.tools]
    assert any("search" in name.lower() or "web" in name.lower() for name in tool_names), (
        f"Expected a web search tool, got: {tool_names}"
    )


def test_local_expert_agent_no_delegation():
    from agents.local_expert_agent import build_local_expert_agent

    agent = build_local_expert_agent(MOCK_MODEL)
    assert agent.allow_delegation is False


# ---------------------------------------------------------------------------
# All four agents together (smoke test)
# ---------------------------------------------------------------------------

def test_all_agents_build_without_error():
    """Smoke test: all four agents instantiate cleanly with a model string."""
    from agents.planning_agent import build_planning_agent
    from agents.optimization_agent import build_optimization_agent
    from agents.budget_agent import build_budget_agent
    from agents.local_expert_agent import build_local_expert_agent

    agents = [
        build_planning_agent(MOCK_MODEL),
        build_optimization_agent(MOCK_MODEL),
        build_budget_agent(MOCK_MODEL),
        build_local_expert_agent(MOCK_MODEL),
    ]
    assert len(agents) == 4
    assert all(isinstance(a, Agent) for a in agents)

    for agent in agents:
        assert agent.role, f"Agent has empty role: {agent}"
        assert agent.goal, f"Agent has empty goal: {agent}"
        assert agent.backstory, f"Agent has empty backstory: {agent}"
