"""A readable "browser on OS" description of a user-agent string, for alerts and the audit trail."""

import re

_BROWSERS = (
    ("Edge", re.compile(r"Edg(?:e|A|iOS)?/")),
    ("Opera", re.compile(r"OPR/|Opera")),
    ("Samsung Internet", re.compile(r"SamsungBrowser/")),
    ("Chrome", re.compile(r"Chrome/|CriOS/")),
    ("Firefox", re.compile(r"Firefox/|FxiOS/")),
    ("Safari", re.compile(r"Version/[\d.]+.*Safari/")),
)
_SYSTEMS = (
    ("iPhone", re.compile(r"iPhone")),
    ("iPad", re.compile(r"iPad")),
    ("Android", re.compile(r"Android")),
    ("Windows", re.compile(r"Windows NT")),
    ("macOS", re.compile(r"Mac OS X|Macintosh")),
    ("ChromeOS", re.compile(r"CrOS")),
    ("Linux", re.compile(r"Linux")),
)


def describe_user_agent(user_agent):
    """e.g. "Chrome on Windows"; "" when the string is empty."""
    text = user_agent or ""
    if not text.strip():
        return ""
    browser = next((name for name, pattern in _BROWSERS if pattern.search(text)), "")
    system = next((name for name, pattern in _SYSTEMS if pattern.search(text)), "")
    if browser and system:
        return f"{browser} on {system}"
    return browser or system or "an unrecognised device"
