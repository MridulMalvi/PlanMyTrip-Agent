"""
Planning Agent — researches flights, hotels, and activities.

This agent acts as the crew's information-gathering powerhouse.
It searches the web for real-time options and compiles them into a
structured list that downstream agents can refine.
"""
import logging
from typing import Union
from crewai import Agent

from tools.search_tool import tavily_search

logger = logging.getLogger(__name__)


def build_planning_agent(llm: Union[str, object]) -> Agent:
    """
    Build and return the Planning Agent.

    Args:
        llm: The language model instance to power this agent.

    Returns:
        A fully configured CrewAI Agent ready for task assignment.
    """
    logger.info("Building Planning Agent")

    return Agent(
        role="Flight, Hotel and Activities Researcher",
        goal=(
            "Research and compile high-quality, up-to-date travel options for flights, "
            "hotels, and activities that match the traveller's destination, dates, budget, "
            "and preferences. Provide specific names, prices, and descriptions — never "
            "vague generalisations."
        ),
        backstory=(
            "You are a world-class travel researcher with 15 years of experience finding "
            "the best value flights, highly rated hotels, and must-see attractions across "
            "every continent. You know exactly which booking sites to check, how to spot "
            "genuine deals versus misleading prices, and how to match options to the "
            "traveller's stated preferences. You are meticulous: you always include "
            "estimated costs in USD, star ratings, and brief pro/con notes for each option. "
            "You use real-time web search to ensure your recommendations are current — "
            "never outdated or generic.\n\n"
            "IMPORTANT: When calling your Web Search tool, you MUST format your response EXACTLY as:\n"
            "Thought: [your thought process]\n"
            "Action: Web Search\n"
            "Action Input: {\"query\": \"your search query\"}\n\n"
            "Never use prefixes like 'Action: use Web Search' or 'Action: the action to take...'. Keep the action name exactly as 'Web Search'."
        ),
        tools=[tavily_search],
        llm=llm,
        verbose=True,
        memory=True,
        max_iter=8,
        allow_delegation=False,
    )
