"""
Crew orchestrator — wires all four agents and their tasks together.

This module is the bridge between the backend/agents package and the
root-level crew.py, exposing the same `build_crew` interface so it
can be imported from either location.
"""
import sys
import os

# Ensure the project root (one level above backend/) is on sys.path so that
# the root-level crew.py can be found regardless of working directory.
_HERE = os.path.dirname(os.path.abspath(__file__))
_BACKEND = os.path.dirname(_HERE)            # .../backend
_ROOT = os.path.dirname(_BACKEND)            # .../Travel Agent
for _path in (_BACKEND, _ROOT):
    if _path not in sys.path:
        sys.path.insert(0, _path)

# Re-export build_crew from the canonical root location
from crew import build_crew  # noqa: E402, F401  (root crew.py)

__all__ = ["build_crew"]
