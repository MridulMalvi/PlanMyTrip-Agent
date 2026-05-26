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

    handler = logging.StreamHandler(sys.stdout)
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
