"""
SHAP approximation engine.
Computes: shap(feature) = P(verified | feature=value) − P(verified | baseline)
No external ML library — pure frequency-based approximation.
"""
from typing import Dict, List, Any


def compute_global_shap(transactions: List[Dict]) -> List[Dict[str, Any]]:
    n = len(transactions)
    if n == 0:
        return []
    base_rate = sum(1 for t in transactions if t["final_result"] == "IDENTITY_VERIFIED") / n

    features = [
        ("pbsa_flag",   lambda t: bool(t["pbsa_flag"])),
        ("cmra_flag",   lambda t: bool(t["cmra_flag"])),
        ("pobox_flag",  lambda t: bool(t["pobox_flag"])),
        ("comm_error",  lambda t: bool(t["comm_error"])),
        ("fault_KOEC0039", lambda t: t.get("fault_code") == "KOEC0039"),
        ("fault_KOEC0647", lambda t: t.get("fault_code") == "KOEC0647"),
        ("fault_KOEC0692", lambda t: t.get("fault_code") == "KOEC0692"),
        ("doc_fail",    lambda t: t["doc_result"] != "IDENTITY_DOCUMENT_VALIDATED"),
    ]

    results = []
    for label, pred in features:
        with_feat    = [t for t in transactions if pred(t)]
        without_feat = [t for t in transactions if not pred(t)]
        p_with    = sum(1 for t in with_feat    if t["final_result"] == "IDENTITY_VERIFIED") / max(len(with_feat), 1)
        p_without = sum(1 for t in without_feat if t["final_result"] == "IDENTITY_VERIFIED") / max(len(without_feat), 1)
        shap_val  = p_with - p_without
        results.append({
            "feature":    label,
            "importance": round(abs(shap_val), 4),
            "direction":  "negative" if shap_val < 0 else "positive",
            "shap_raw":   round(shap_val, 4),
        })
    return sorted(results, key=lambda x: -x["importance"])


def explain_transaction(transaction: Dict, all_transactions: List[Dict]) -> Dict[str, Any]:
    """Per-transaction SHAP waterfall: feature contribution vs dataset baseline."""
    n = len(all_transactions)
    base_rate = sum(1 for t in all_transactions if t["final_result"] == "IDENTITY_VERIFIED") / max(n, 1)

    tx = transaction
    features_vals = [
        ("cmra_flag",    bool(tx.get("cmra_flag")),   lambda t, v: bool(t["cmra_flag"]) == v),
        ("pbsa_flag",    bool(tx.get("pbsa_flag")),   lambda t, v: bool(t["pbsa_flag"]) == v),
        ("pobox_flag",   bool(tx.get("pobox_flag")),  lambda t, v: bool(t["pobox_flag"]) == v),
        ("comm_error",   bool(tx.get("comm_error")),  lambda t, v: bool(t["comm_error"]) == v),
        ("fault_code",   tx.get("fault_code"),        lambda t, v: t.get("fault_code") == v),
        ("doc_result",   tx.get("doc_result"),        lambda t, v: t.get("doc_result") == v),
        ("face_result",  tx.get("face_result"),       lambda t, v: t.get("face_result") == v),
    ]

    shap_entries = []
    for feat_name, feat_val, match_fn in features_vals:
        subset = [t for t in all_transactions if match_fn(t, feat_val)]
        if not subset:
            continue
        rate = sum(1 for t in subset if t["final_result"] == "IDENTITY_VERIFIED") / len(subset)
        contribution = rate - base_rate
        shap_entries.append({
            "name":  feat_name,
            "value": str(feat_val),
            "shap":  round(contribution, 4),
            "n":     len(subset),
        })

    shap_entries.sort(key=lambda x: abs(x["shap"]), reverse=True)
    prediction = 1.0 if tx.get("final_result") == "IDENTITY_VERIFIED" else 0.0

    return {
        "base_value": round(base_rate, 4),
        "features":   shap_entries,
        "prediction": prediction,
        "final_result": tx.get("final_result"),
    }
