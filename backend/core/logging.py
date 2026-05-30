"""
Structured logging configuration for the TravelAgent AI backend.
"""
import logging
import sys


def setup_logging(debug: bool = False) -> logging.Logger:
    """
    Configure root logger with clean, readable output.
    Returns the application-level logger.
    """
    level = logging.DEBUG if debug else logging.INFO

    formatter = logging.Formatter(
        fmt="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # Force UTF-8 so emoji in CrewAI logs don't crash on Windows (cp1252)
    import io
    utf8_stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    handler = logging.StreamHandler(utf8_stdout)
    handler.setFormatter(formatter)

    # Root logger
    root = logging.getLogger()
    root.setLevel(level)
    if not root.handlers:
        root.addHandler(handler)

    # Quieten noisy third-party loggers
    for noisy in ("httpx", "httpcore", "openai", "urllib3"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    logger = logging.getLogger("travelagent")
    logger.info("Logging initialised (debug=%s)", debug)
    return logger
