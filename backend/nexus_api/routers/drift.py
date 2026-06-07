"""Drift detection router."""
from fastapi import APIRouter
from typing import Optional

from ..database import query
from ..engines.drift_engine import (
    compute_drift_report, compute_drift_heatmap,
    compute_page_hinkley, compute_drift_timeline
)

router = APIRouter()


@router.get("/report")
def drift_report():
    txs = query("SELECT * FROM transactions")
    return compute_drift_report(txs)


@router.get("/heatmap")
def drift_heatmap():
    txs = query("SELECT * FROM transactions")
    return compute_drift_heatmap(txs)


@router.get("/page-hinkley")
def page_hinkley():
    txs = query("SELECT * FROM transactions")
    return compute_page_hinkley(txs)


@router.get("/timeline/{variable}")
def drift_timeline(variable: str):
    txs = query("SELECT * FROM transactions")
    return compute_drift_timeline(txs, variable)
