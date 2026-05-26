"""
Application configuration using Pydantic Settings.
Loads values from environment variables and .env file.
"""
from functools import lru_cache
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    app_name: str = Field(default="TravelAgent AI")
    debug: bool = Field(default=False)
    cors_origins: list[str] = Field(default=["http://localhost:3000", "http://localhost:3001"])

    # LLM
    openai_api_key: str = Field(default="")
    openai_model: str = Field(default="gpt-4o")

    # Tools
    tavily_api_key: Optional[str] = Field(default=None)
    google_maps_api_key: Optional[str] = Field(default=None)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached Settings instance — safe to use as FastAPI dependency."""
    return Settings()
