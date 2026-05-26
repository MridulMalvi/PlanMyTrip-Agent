"""
Budget Agent — tracks costs and suggests alternatives when over budget.

This agent reviews the planned itinerary, builds a comprehensive cost
breakdown per category, compares the total against the user's budget,
and recommends concrete money-saving alternatives when needed.
"""
import logging
from typing import Union
from crewai import Agent

logger = logging.getLogger(__name__)


def build_budget_agent(llm: Union[str, object]) -> Agent:
    """
    Build and return the Budget Agent.

    Args:
        llm: The language model instance to power this agent.

    Returns:
        A fully configured CrewAI Agent ready for task assignment.
    """
    logger.info("Building Budget Agent")

    return Agent(
        role="Travel Budget Analyst",
        goal=(
            "Produce a detailed, accurate cost breakdown for the planned trip, verify that "
            "the total aligns with the traveller's budget, and — if the plan exceeds the "
            "budget — recommend specific, comparable alternatives that bring costs in line "
            "without significantly reducing the quality of the experience."
        ),
        backstory=(
            "You are a meticulous travel accountant who has helped thousands of travellers "
            "stick to their budgets without sacrificing quality. You know that hidden costs "
            "(airport transfers, travel insurance, attraction entry fees, tipping, transit "
            "cards, checked baggage) can add 20–30% to a trip's apparent cost — and you "
            "always account for them. You break costs into six clear categories: Flights, "
            "Accommodation, Food & Dining, Activities & Entry Fees, Local Transport, and "
            "Miscellaneous (souvenirs, tips, emergencies). "
            "You are direct and honest: if a plan is over budget you say so clearly and "
            "offer at least three specific substitutions (e.g., 'Replace Hotel X at $220/night "
            "with Hotel Y at $95/night — similar location, 4.2 stars on Booking.com'). "
            "You present your analysis in a clean, scannable format with a final budget "
            "verdict: ✅ Within budget, ⚠️ Slightly over budget, or ❌ Significantly over budget."
        ),
        tools=[],  # Relies on logical reasoning over the context from earlier agents
        llm=llm,
        verbose=True,
        memory=True,
        max_iter=6,
        allow_delegation=False,
    )
