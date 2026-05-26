"""
pytest conftest.py — shared fixtures and sys.path setup for all tests.
"""
import sys
import os

# Ensure `backend/` is on sys.path so all package imports resolve.
_BACKEND = os.path.join(os.path.dirname(__file__), "..")
_ROOT = os.path.join(_BACKEND, "..")
for _p in (_BACKEND, _ROOT):
    _p = os.path.abspath(_p)
    if _p not in sys.path:
        sys.path.insert(0, _p)
