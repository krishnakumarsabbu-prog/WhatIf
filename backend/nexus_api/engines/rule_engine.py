"""
Rule Intelligence Engine.
Computes rule firing stats, SHAP approximation, outcome funnel, WoW trend.
"""
import datetime
from typing import Dict, List, Any


RULE_INFO = [
    {"key": "Rule 7", "label": "Rule 7 — CMRA=Y",               "hard_stop": True,  "impact": "HIGH"},
    {"key": "Rule 8", "label": "Rule 8 — PBSA=Y",               "hard_stop": True,  "impact": "HIGH"},
    {"key": "Rule 9", "label": "Rule 9 — POBox=P",              "hard_stop": True,  "impact": "MED"},
    {"key": "Rule 5", "label": "Rule 5 — KOEC0039 (non-X)",    "hard_stop": False, "impact": "MED"},
    {"key": "Rule 6", "label": "Rule 6 — GSA Comm Error",       "hard_stop": True,  "impact": "MED"},
    {"key": "Rule 3", "label": "Rule 3 — KOEC0039+X",          "hard_stop": True,  "impact": "LOW"},
    {"key": "Rule 1", "label": "Rule 1 — KOEC0647 (missing #)","hard_stop": False, "impact": "LOW"},
    {"key": "Rule 2", "label": "Rule 2 — KOEC0692 (not USPS)", "hard_stop": False, "impact": "LOW"},
    {"key": "Rule 0", "label": "Rule 0 — Clean (→ PDMA)",      "hard_stop": False, "impact": "LOW"},
]


def compute_rule_stats(transactions: List[Dict]) -> List[Dict[str, Any]]:
    total    = len(transactions)
    declined = sum(1 for t in transactions if t["final_result"] != "IDENTITY_VERIFIED")

    counts: Dict[str, int] = {}
    for tx in transactions:
        for r in tx["rules_fired"].split(","):
            r = r.strip()
            if r:
                counts[r] = counts.get(r, 0) + 1

    now    = datetime.date.today()
    last7  = (now - datetime.timedelta(days=7)).isoformat()
    prev7  = (now - datetime.timedelta(days=14)).isoformat()

    counts_l7: Dict[str, int] = {}
    counts_p7: Dict[str, int] = {}
    for tx in transactions:
        for r in tx["rules_fired"].split(","):
            r = r.strip()
            if not r:
                continue
            if tx["event_date"] >= last7:
                counts_l7[r] = counts_l7.get(r, 0) + 1
            elif tx["event_date"] >= prev7:
                counts_p7[r] = counts_p7.get(r, 0) + 1

    results = []
    for ri in RULE_INFO:
        key = ri["key"]
        cnt = counts.get(key, 0)
        l7  = counts_l7.get(key, 0)
        p7  = counts_p7.get(key, 1)
        wow = round((l7 - p7) / p7 * 100, 1)
        results.append({
            "rule":           key,
            "label":          ri["label"],
            "count":          cnt,
            "pct_of_all":     round(cnt / total * 100, 1) if total else 0,
            "pct_of_declined": round(cnt / declined * 100, 1) if declined else 0,
            "outcome":        "100% FAIL" if ri["hard_stop"] else "MIXED",
            "impact":         ri["impact"],
            "trend_wow":      wow,
            "hard_stop":      ri["hard_stop"],
        })
    return sorted(results, key=lambda x: -x["count"])


def compute_feature_importance(transactions: List[Dict]) -> List[Dict[str, Any]]:
    n = len(transactions)
    if n == 0:
        return []
    base_rate = sum(1 for t in transactions if t["final_result"] == "IDENTITY_VERIFIED") / n

    features = [
        ("pbsa_flag",   lambda t: bool(t["pbsa_flag"])),
        ("cmra_flag",   lambda t: bool(t["cmra_flag"])),
        ("pobox_flag",  lambda t: bool(t["pobox_flag"])),
        ("comm_error",  lambda t: bool(t["comm_error"])),
    ]
    fault_features = [
        ("fault_KOEC0039", lambda t: t.get("fault_code") == "KOEC0039"),
        ("fault_KOEC0647", lambda t: t.get("fault_code") == "KOEC0647"),
        ("fault_KOEC0692", lambda t: t.get("fault_code") == "KOEC0692"),
    ]
    results = []
    for label, pred in features + fault_features:
        with_feat    = [t for t in transactions if pred(t)]
        without_feat = [t for t in transactions if not pred(t)]
        pw = sum(1 for t in with_feat if t["final_result"] == "IDENTITY_VERIFIED") / max(len(with_feat), 1)
        pwo = sum(1 for t in without_feat if t["final_result"] == "IDENTITY_VERIFIED") / max(len(without_feat), 1)
        shap = pw - pwo
        results.append({
            "feature":   label,
            "label":     label,
            "shap":      round(abs(shap), 4),
            "direction": "positive" if shap >= 0 else "negative",
        })

    doc_fail = [t for t in transactions if t["doc_result"] != "IDENTITY_DOCUMENT_VALIDATED"]
    doc_pass = [t for t in transactions if t["doc_result"] == "IDENTITY_DOCUMENT_VALIDATED"]
    pf  = sum(1 for t in doc_fail if t["final_result"] == "IDENTITY_VERIFIED") / max(len(doc_fail), 1)
    pp  = sum(1 for t in doc_pass if t["final_result"] == "IDENTITY_VERIFIED") / max(len(doc_pass), 1)
    results.append({"feature": "doc_fail", "label": "doc_visual_fail", "shap": round(abs(pf - pp), 4), "direction": "negative"})

    return sorted(results, key=lambda x: -x["shap"])


def compute_outcome_funnel(transactions: List[Dict]) -> List[Dict[str, Any]]:
    n = len(transactions)
    doc_pass   = sum(1 for t in transactions if t["doc_result"] == "IDENTITY_DOCUMENT_VALIDATED")
    face_pass  = sum(1 for t in transactions if t["face_result"] == "VALIDATED")
    gsa_pass   = sum(1 for t in transactions if not (t["cmra_flag"] or t["pbsa_flag"] or t["pobox_flag"] or t["comm_error"]))
    pdma_eval  = sum(1 for t in transactions if t["pdma_result"] is not None)
    risk_eval  = sum(1 for t in transactions if t["risk_result"] is not None)
    verified   = sum(1 for t in transactions if t["final_result"] == "IDENTITY_VERIFIED")

    return [
        {"stage": "Total Requests",        "count": n,         "dropped": 0,                 "pass_rate": 100.0},
        {"stage": "After Doc Verify",      "count": doc_pass,  "dropped": n - doc_pass,      "pass_rate": round(doc_pass  / n * 100, 1) if n else 0},
        {"stage": "After Face Scan",       "count": face_pass, "dropped": doc_pass - face_pass, "pass_rate": round(face_pass / n * 100, 1) if n else 0},
        {"stage": "After GSA Check",       "count": gsa_pass,  "dropped": face_pass - gsa_pass, "pass_rate": round(gsa_pass  / n * 100, 1) if n else 0},
        {"stage": "After PDMA (eligible)", "count": pdma_eval, "dropped": gsa_pass - pdma_eval, "pass_rate": round(pdma_eval / n * 100, 1) if n else 0},
        {"stage": "After Risk Eval",       "count": risk_eval, "dropped": pdma_eval - risk_eval, "pass_rate": round(risk_eval / n * 100, 1) if n else 0},
        {"stage": "Verified",              "count": verified,  "dropped": risk_eval - verified,  "pass_rate": round(verified  / n * 100, 1) if n else 0},
    ]


def compute_rule_trend(transactions: List[Dict], rule: str) -> List[Dict[str, Any]]:
    by_date: Dict[str, int] = {}
    for tx in transactions:
        if rule in tx["rules_fired"].split(","):
            d = tx["event_date"]
            by_date[d] = by_date.get(d, 0) + 1
    return [{"date": d, "count": c} for d, c in sorted(by_date.items())]
