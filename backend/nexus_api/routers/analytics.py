"""Analytics router — KPIs, Sankey, Bayesian, SHAP."""
from fastapi import APIRouter
from typing import Optional

from ..database import query
from ..engines.sankey_engine import compute_sankey
from ..engines.bayesian_engine import (
    query_posterior, compute_mutual_information, compute_cpt, NETWORK_EDGES, NODE_LABELS
)
from ..engines.rule_engine import compute_feature_importance, compute_outcome_funnel
from ..engines.shap_engine import compute_global_shap, explain_transaction
from ..models.domain import EvidenceMap

router = APIRouter()


def _get_transactions(date_from: Optional[str] = None, date_to: Optional[str] = None):
    if date_from and date_to:
        return query("SELECT * FROM transactions WHERE event_date BETWEEN ? AND ?", (date_from, date_to))
    return query("SELECT * FROM transactions")


@router.get("/kpis")
def get_kpis(date_from: Optional[str] = None, date_to: Optional[str] = None):
    txs      = _get_transactions(date_from, date_to)
    total    = len(txs)
    verified = sum(1 for t in txs if t["final_result"] == "IDENTITY_VERIFIED")
    declined = sum(1 for t in txs if t["final_result"] == "IDENTITY_NOT_VERIFIED")

    # Build 7-day trend
    from collections import defaultdict
    by_date = defaultdict(lambda: {"total": 0, "verified": 0})
    for tx in txs:
        by_date[tx["event_date"]]["total"] += 1
        if tx["final_result"] == "IDENTITY_VERIFIED":
            by_date[tx["event_date"]]["verified"] += 1
    trend = [{"date": d, "rate": round(v["verified"] / max(v["total"], 1) * 100, 1)}
             for d, v in sorted(by_date.items())][-7:]

    # Drift alert count (PSI > 0.20)
    from ..engines.drift_engine import compute_drift_report
    drift = compute_drift_report(txs)
    alerts = sum(1 for d in drift if d["alert"])

    return {
        "total":            total,
        "verified_count":   verified,
        "declined_count":   declined,
        "verified_rate":    round(verified / max(total, 1) * 100, 2),
        "declined_rate":    round(declined / max(total, 1) * 100, 2),
        "drift_alert_count": alerts,
        "trend_7d":         trend,
    }


@router.get("/decline-breakdown")
def get_decline_breakdown(date_from: Optional[str] = None, date_to: Optional[str] = None):
    txs = _get_transactions(date_from, date_to)
    from collections import Counter
    counts: Counter = Counter()
    for tx in txs:
        if tx["final_result"] != "IDENTITY_VERIFIED":
            for r in tx["rules_fired"].split(","):
                r = r.strip()
                if r:
                    counts[r] += 1
    total = sum(counts.values()) or 1
    return [{"rule": r, "count": c, "pct": round(c / total * 100, 1)}
            for r, c in counts.most_common(10)]


@router.get("/service-health")
def get_service_health(date_from: Optional[str] = None, date_to: Optional[str] = None):
    txs = _get_transactions(date_from, date_to)
    n = max(len(txs), 1)
    return [
        {"service": "Doc Verify",  "pass_rate": round(sum(1 for t in txs if t["doc_result"] == "IDENTITY_DOCUMENT_VALIDATED") / n * 100, 1), "status": "ok"},
        {"service": "Face Scan",   "pass_rate": round(sum(1 for t in txs if t["face_result"] == "VALIDATED") / n * 100, 1), "status": "ok"},
        {"service": "GSA Check",   "pass_rate": round(sum(1 for t in txs if not (t["cmra_flag"] or t["pbsa_flag"] or t["pobox_flag"] or t["comm_error"])) / n * 100, 1), "status": "ok"},
        {"service": "PDMA Check",  "pass_rate": round(sum(1 for t in txs if t["pdma_result"] == "ADDRESS_CIP_COMPLIANT") / max(sum(1 for t in txs if t["pdma_result"] is not None), 1) * 100, 1), "status": "ok"},
        {"service": "Risk Eval",   "pass_rate": round(sum(1 for t in txs if t["risk_result"] == "ALLOW") / max(sum(1 for t in txs if t["risk_result"] is not None), 1) * 100, 1), "status": "ok"},
    ]


@router.get("/verification-trend")
def get_verification_trend(date_from: Optional[str] = None, date_to: Optional[str] = None):
    txs = _get_transactions(date_from, date_to)
    from collections import defaultdict
    by_date = defaultdict(lambda: {"total": 0, "verified": 0})
    for tx in txs:
        by_date[tx["event_date"]]["total"] += 1
        if tx["final_result"] == "IDENTITY_VERIFIED":
            by_date[tx["event_date"]]["verified"] += 1
    return [{"date": d, "rate": round(v["verified"] / max(v["total"], 1) * 100, 2), "total": v["total"]}
            for d, v in sorted(by_date.items())]


@router.get("/sankey")
def get_sankey(date_from: Optional[str] = None, date_to: Optional[str] = None):
    txs = _get_transactions(date_from, date_to)
    return compute_sankey(txs)


@router.get("/live-events")
def get_live_events(limit: int = 50):
    txs = query("SELECT * FROM transactions ORDER BY event_date DESC, id DESC LIMIT ?", (limit,))
    return txs


@router.post("/bayesian/query")
def bayesian_query(evidence: EvidenceMap):
    txs = query("SELECT * FROM transactions")
    ev  = {k: v for k, v in evidence.model_dump().items() if v is not None}
    return query_posterior(txs, ev)


@router.get("/bayesian/mutual-information")
def bayesian_mi():
    txs = query("SELECT * FROM transactions")
    return compute_mutual_information(txs)


@router.get("/bayesian/cpt/{node}")
def bayesian_cpt(node: str):
    txs = query("SELECT * FROM transactions")
    return compute_cpt(txs, node)


@router.get("/bayesian/network")
def bayesian_network():
    return {"edges": [{"source": s, "target": t} for s, t in NETWORK_EDGES], "labels": NODE_LABELS}


@router.get("/shap/global")
def shap_global(date_from: Optional[str] = None, date_to: Optional[str] = None):
    txs = _get_transactions(date_from, date_to)
    return compute_global_shap(txs)


@router.get("/shap/transaction/{tx_id}")
def shap_transaction(tx_id: str):
    tx  = query("SELECT * FROM transactions WHERE id = ?", (tx_id,))
    all_txs = query("SELECT * FROM transactions")
    if not tx:
        from fastapi import HTTPException
        raise HTTPException(404, f"Transaction {tx_id} not found")
    return explain_transaction(tx[0], all_txs)


@router.get("/feature-importance")
def feature_importance():
    txs = query("SELECT * FROM transactions")
    return compute_feature_importance(txs)


@router.get("/outcome-funnel")
def outcome_funnel():
    txs = query("SELECT * FROM transactions")
    return compute_outcome_funnel(txs)
