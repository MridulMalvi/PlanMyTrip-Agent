"""
Tavily web-search tool for CrewAI agents.

The tool wraps the Tavily Search API and exposes it as a @tool-decorated
callable so any CrewAI agent can add it to its tool list.
"""
import logging
import os
from typing import Optional

from crewai.tools import tool

logger = logging.getLogger(__name__)


@tool("Web Search")
def tavily_search(query: str) -> str:
    """
    Search the web for up-to-date travel information.

    Use this tool to look up:
    - Current flight prices and routes
    - Hotel options, prices, and reviews
    - Tourist attractions, opening hours, and entry fees
    - Local restaurants and dining recommendations
    - Hidden gems and off-the-beaten-path experiences
    - Practical travel tips (visas, currency, safety, weather)

    Args:
        query: A clear, specific search query string.

    Returns:
        A text summary of the most relevant search results.
    """
    api_key: Optional[str] = os.getenv("TAVILY_API_KEY")

    if not api_key:
        logger.warning("TAVILY_API_KEY not set — returning mock search results.")
        return _mock_search(query)

    try:
        from tavily import TavilyClient  # type: ignore

        client = TavilyClient(api_key=api_key)
        response = client.search(
            query=query,
            search_depth="advanced",
            max_results=5,
            include_answer=True,
        )

        # Build a readable summary from the response
        parts: list[str] = []

        # Direct answer if available
        if response.get("answer"):
            parts.append(f"Summary: {response['answer']}\n")

        # Individual results
        for i, result in enumerate(response.get("results", []), 1):
            title = result.get("title", "Untitled")
            content = result.get("content", "")
            url = result.get("url", "")
            parts.append(f"[{i}] {title}\n{content}\nSource: {url}\n")

        return "\n".join(parts) if parts else "No results found."

    except Exception as exc:  # noqa: BLE001
        logger.error("Tavily search failed for query %r: %s", query, exc)
        return f"Search failed: {exc}. Please try a different query."


def _mock_search(query: str) -> str:
    """Return placeholder results when no API key is configured."""
    return (
        f"[MOCK] Search results for: '{query}'\n\n"
        "Note: Set TAVILY_API_KEY in your .env file for real search results.\n\n"
        "Sample result 1: Popular option with excellent reviews, ~$150/night.\n"
        "Sample result 2: Budget-friendly alternative, ~$80/night.\n"
        "Sample result 3: Premium option with great location, ~$220/night.\n"
    )
