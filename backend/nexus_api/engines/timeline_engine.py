"""
Rule Timeline Engine.
Tracks simulated rule version history and correlates with outcome metrics.
"""
from typing import Dict, List, Any
import datetime


# Synthetic rule change history (version timeline)
RULE_TIMELINE_EVENTS = [
    {"version": "v2.1.0", "date": "2025-11-01", "author": "J. Smith",
     "rule": "Rule 7", "change": "Added CMRA hard-stop logic", "type": "NEW",
     "impact": "NEGATIVE", "approval_delta": -3.2},
    {"version": "v2.1.1", "date": "2025-11-08", "author": "A. Patel",
     "rule": "Rule 8", "change": "PBSA threshold tightened from 0.5→0.3", "type": "THRESHOLD",
     "impact": "NEGATIVE", "approval_delta": -2.1},
    {"version": "v2.2.0", "date": "2025-11-15", "author": "M. Chen",
     "rule": "Rule 0", "change": "Clean path now sends to PDMA v3", "type": "UPGRADE",
     "impact": "POSITIVE", "approval_delta": +1.8},
    {"version": "v2.2.1", "date": "2025-11-20", "author": "J. Smith",
     "rule": "Rule 6", "change": "Comm error timeout reduced from 30s→10s", "type": "THRESHOLD",
     "impact": "NEUTRAL", "approval_delta": 0.0},
    {"version": "v2.3.0", "date": "2025-11-25", "author": "D. Kumar",
     "rule": "Rule 9", "change": "POBox detection enhanced — P-code added", "type": "ENHANCEMENT",
     "impact": "NEGATIVE", "approval_delta": -1.4},
    {"version": "v2.3.1", "date": "2025-12-01", "author": "A. Patel",
     "rule": "Rule 3", "change": "KOEC0039 sub-code X escalated to hard stop", "type": "ESCALATION",
     "impact": "NEGATIVE", "approval_delta": -0.8},
    {"version": "v2.3.2", "date": "2025-12-05", "author": "M. Chen",
     "rule": "Rule 5", "change": "KOEC0039 non-X routed through PDMA", "type": "FLOW",
     "impact": "POSITIVE", "approval_delta": +0.5},
    {"version": "v2.4.0", "date": "2025-12-10", "author": "L. Torres",
     "rule": "populateResult()", "change": "NO_RESULT + PDMA compliant = COMPLIANT (#15 open)", "type": "BUG",
     "impact": "NEGATIVE", "approval_delta": -0.3},
]


def get_rule_timeline(transactions: List[Dict]) -> List[Dict[str, Any]]:
    """Return timeline events with actual approval rate data at each checkpoint."""
    # Compute rolling approval rates from transaction data
    date_rates = _compute_daily_rates(transactions)

    result = []
    for event in RULE_TIMELINE_EVENTS:
        date = event["date"]
        rate_before = _find_rate_near(date_rates, date, offset_days=-3)
        rate_after  = _find_rate_near(date_rates, date, offset_days=3)
        actual_delta = round((rate_after - rate_before) * 100, 2) if rate_before is not None and rate_after is not None else event["approval_delta"]

        result.append({
            **event,
            "rate_before":    round(rate_before * 100, 1) if rate_before is not None else None,
            "rate_after":     round(rate_after * 100, 1) if rate_after is not None else None,
            "actual_delta":   actual_delta,
            "is_harmful":     event["impact"] == "NEGATIVE",
        })
    return result


def get_approval_trend_annotated(transactions: List[Dict]) -> List[Dict[str, Any]]:
    """Daily approval rate with version annotations."""
    daily = _compute_daily_rates(transactions)
    event_dates = {e["date"]: e for e in RULE_TIMELINE_EVENTS}

    result = []
    for date, rate in sorted(daily.items()):
        entry: Dict[str, Any] = {
            "date":  date,
            "rate":  round(rate * 100, 2),
            "event": event_dates.get(date),
        }
        result.append(entry)
    return result


def _compute_daily_rates(transactions: List[Dict]) -> Dict[str, float]:
    by_date: Dict[str, List[int]] = {}
    for tx in transactions:
        d = tx["event_date"]
        if d not in by_date:
            by_date[d] = [0, 0]
        by_date[d][1] += 1
        if tx["final_result"] == "IDENTITY_VERIFIED":
            by_date[d][0] += 1
    return {d: v[0] / max(v[1], 1) for d, v in by_date.items()}


def _find_rate_near(rates: Dict[str, float], date_str: str, offset_days: int) -> float | None:
    try:
        d = datetime.date.fromisoformat(date_str) + datetime.timedelta(days=offset_days)
        for i in range(5):
            candidate = (d + datetime.timedelta(days=i)).isoformat()
            if candidate in rates:
                return rates[candidate]
            candidate = (d - datetime.timedelta(days=i)).isoformat()
            if candidate in rates:
                return rates[candidate]
    except Exception:
        pass
    return None
