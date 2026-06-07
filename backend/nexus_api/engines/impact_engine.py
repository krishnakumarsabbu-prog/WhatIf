"""
Rule Impact Scoring Engine.
Computes weighted impact scores, revenue estimates, counterfactual lifts.
"""
from typing import Dict, List, Any
from collections import defaultdict
import datetime


# Assumed monthly revenue per verified customer (for ROI estimates)
REVENUE_PER_CUSTOMER = 240  # USD/year → $20/month

RULE_WEIGHTS = {
    "Rule 7": {"business_weight": 1.0, "risk_weight": 0.3, "label": "CMRA = Y"},
    "Rule 8": {"business_weight": 0.9, "risk_weight": 0.3, "label": "PBSA = Y"},
    "Rule 9": {"business_weight": 0.7, "risk_weight": 0.2, "label": "POBox = P"},
    "Rule 6": {"business_weight": 0.6, "risk_weight": 0.1, "label": "Comm Error"},
    "Rule 3": {"business_weight": 0.4, "risk_weight": 0.4, "label": "KOEC0039+X"},
    "Rule 5": {"business_weight": 0.3, "risk_weight": 0.2, "label": "KOEC0039"},
    "Rule 1": {"business_weight": 0.2, "risk_weight": 0.1, "label": "KOEC0647"},
    "Rule 2": {"business_weight": 0.2, "risk_weight": 0.1, "label": "KOEC0692"},
    "Rule 0": {"business_weight": 0.0, "risk_weight": 0.0, "label": "Clean Path"},
}

HARD_STOPS = {"Rule 7", "Rule 8", "Rule 9", "Rule 6", "Rule 3"}


def compute_rule_impact_scores(transactions: List[Dict]) -> List[Dict[str, Any]]:
    """Compute impact score for each rule."""
    total = len(transactions)
    if total == 0:
        return []
    total_declined = sum(1 for t in transactions if t["final_result"] != "IDENTITY_VERIFIED")

    # 7-day window for trend
    now = datetime.date.today()
    last7 = (now - datetime.timedelta(days=7)).isoformat()
    prev7 = (now - datetime.timedelta(days=14)).isoformat()

    rule_txs: Dict[str, List[Dict]] = defaultdict(list)
    rule_l7: Dict[str, int] = defaultdict(int)
    rule_p7: Dict[str, int] = defaultdict(int)

    for tx in transactions:
        for r in tx["rules_fired"].split(","):
            r = r.strip()
            if r:
                rule_txs[r].append(tx)
                if tx["event_date"] >= last7:
                    rule_l7[r] += 1
                elif tx["event_date"] >= prev7:
                    rule_p7[r] += 1

    results = []
    for rule, txs in rule_txs.items():
        if rule not in RULE_WEIGHTS:
            continue
        n = len(txs)
        is_hard_stop = rule in HARD_STOPS
        declined_by_rule = sum(1 for t in txs if t["final_result"] != "IDENTITY_VERIFIED")

        population_pct = n / total
        approval_loss = declined_by_rule / max(n, 1)
        bw = RULE_WEIGHTS[rule]["business_weight"]
        rw = RULE_WEIGHTS[rule]["risk_weight"]

        # Impact = population_pct * approval_loss * business_weight * 100
        impact_score = round(population_pct * approval_loss * bw * 100, 2)
        revenue_impact = round(declined_by_rule * REVENUE_PER_CUSTOMER / 1000, 1)  # $K/year

        # Trend
        l7 = rule_l7[rule]
        p7 = max(rule_p7[rule], 1)
        trend = round((l7 - p7) / p7 * 100, 1)

        # Counterfactual: if rule didn't fire how many would have been verified?
        if is_hard_stop:
            # Assume PDMA pass rate (~91%) of hard-stop transactions would eventually verify
            counterfactual_gain = round(n * 0.91 * 0.92)  # pdma_pass * risk_allow
        else:
            counterfactual_gain = 0

        results.append({
            "rule":                 rule,
            "label":                RULE_WEIGHTS[rule]["label"],
            "affected_count":       n,
            "affected_pct":         round(population_pct * 100, 1),
            "declined_count":       declined_by_rule,
            "approval_loss_pct":    round(approval_loss * 100, 1),
            "impact_score":         impact_score,
            "revenue_impact_k":     revenue_impact,
            "risk_weight":          rw,
            "business_weight":      bw,
            "trend_wow":            trend,
            "is_hard_stop":         is_hard_stop,
            "counterfactual_gain":  counterfactual_gain,
            "category":             "harmful" if is_hard_stop else "soft",
        })

    return sorted(results, key=lambda x: -x["impact_score"])


def compute_revenue_loss(transactions: List[Dict]) -> Dict[str, Any]:
    """Compute estimated annual revenue loss from each decline source."""
    impact_scores = compute_rule_impact_scores(transactions)
    total_declined = sum(1 for t in transactions if t["final_result"] != "IDENTITY_VERIFIED")
    total_revenue_loss_k = round(total_declined * REVENUE_PER_CUSTOMER / 1000, 1)

    return {
        "total_declined":        total_declined,
        "total_revenue_loss_k":  total_revenue_loss_k,
        "by_rule":               impact_scores,
        "currency":              "USD",
        "basis":                 f"${REVENUE_PER_CUSTOMER}/yr per customer",
    }
