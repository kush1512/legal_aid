"""Deterministic, source-linked case building from user-authored messages.

This module deliberately avoids LLM-generated facts. Every extracted item retains
an exact quote from a user message; ambiguous dates and inferred legal conclusions
are not promoted to established facts.
"""
from __future__ import annotations

import re
from datetime import datetime
from typing import Any

DATE_PATTERNS = (
    re.compile(r"\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b"),
    re.compile(r"\b(\d{4}-\d{2}-\d{2})\b"),
)
AMOUNT_RE = re.compile(r"(?i)(?:₹|rs\.?\s*)([\d,]+(?:\.\d{1,2})?)")
EVIDENCE_TERMS = {
    "property_real_estate": ["rent agreement", "lease", "receipt", "bank statement", "payment proof", "email", "message", "whatsapp", "notice", "photograph"],
    "digital_fraud_cybercrime": ["bank statement", "upi reference", "transaction id", "sms", "email", "screenshot", "call log", "complaint number"],
    "marriage_family": ["marriage certificate", "court order", "message", "email", "medical record", "photograph"],
    "personal_safety_privacy": ["screenshot", "message", "email", "medical record", "police complaint", "call log"],
}
MISSING_BY_CATEGORY = {
    "property_real_estate": ["Agreement or written terms", "Relevant dates and payment details", "Property location (state/district)", "Proof of payment and communications"],
    "digital_fraud_cybercrime": ["Date and time of transaction", "Amount and transaction/reference ID", "Bank/payment provider contacted", "1930/portal complaint status"],
    "marriage_family": ["Relevant dates and existing court orders", "Documents supporting the account", "Whether anyone is at immediate risk"],
    "personal_safety_privacy": ["Whether there is an immediate safety risk", "Dates and details of incidents", "Available messages/screenshots", "Any complaint or protection order"],
}


def _date_candidates(text: str) -> list[str]:
    found: list[str] = []
    for pattern in DATE_PATTERNS:
        for match in pattern.finditer(text):
            value = match.group(1)
            if value not in found:
                found.append(value)
    return found


def build_case_summary(messages: list[dict[str, Any]], category: str, jurisdiction: dict[str, Any] | None = None) -> dict[str, Any]:
    user_messages = [m for m in messages if m.get("role") == "user" and isinstance(m.get("content"), str)]
    facts: list[dict[str, Any]] = []
    timeline: list[dict[str, Any]] = []
    evidence_mentions: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()

    for message in user_messages:
        content = message["content"]
        created_at = message.get("created_at")
        for date_value in _date_candidates(content):
            key = ("date_mentioned", date_value)
            if key not in seen:
                seen.add(key)
                facts.append({"key": key[0], "value": date_value, "source": "user_provided", "evidence_quote": date_value, "verified": False})
                timeline.append({"date": date_value, "event": "Date mentioned by user; event not yet specified", "source": "user_provided", "evidence_quote": date_value})
        for match in AMOUNT_RE.finditer(content):
            amount = match.group(0)
            key = ("amount_mentioned", amount)
            if key not in seen:
                seen.add(key)
                facts.append({"key": key[0], "value": amount, "source": "user_provided", "evidence_quote": amount, "verified": False})
        for term in EVIDENCE_TERMS.get(category, []):
            match = re.search(re.escape(term), content, re.IGNORECASE)
            if match:
                evidence_mentions.append({"item": term, "status": "mentioned_by_user_not_reviewed", "source": "user_provided", "evidence_quote": match.group(0)})
        if created_at:
            timeline.append({"date": created_at, "event": "User provided additional case information", "source": "message_timestamp", "evidence_quote": None})

    timeline.sort(key=lambda item: (item.get("date") or "9999", item["event"]))
    return {
        "facts": facts,
        "timeline": timeline,
        "evidence": evidence_mentions,
        "missing_information": MISSING_BY_CATEGORY.get(category, ["Relevant dates", "Supporting documents", "Steps already taken"]),
        "jurisdiction": jurisdiction or {"country": "IN"},
        "limitations": [
            "Extracted items are not independently verified.",
            "A mentioned date is not assigned to an event unless the user states that connection.",
            "Evidence is listed as mentioned, not as uploaded or authenticated.",
        ],
    }
