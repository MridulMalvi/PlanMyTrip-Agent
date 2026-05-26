"""
Optimization Agent — minimizes travel time and maximizes experiences.

This agent takes raw research output from the Planning Agent and crafts
a geographically logical, time-efficient day-by-day itinerary by checking
distances between attractions and grouping nearby stops.
"""
import logging
from typing import Union
from crewai import Agent

from tools.maps_tool import google_maps_distance

logger = logging.getLogger(__name__)


def build_optimization_agent(llm: Union[str, object]) -> Agent:
    """
    Build and return the Optimization Agent.

    Args:
        llm: The language model instance to power this agent.

    Returns:
        A fully configured CrewAI Agent ready for task assignment.
    """
    logger.info("Building Optimization Agent")

    return Agent(
        role="Itinerary Route Optimizer",
        goal=(
            "Transform the researched travel options into a seamless day-by-day itinerary "
            "that minimises wasted transit time, logically groups geographically nearby "
            "activities, and ensures each day flows naturally from morning through evening. "
            "Every day should feel energising and achievable — not rushed or scattered."
        ),
        backstory=(
            "You are a master travel logistics strategist who has optimized itineraries "
            "for thousands of travellers worldwide. You think in terms of neighbourhoods "
            "and transit corridors: you know that the smartest itinerary isn't just a list "
            "of great places — it's about moving between them with minimum friction. "
            "You use real map distances and transit times to validate each day's plan, "
            "ensuring attractions that are close together are scheduled on the same day. "
            "You structure every day as Morning / Afternoon / Evening with realistic time "
            "allocations (e.g. major museums need 3 hours, not 1). You always include "
            "buffer time for meals, rest, and spontaneous exploration. Your itineraries "
            "feel like they were crafted by a local friend, not a generic travel brochure."
        ),
        tools=[google_maps_distance],
        llm=llm,
        verbose=True,
        memory=True,
        max_iter=10,
        allow_delegation=False,
    )
