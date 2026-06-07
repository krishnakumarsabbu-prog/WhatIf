"""
Decision Intelligence overview + replay + explain router.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Optional
from ..database import query
from ..engines.replay_engine import replay_transactions, explain_transaction
from ..engines.impact_engine import compute_rule_impact_scores, compute_revenue_loss
from ..engines.recommendation_engine import generate_recommendations
from ..engines.timeline_engine import get_rule_timeline, get_approval_trend_annotated

router = APIRouter()


def _get_txs():
    return query("SELECT * FROM transactions")


# ── Overview ──────────────────────────────────────────────────────────────────
@router.get("/overview")
def get_overview():
    txs = _get_txs()
    total = len(txs)
    verified = sum(1 for t in txs if t["final_result"] == "IDENTITY_VERIFIED")
    declined = total - verified
    approval_rate = round(verified / max(total, 1) * 100, 2)

    impact = compute_rule_impact_scores(txs)
    top_rule = impact[0] if impact else {}
    recs = generate_recommendations(txs)
    top_rec = recs[1] if len(recs) > 1 else (recs[0] if recs else {})

    revenue = compute_revenue_loss(txs)

    return {
        "total":           total,
        "verified":        verified,
        "declined":        declined,
        "approval_rate":   approval_rate,
        "top_harmful_rule": top_rule,
        "top_recommendation": top_rec,
        "revenue_loss_k":  revenue.get("total_revenue_loss_k", 0),
        "rule_impact":     impact[:5],
        "recommendations": recs[:3],
    }


# ── Root Cause ────────────────────────────────────────────────────────────────
@router.get("/root-cause")
def get_root_cause():
    txs = _get_txs()
    total = len(txs)
    declined = sum(1 for t in txs if t["final_result"] != "IDENTITY_VERIFIED")
    impact = compute_rule_impact_scores(txs)

    factors = []
    for rule_data in impact[:6]:
        factors.append({
            "factor":       rule_data["rule"],
            "label":        rule_data["label"],
            "count":        rule_data["declined_count"],
            "pct_of_declined": round(rule_data["declined_count"] / max(declined, 1) * 100, 1),
            "impact_score": rule_data["impact_score"],
            "confidence":   "HIGH" if rule_data["impact_score"] > 3 else ("MEDIUM" if rule_data["impact_score"] > 1 else "LOW"),
        })

    return {
        "total_declined": declined,
        "total":          total,
        "decline_rate":   round(declined / max(total, 1) * 100, 2),
        "factors":        factors,
        "summary":        f"{factors[0]['label'] if factors else 'Unknown'} is the primary driver of approval loss, "
                          f"affecting {factors[0]['pct_of_declined'] if factors else 0}% of all declined transactions.",
    }


# ── Replay ────────────────────────────────────────────────────────────────────
class ReplayRequest(BaseModel):
    overrides: Dict[str, bool] = {}


@router.post("/replay")
def run_replay(body: ReplayRequest):
    return replay_transactions(_get_txs(), body.overrides)


# ── Explain ───────────────────────────────────────────────────────────────────
@router.get("/explain/{tx_id}")
def explain_decline(tx_id: str):
    txs = _get_txs()
    result = explain_transaction(tx_id, txs)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Transaction {tx_id} not found")
    return result


@router.get("/explain-search")
def explain_search(q: str):
    """Search for a transaction by partial ID."""
    txs = _get_txs()
    matches = [t for t in txs if q.upper() in t["id"].upper()][:20]
    return [{"id": t["id"], "date": t["event_date"], "result": t["final_result"],
             "rules_fired": t["rules_fired"]} for t in matches]


# ── Timeline ──────────────────────────────────────────────────────────────────
@router.get("/timeline")
def get_timeline():
    return get_rule_timeline(_get_txs())


@router.get("/timeline/approval-trend")
def get_approval_trend():
    return get_approval_trend_annotated(_get_txs())
