"""
Decision Replay & Counterfactual Engine.
Replays transactions under alternate rule configurations and explains individual declines.
"""
from typing import Dict, List, Any, Optional
from collections import defaultdict


HARD_STOP_RULES = {"Rule 7", "Rule 8", "Rule 9", "Rule 6", "Rule 3"}

PDMA_PASS_RATE = 0.91
RISK_ALLOW_RATE = 0.92


def _would_verify_via_pdma(tx: Dict) -> bool:
    """Deterministic estimate: if sent to PDMA, would this tx verify?"""
    # Use tx_id hash for determinism
    h = sum(ord(c) for c in tx["id"])
    return (h % 100) < int(PDMA_PASS_RATE * RISK_ALLOW_RATE * 100)


def _apply_overrides_to_tx(tx: Dict, overrides: Dict[str, bool]) -> Dict:
    """Return a modified copy of tx under the given overrides."""
    new_tx = dict(tx)
    rules_fired = [r.strip() for r in tx["rules_fired"].split(",") if r.strip()]

    # Map override keys to rule numbers
    override_map = {
        "rule_7_cmra_continue":  ("Rule 7", "cmra_flag"),
        "rule_8_pbsa_continue":  ("Rule 8", "pbsa_flag"),
        "rule_9_pobox_continue": ("Rule 9", "pobox_flag"),
        "rule_6_fallthrough":    ("Rule 6", "comm_error"),
        "rule_3_fallthrough":    ("Rule 3", None),
    }

    for override_key, (rule_num, flag_field) in override_map.items():
        if overrides.get(override_key) and rule_num in rules_fired:
            # Send to PDMA instead of hard stop
            if _would_verify_via_pdma(tx):
                new_tx["final_result"] = "IDENTITY_VERIFIED"
                new_tx["pdma_result"]  = "ADDRESS_CIP_COMPLIANT"
                new_tx["risk_result"]  = "ALLOW"
            else:
                new_tx["final_result"] = "IDENTITY_NOT_VERIFIED"
                new_tx["pdma_result"]  = "ADDRESS_NOT_CIP_COMPLIANT"

    return new_tx


def replay_transactions(transactions: List[Dict], overrides: Dict[str, bool]) -> Dict[str, Any]:
    """Replay all transactions under overrides and compute outcome delta."""
    original_verified = sum(1 for t in transactions if t["final_result"] == "IDENTITY_VERIFIED")
    total = len(transactions)

    replayed = [_apply_overrides_to_tx(tx, overrides) for tx in transactions]
    new_verified = sum(1 for t in replayed if t["final_result"] == "IDENTITY_VERIFIED")

    delta = new_verified - original_verified
    delta_pp = round((new_verified - original_verified) / max(total, 1) * 100, 2)

    # Per-rule breakdown
    breakdown: Dict[str, int] = defaultdict(int)
    for orig, repl in zip(transactions, replayed):
        if orig["final_result"] != "IDENTITY_VERIFIED" and repl["final_result"] == "IDENTITY_VERIFIED":
            rules = [r.strip() for r in orig["rules_fired"].split(",") if r.strip()]
            for r in rules:
                if r in HARD_STOP_RULES:
                    breakdown[r] += 1
                    break

    return {
        "total":                 total,
        "original_verified":     original_verified,
        "new_verified":          new_verified,
        "recovered":             max(delta, 0),
        "lost":                  max(-delta, 0),
        "delta_absolute":        delta,
        "delta_pp":              delta_pp,
        "original_rate":         round(original_verified / max(total, 1) * 100, 2),
        "new_rate":              round(new_verified / max(total, 1) * 100, 2),
        "breakdown_by_rule":     [{"rule": r, "recovered": c} for r, c in sorted(breakdown.items(), key=lambda x: -x[1])],
        "sample_replayed":       replayed[:10],
    }


def explain_transaction(tx_id: str, transactions: List[Dict]) -> Optional[Dict[str, Any]]:
    """Full explanation for a single transaction — journey + SHAP + counterfactual."""
    tx = next((t for t in transactions if t["id"] == tx_id), None)
    if not tx:
        return None

    is_verified = tx["final_result"] == "IDENTITY_VERIFIED"
    rules_fired = [r.strip() for r in tx["rules_fired"].split(",") if r.strip()]

    # Journey reconstruction
    journey = []
    doc_pass = tx["doc_result"] == "IDENTITY_DOCUMENT_VALIDATED"
    journey.append({"step": "Document Verify", "status": "PASS" if doc_pass else "FAIL",
                    "detail": tx["doc_result"]})

    if doc_pass:
        face_pass = tx["face_result"] == "VALIDATED"
        journey.append({"step": "Face Scan", "status": "PASS" if face_pass else "WARN",
                        "detail": tx["face_result"]})

        gsa_stop = bool(tx["cmra_flag"] or tx["pbsa_flag"] or tx["pobox_flag"] or tx["comm_error"])
        gsa_detail = []
        if tx["cmra_flag"]:   gsa_detail.append("CMRA=Y (Rule 7 → HARD STOP)")
        if tx["pbsa_flag"]:   gsa_detail.append("PBSA=Y (Rule 8 → HARD STOP)")
        if tx["pobox_flag"]:  gsa_detail.append("POBox=P (Rule 9 → HARD STOP)")
        if tx["comm_error"]:  gsa_detail.append("Comm Error (Rule 6 → HARD STOP)")
        if tx["fault_code"]:  gsa_detail.append(f"fault_code={tx['fault_code']}")

        journey.append({"step": "GSA Address Check", "status": "FAIL" if gsa_stop else "PASS",
                        "detail": "; ".join(gsa_detail) if gsa_detail else "ADDRESS_CIP_COMPLIANT"})

        if not gsa_stop:
            pdma = tx.get("pdma_result")
            journey.append({"step": "PDMA Compliance", "status": "PASS" if pdma == "ADDRESS_CIP_COMPLIANT" else "FAIL",
                            "detail": pdma or "SKIPPED"})
            if pdma == "ADDRESS_CIP_COMPLIANT":
                risk = tx.get("risk_result")
                journey.append({"step": "Risk Evaluation", "status": "PASS" if risk == "ALLOW" else "FAIL",
                                "detail": risk or "SKIPPED"})
                journey.append({"step": "populateResult()", "status": "PASS" if risk == "ALLOW" else "FAIL",
                                "detail": tx["final_result"]})

    journey.append({"step": "Final Outcome", "status": "VERIFIED" if is_verified else "NOT_VERIFIED",
                    "detail": tx["final_result"]})

    # Contributing rules
    contributing = []
    for rule in rules_fired:
        is_stop = rule in HARD_STOP_RULES
        contributing.append({
            "rule":    rule,
            "fired":   True,
            "impact":  "HIGH" if is_stop else "LOW",
            "is_stop": is_stop,
        })

    # SHAP (simplified: contribution of each feature to approval probability)
    base_rate = sum(1 for t in transactions if t["final_result"] == "IDENTITY_VERIFIED") / max(len(transactions), 1)
    shap_features = _compute_tx_shap(tx, transactions, base_rate)

    # Counterfactual: what if hard stops were bypassed?
    counterfactual = None
    hard_stops_fired = [r for r in rules_fired if r in HARD_STOP_RULES]
    if not is_verified and hard_stops_fired:
        override_map = {
            "Rule 7": "rule_7_cmra_continue",
            "Rule 8": "rule_8_pbsa_continue",
            "Rule 9": "rule_9_pobox_continue",
            "Rule 6": "rule_6_fallthrough",
            "Rule 3": "rule_3_fallthrough",
        }
        overrides = {override_map[r]: True for r in hard_stops_fired if r in override_map}
        replayed = _apply_overrides_to_tx(tx, overrides)
        counterfactual = {
            "outcome":     replayed["final_result"],
            "would_verify": replayed["final_result"] == "IDENTITY_VERIFIED",
            "rules_bypassed": hard_stops_fired,
            "overrides_applied": overrides,
            "probability": 0.82 if replayed["final_result"] == "IDENTITY_VERIFIED" else 0.18,
            "reason":      f"Bypassing {', '.join(hard_stops_fired)} would route to PDMA verification",
        }

    return {
        "transaction":      tx,
        "is_verified":      is_verified,
        "journey":          journey,
        "rules_fired":      rules_fired,
        "contributing":     contributing,
        "shap":             shap_features,
        "counterfactual":   counterfactual,
        "primary_reason":   _primary_decline_reason(tx),
    }


def _primary_decline_reason(tx: Dict) -> str:
    if tx["doc_result"] != "IDENTITY_DOCUMENT_VALIDATED":
        return "Document verification failed"
    if tx["cmra_flag"]:
        return "Address flagged as CMRA (Rule 7 — Hard Stop)"
    if tx["pbsa_flag"]:
        return "Address flagged as PBSA (Rule 8 — Hard Stop)"
    if tx["pobox_flag"]:
        return "Address is a PO Box (Rule 9 — Hard Stop)"
    if tx["comm_error"]:
        return "GSA communication error (Rule 6 — Hard Stop)"
    if tx.get("fault_code") == "KOEC0039" and tx.get("fault_sub_code") == "X":
        return "KOEC0039+X fault code (Rule 3 — Hard Stop)"
    if tx.get("pdma_result") == "ADDRESS_NOT_CIP_COMPLIANT":
        return "PDMA address not CIP compliant"
    if tx.get("risk_result") == "BLOCK":
        return "Risk evaluation blocked"
    return "All checks passed — verified" if tx["final_result"] == "IDENTITY_VERIFIED" else "Unknown reason"


def _compute_tx_shap(tx: Dict, all_txs: List[Dict], base_rate: float) -> List[Dict]:
    features = [
        ("cmra_flag",   bool(tx["cmra_flag"])),
        ("pbsa_flag",   bool(tx["pbsa_flag"])),
        ("pobox_flag",  bool(tx["pobox_flag"])),
        ("comm_error",  bool(tx["comm_error"])),
        ("doc_result",  tx["doc_result"]),
        ("face_result", tx["face_result"]),
        ("fault_code",  tx.get("fault_code")),
    ]
    result = []
    for feat, val in features:
        subset = [t for t in all_txs if t.get(feat) == val]
        rate = sum(1 for t in subset if t["final_result"] == "IDENTITY_VERIFIED") / max(len(subset), 1)
        shap = rate - base_rate
        result.append({
            "feature":   feat,
            "value":     str(val),
            "shap":      round(shap, 4),
            "abs_shap":  round(abs(shap), 4),
            "direction": "positive" if shap >= 0 else "negative",
        })
    return sorted(result, key=lambda x: -x["abs_shap"])
