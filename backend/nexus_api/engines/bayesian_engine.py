"""
Bayesian Engine — frequency-based CPT learning + exact inference via enumeration.
No external ML library needed — pure Python frequency counting.
"""
from typing import Dict, List, Any, Optional
from collections import defaultdict


NODE_LABELS = {
    "DOC_VERIFY":        "Document Verify",
    "FACE_SCAN":         "Face Scan",
    "GSA_RESULT":        "GSA Address",
    "PDMA_RESULT":       "PDMA Risk",
    "RISK_RESULT":       "Risk Eval",
    "IDENTITY_VERIFIED": "ID Verified",
}

NETWORK_EDGES = [
    ("DOC_VERIFY",  "FACE_SCAN"),
    ("DOC_VERIFY",  "GSA_RESULT"),
    ("GSA_RESULT",  "PDMA_RESULT"),
    ("PDMA_RESULT", "RISK_RESULT"),
    ("FACE_SCAN",   "RISK_RESULT"),
    ("RISK_RESULT", "IDENTITY_VERIFIED"),
    ("GSA_RESULT",  "IDENTITY_VERIFIED"),
]


def _discretize(tx: Dict[str, Any]) -> Dict[str, Optional[str]]:
    cmra   = bool(tx.get("cmra_flag"))
    pbsa   = bool(tx.get("pbsa_flag"))
    pobox  = bool(tx.get("pobox_flag"))
    fault  = tx.get("fault_code")
    comm   = bool(tx.get("comm_error"))
    gsa    = tx.get("gsa_result")

    if cmra:
        gsa_state = "CMRA"
    elif pbsa:
        gsa_state = "PBSA"
    elif pobox:
        gsa_state = "POBOX"
    elif comm:
        gsa_state = "ERROR"
    elif fault:
        gsa_state = "FAULT"
    elif gsa:
        gsa_state = "CLEAN"
    else:
        gsa_state = None

    pdma = tx.get("pdma_result")
    risk = tx.get("risk_result")

    return {
        "DOC_VERIFY":        "PASS" if tx.get("doc_result") == "IDENTITY_DOCUMENT_VALIDATED" else "FAIL",
        "FACE_SCAN":         "PASS" if tx.get("face_result") == "VALIDATED" else ("FAIL" if tx.get("face_result") else None),
        "GSA_RESULT":        gsa_state,
        "PDMA_RESULT":       "COMPLIANT" if pdma == "ADDRESS_CIP_COMPLIANT" else ("NOT_COMPLIANT" if pdma else None),
        "RISK_RESULT":       "ALLOW" if risk == "ALLOW" else ("BLOCK" if risk else None),
        "IDENTITY_VERIFIED": "YES" if tx.get("final_result") == "IDENTITY_VERIFIED" else "NO",
    }


def _matches(state: Dict, evidence: Dict) -> bool:
    for k, v in evidence.items():
        if v is None:
            continue
        if state.get(k) != v:
            return False
    return True


def query_posterior(transactions: List[Dict], evidence: Dict[str, Optional[str]]) -> Dict[str, Any]:
    states = [_discretize(tx) for tx in transactions]
    matching = [s for s in states if _matches(s, evidence)]
    verified = sum(1 for s in matching if s.get("IDENTITY_VERIFIED") == "YES")
    total    = len(matching)
    p_ver    = verified / total if total > 0 else 0.5

    confidence = "HIGH" if total >= 100 else ("MEDIUM" if total >= 20 else "LOW")
    return {
        "p_verified":     round(p_ver, 4),
        "p_not_verified": round(1 - p_ver, 4),
        "confidence":     confidence,
        "sample_size":    total,
        "algorithm":      "exact_enumeration",
    }


def compute_mutual_information(transactions: List[Dict]) -> List[Dict[str, Any]]:
    import math
    states = [_discretize(tx) for tx in transactions]
    n = len(states)
    if n == 0:
        return []

    target_key = "IDENTITY_VERIFIED"
    nodes_config = [
        ("DOC_VERIFY",   ["PASS", "FAIL"]),
        ("FACE_SCAN",    ["PASS", "FAIL"]),
        ("GSA_RESULT",   ["CLEAN", "CMRA", "PBSA", "POBOX", "ERROR", "FAULT"]),
        ("PDMA_RESULT",  ["COMPLIANT", "NOT_COMPLIANT"]),
        ("RISK_RESULT",  ["ALLOW", "BLOCK"]),
    ]

    results = []
    for node, values in nodes_config:
        eligible = [s for s in states if s.get(node) is not None and s.get(target_key) is not None]
        ne = len(eligible)
        if ne == 0:
            results.append({"node": node, "label": NODE_LABELS.get(node, node), "mi_score": 0.0})
            continue

        p_yes = sum(1 for s in eligible if s[target_key] == "YES") / ne
        base_ent = 0.0
        if 0 < p_yes < 1:
            base_ent = -p_yes * math.log2(p_yes) - (1 - p_yes) * math.log2(1 - p_yes)

        cond_ent = 0.0
        for v in values:
            subset = [s for s in eligible if s.get(node) == v]
            if not subset:
                continue
            p_x = len(subset) / ne
            p_ver = sum(1 for s in subset if s[target_key] == "YES") / len(subset)
            if 0 < p_ver < 1:
                h = -p_ver * math.log2(p_ver) - (1 - p_ver) * math.log2(1 - p_ver)
            else:
                h = 0.0
            cond_ent += p_x * h

        mi = max(0.0, base_ent - cond_ent)
        results.append({"node": node, "label": NODE_LABELS.get(node, node), "mi_score": round(mi, 4)})

    return sorted(results, key=lambda x: x["mi_score"], reverse=True)


def compute_cpt(transactions: List[Dict], node: str) -> Dict[str, Any]:
    states = [_discretize(tx) for tx in transactions]

    parent_map: Dict[str, List[str]] = {
        "DOC_VERIFY":        [],
        "FACE_SCAN":         ["DOC_VERIFY"],
        "GSA_RESULT":        ["DOC_VERIFY"],
        "PDMA_RESULT":       ["GSA_RESULT"],
        "RISK_RESULT":       ["PDMA_RESULT", "FACE_SCAN"],
        "IDENTITY_VERIFIED": ["RISK_RESULT", "GSA_RESULT"],
    }
    parents = parent_map.get(node, [])
    pass_states = {"PASS", "YES", "ALLOW", "COMPLIANT", "CLEAN"}

    if not parents:
        vals = [s for s in states if s.get(node) is not None]
        cnt  = len(vals)
        pas  = sum(1 for s in vals if s.get(node) in pass_states)
        rows = [{"condition": "Marginal", "p_pass": round(pas/cnt, 4) if cnt else 0,
                 "p_fail": round((cnt-pas)/cnt, 4) if cnt else 1, "count": cnt}]
    else:
        parent = parents[0]
        pvals  = sorted({s.get(parent) for s in states if s.get(parent) is not None})
        rows   = []
        for pv in pvals:
            subset = [s for s in states if s.get(parent) == pv and s.get(node) is not None]
            cnt = len(subset)
            if cnt == 0:
                continue
            pas = sum(1 for s in subset if s.get(node) in pass_states)
            rows.append({
                "condition": f"{parent}={pv}",
                "p_pass": round(pas/cnt, 4),
                "p_fail": round((cnt-pas)/cnt, 4),
                "count":  cnt,
            })

    return {"node": node, "parents": parents, "rows": rows}
