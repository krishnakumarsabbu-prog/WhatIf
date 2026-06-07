"""
Recommendation Engine.
Generates actionable policy recommendations from rule impact and simulation data.
"""
from typing import Dict, List, Any
from .impact_engine import compute_rule_impact_scores, HARD_STOPS, REVENUE_PER_CUSTOMER


RULE_RISK_PROFILES = {
    "Rule 7": {"risk": "MEDIUM", "compliance_note": "CMRA addresses have higher fraud probability. Relaxing requires enhanced PDMA validation."},
    "Rule 8": {"risk": "MEDIUM", "compliance_note": "PBSA addresses may indicate non-residential use. Consider secondary verification."},
    "Rule 9": {"risk": "LOW",    "compliance_note": "POBox addresses are common. Low fraud signal if PDMA compliant."},
    "Rule 6": {"risk": "LOW",    "compliance_note": "Comm errors are transient. Fallthrough with retry is standard practice."},
    "Rule 3": {"risk": "HIGH",   "compliance_note": "KOEC0039+X indicates Group 1 DB unavailability. High risk to relax without alternate verification."},
}


def generate_recommendations(transactions: List[Dict]) -> List[Dict[str, Any]]:
    impact_scores = compute_rule_impact_scores(transactions)

    recs = []
    for rule_impact in impact_scores:
        rule = rule_impact["rule"]
        if not rule_impact["is_hard_stop"] or rule not in RULE_RISK_PROFILES:
            continue

        profile = RULE_RISK_PROFILES[rule]
        gain = rule_impact["counterfactual_gain"]
        pop = rule_impact["affected_count"]
        revenue_k = round(gain * REVENUE_PER_CUSTOMER / 1000, 1)
        impact_score = rule_impact["impact_score"]

        # Approval gain as percentage points
        total = len(transactions)
        approval_gain_pp = round(gain / max(total, 1) * 100, 2)

        confidence = (
            "HIGH"   if impact_score > 3 and profile["risk"] == "LOW" else
            "MEDIUM" if impact_score > 1 else
            "LOW"
        )

        recs.append({
            "id":                   f"REC-{rule.replace(' ', '_')}",
            "rule":                 rule,
            "label":                rule_impact["label"],
            "title":                f"Relax {rule} — Route to PDMA Instead of Hard Stop",
            "description":          f"Currently {pop} transactions ({rule_impact['affected_pct']}% of volume) are hard-stopped by {rule}. "
                                    f"Routing to PDMA instead would recover an estimated {gain} customers.",
            "approval_gain_pp":     approval_gain_pp,
            "recovered_customers":  gain,
            "revenue_gain_k":       revenue_k,
            "risk_level":           profile["risk"],
            "compliance_note":      profile["compliance_note"],
            "confidence":           confidence,
            "impact_score":         impact_score,
            "type":                 "RULE_RELAX",
            "priority":             1 if profile["risk"] == "LOW" else (2 if profile["risk"] == "MEDIUM" else 3),
        })

    # Add a composite recommendation
    total = len(transactions)
    verified = sum(1 for t in transactions if t["final_result"] == "IDENTITY_VERIFIED")
    low_risk_recs = [r for r in recs if r["risk_level"] == "LOW"]
    if low_risk_recs:
        total_gain = sum(r["recovered_customers"] for r in low_risk_recs)
        total_rev = sum(r["revenue_gain_k"] for r in low_risk_recs)
        recs.insert(0, {
            "id":                   "REC-COMPOSITE",
            "rule":                 "COMPOSITE",
            "label":                "Low-Risk Bundle",
            "title":                "Implement All Low-Risk Rule Relaxations",
            "description":          f"Bundling all {len(low_risk_recs)} low-risk rule relaxations would recover "
                                    f"~{total_gain} customers and add ${total_rev}K ARR with minimal compliance risk.",
            "approval_gain_pp":     round(total_gain / max(total, 1) * 100, 2),
            "recovered_customers":  total_gain,
            "revenue_gain_k":       total_rev,
            "risk_level":           "LOW",
            "compliance_note":      "Bundle requires simultaneous activation. Test in staging environment first.",
            "confidence":           "MEDIUM",
            "impact_score":         sum(r["impact_score"] for r in low_risk_recs),
            "type":                 "BUNDLE",
            "priority":             0,
        })

    return sorted(recs, key=lambda x: (x["priority"], -x["approval_gain_pp"]))


def compute_compliance_risk(overrides: Dict[str, bool]) -> Dict[str, Any]:
    """Compute compliance risk score for a set of rule overrides."""
    risk_weights = {
        "rule_7_cmra_continue":  40,
        "rule_8_pbsa_continue":  35,
        "rule_9_pobox_continue": 15,
        "rule_6_fallthrough":    10,
        "rule_3_fallthrough":    55,
        "populate_result_relax": 20,
    }
    total_risk = 0
    active = []
    for key, enabled in overrides.items():
        if enabled and key in risk_weights:
            total_risk += risk_weights[key]
            active.append(key)

    # Cap at 100
    risk_score = min(total_risk, 100)
    category = "LOW" if risk_score < 30 else ("MEDIUM" if risk_score < 60 else "HIGH")

    factors = []
    for key in active:
        if key in risk_weights:
            factors.append({
                "factor":      key,
                "weight":      risk_weights[key],
                "description": _risk_description(key),
            })

    return {
        "risk_score":  risk_score,
        "category":    category,
        "active_count": len(active),
        "factors":     factors,
        "recommendation": (
            "Proceed with monitoring" if category == "LOW" else
            "Requires compliance review" if category == "MEDIUM" else
            "High risk — legal/compliance approval required"
        ),
    }


def _risk_description(key: str) -> str:
    descriptions = {
        "rule_7_cmra_continue":  "CMRA addresses are associated with elevated fraud probability",
        "rule_8_pbsa_continue":  "PBSA addresses may indicate non-residential or commercial use",
        "rule_9_pobox_continue": "PO Box addresses are generally low-risk with PDMA validation",
        "rule_6_fallthrough":    "Comm error fallthrough may allow unverified addresses",
        "rule_3_fallthrough":    "KOEC0039+X indicates DB unavailability — high verification risk",
        "populate_result_relax": "Relaxing populateResult() logic may affect compliance reporting",
    }
    return descriptions.get(key, "Unknown risk factor")
