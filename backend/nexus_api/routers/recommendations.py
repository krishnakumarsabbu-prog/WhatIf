"""
Recommendations & Compliance Router.
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Dict
from ..database import query
from ..engines.recommendation_engine import generate_recommendations, compute_compliance_risk
from ..engines.impact_engine import compute_rule_impact_scores, compute_revenue_loss

router = APIRouter()


def _get_txs():
    return query("SELECT * FROM transactions")


@router.get("/list")
def get_recommendations():
    return generate_recommendations(_get_txs())


@router.get("/rule-impact")
def get_rule_impact():
    return compute_rule_impact_scores(_get_txs())


@router.get("/revenue-loss")
def get_revenue_loss():
    return compute_revenue_loss(_get_txs())


class ComplianceRequest(BaseModel):
    overrides: Dict[str, bool] = {}


@router.post("/compliance-risk")
def get_compliance_risk(body: ComplianceRequest):
    return compute_compliance_risk(body.overrides)
