"""
Population Intelligence Engine.
Segments transactions by key dimensions and computes approval metrics per segment.
"""
from typing import Dict, List, Any
from collections import defaultdict


SEGMENT_DIMENSIONS = ["gsa_result", "fault_code", "doc_result", "face_result",
                      "pdma_result", "risk_result"]


def segment_population(transactions: List[Dict], dimension: str = "gsa_result") -> List[Dict[str, Any]]:
    groups: Dict[str, List[Dict]] = defaultdict(list)
    for tx in transactions:
        val = tx.get(dimension) or "UNKNOWN"
        groups[str(val)].append(tx)

    total_all = len(transactions)
    results = []
    for val, txs in groups.items():
        n = len(txs)
        verified = sum(1 for t in txs if t["final_result"] == "IDENTITY_VERIFIED")
        results.append({
            "dimension":      dimension,
            "segment":        val,
            "count":          n,
            "pct_of_all":     round(n / max(total_all, 1) * 100, 1),
            "verified":       verified,
            "not_verified":   n - verified,
            "approval_rate":  round(verified / n * 100, 1) if n else 0.0,
            "decline_rate":   round((n - verified) / n * 100, 1) if n else 0.0,
        })
    return sorted(results, key=lambda x: -x["count"])


def compute_funnel_by_rule(transactions: List[Dict]) -> List[Dict[str, Any]]:
    """Funnel breakdown showing drop-off at each rule stage."""
    total = len(transactions)
    rule_drops: Dict[str, int] = defaultdict(int)
    for tx in transactions:
        if tx["final_result"] != "IDENTITY_VERIFIED":
            for r in tx["rules_fired"].split(","):
                r = r.strip()
                if r and r not in ("Rule 0", "Rule 1", "Rule 2", "Rule 5"):
                    rule_drops[r] += 1
                    break  # first hard-stop rule

    stages = [
        ("Total In",        total, "entry"),
        ("Doc Fail",        sum(1 for t in transactions if t["doc_result"] != "IDENTITY_DOCUMENT_VALIDATED"), "doc"),
        ("CMRA Block",      rule_drops.get("Rule 7", 0), "gsa"),
        ("PBSA Block",      rule_drops.get("Rule 8", 0), "gsa"),
        ("POBox Block",     rule_drops.get("Rule 9", 0), "gsa"),
        ("Comm Error",      rule_drops.get("Rule 6", 0), "gsa"),
        ("Fault Block",     rule_drops.get("Rule 3", 0), "fault"),
        ("PDMA Decline",    sum(1 for t in transactions if t.get("pdma_result") == "ADDRESS_NOT_CIP_COMPLIANT"), "pdma"),
        ("Risk Block",      sum(1 for t in transactions if t.get("risk_result") == "BLOCK"), "risk"),
        ("Verified",        sum(1 for t in transactions if t["final_result"] == "IDENTITY_VERIFIED"), "outcome"),
    ]
    return [{"stage": s, "count": c, "type": tp,
             "pct": round(c / max(total, 1) * 100, 1)} for s, c, tp in stages]


def compute_treemap_data(transactions: List[Dict]) -> List[Dict[str, Any]]:
    """Treemap: top-level = GSA result, second level = final outcome."""
    groups: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for tx in transactions:
        gsa = tx.get("gsa_result") or "UNKNOWN"
        outcome = tx["final_result"]
        groups[gsa][outcome] += 1

    total = len(transactions)
    result = []
    for gsa, outcomes in groups.items():
        n_total = sum(outcomes.values())
        result.append({
            "id":       gsa,
            "label":    gsa,
            "value":    n_total,
            "pct":      round(n_total / max(total, 1) * 100, 1),
            "children": [
                {"id": f"{gsa}_{k}", "label": k, "value": v,
                 "pct": round(v / max(n_total, 1) * 100, 1),
                 "verified": k == "IDENTITY_VERIFIED"}
                for k, v in outcomes.items()
            ],
        })
    return sorted(result, key=lambda x: -x["value"])


def compute_segment_heatmap(transactions: List[Dict]) -> Dict[str, Any]:
    """Heatmap: rows = gsa_result, cols = doc_result, value = approval_rate."""
    rows_dim = ["ADDRESS_CIP_COMPLIANT", "ADDRESS_NOT_CIP_COMPLIANT", "UNKNOWN"]
    cols_dim = ["IDENTITY_DOCUMENT_VALIDATED", "IDENTITY_DOCUMENT_NOT_VALIDATED"]

    cells = []
    for gsa in rows_dim:
        for doc in cols_dim:
            subset = [t for t in transactions
                      if (t.get("gsa_result") or "UNKNOWN") == gsa
                      and (t.get("doc_result") or "UNKNOWN") == doc]
            n = len(subset)
            verified = sum(1 for t in subset if t["final_result"] == "IDENTITY_VERIFIED")
            cells.append({
                "row":           gsa,
                "col":           doc,
                "count":         n,
                "approval_rate": round(verified / max(n, 1) * 100, 1),
            })
    return {"rows": rows_dim, "cols": cols_dim, "cells": cells}


def compute_all_segments(transactions: List[Dict]) -> List[Dict[str, Any]]:
    """Summary: one row per dimension with sub-breakdown."""
    results = []
    for dim in SEGMENT_DIMENSIONS:
        segs = segment_population(transactions, dim)
        results.append({"dimension": dim, "segments": segs[:10]})
    return results
