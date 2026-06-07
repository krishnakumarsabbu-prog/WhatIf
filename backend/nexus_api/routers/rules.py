"""Rule intelligence router."""
from fastapi import APIRouter
from ..database import query
from ..engines.rule_engine import (
    compute_rule_stats, compute_feature_importance,
    compute_outcome_funnel, compute_rule_trend
)

router = APIRouter()


@router.get("/stats")
def rule_stats():
    txs = query("SELECT * FROM transactions")
    return compute_rule_stats(txs)


@router.get("/feature-importance")
def feature_importance():
    txs = query("SELECT * FROM transactions")
    return compute_feature_importance(txs)


@router.get("/outcome-funnel")
def outcome_funnel():
    txs = query("SELECT * FROM transactions")
    return compute_outcome_funnel(txs)


@router.get("/trend/{rule}")
def rule_trend(rule: str):
    txs = query("SELECT * FROM transactions")
    return compute_rule_trend(txs, rule)
