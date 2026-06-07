"""
What-If Simulation Engine.
Algorithms:
  1. Counterfactual Resampling — re-evaluate each transaction under overrides
  2. Bootstrap CI — 500-iteration resampling for 95% confidence interval
  3. Sensitivity Sweep — sweep single parameter across values
"""
import random
import hashlib
from typing import Dict, List, Any, Tuple


def _tx_rng(tx_id: str, salt: int) -> float:
    """Deterministic per-transaction pseudo-random value."""
    h = hashlib.md5(f"{tx_id}{salt}".encode()).digest()
    return int.from_bytes(h[:4], "big") / 0xFFFFFFFF


def _apply_overrides(tx: Dict[str, Any], overrides: Dict[str, Any]) -> str:
    """Recompute final_result for a single transaction under rule overrides."""
    if tx["doc_result"] != "IDENTITY_DOCUMENT_VALIDATED":
        return "IDENTITY_NOT_VERIFIED"

    cmra   = bool(tx["cmra_flag"])
    pbsa   = bool(tx["pbsa_flag"])
    pobox  = bool(tx["pobox_flag"])
    comm   = bool(tx["comm_error"])
    fault  = tx.get("fault_code")
    sub    = tx.get("fault_sub_code")

    gsa_stop = False

    if cmra and not overrides.get("rule_7_cmra_continue"):
        gsa_stop = True
    if pbsa and not overrides.get("rule_8_pbsa_continue"):
        gsa_stop = True
    if pobox and not overrides.get("rule_9_pobox_continue"):
        gsa_stop = True
    if comm and not overrides.get("rule_6_fallthrough"):
        gsa_stop = True
    if fault == "KOEC0039" and sub == "X" and not overrides.get("rule_3_fallthrough"):
        gsa_stop = True

    # KOEC0039 sub-code severity overrides
    if fault == "KOEC0039" and sub and sub != "X":
        key = f"koec0039_{sub}_severity"
        severity = overrides.get(key, "WARN")
        if severity == "STOP":
            gsa_stop = True

    if gsa_stop:
        return "IDENTITY_NOT_VERIFIED"

    # PDMA + Risk re-eval using seeded RNG
    pdma_pass = _tx_rng(tx["id"], 1) < 0.91
    if not pdma_pass:
        return "IDENTITY_NOT_VERIFIED"

    # populateResult relaxation: if CMRA/PBSA → PDMA path and pdma_pass
    if overrides.get("populate_result_relax") and (cmra or pbsa or pobox):
        pdma_pass = _tx_rng(tx["id"], 3) < 0.91

    risk_pass = _tx_rng(tx["id"], 2) < 0.92
    return "IDENTITY_VERIFIED" if risk_pass else "IDENTITY_NOT_VERIFIED"


def run_simulation(transactions: List[Dict[str, Any]],
                   overrides: Dict[str, Any],
                   n_iterations: int = 500) -> Dict[str, Any]:
    n = len(transactions)
    if n == 0:
        return {}

    baseline_pass = sum(1 for t in transactions if t["final_result"] == "IDENTITY_VERIFIED")
    baseline_rate = baseline_pass / n * 100

    outcomes = [_apply_overrides(tx, overrides) for tx in transactions]
    sim_pass  = sum(1 for o in outcomes if o == "IDENTITY_VERIFIED")
    sim_rate  = sim_pass / n * 100

    # Bootstrap CI
    import random as rnd
    rnd.seed(42)
    bootstrap_rates = []
    for _ in range(n_iterations):
        sample = rnd.choices(outcomes, k=n)
        rate   = sum(1 for o in sample if o == "IDENTITY_VERIFIED") / n * 100
        bootstrap_rates.append(rate)
    bootstrap_rates.sort()
    ci_low  = bootstrap_rates[int(n_iterations * 0.025)]
    ci_high = bootstrap_rates[int(n_iterations * 0.975)]

    # Breakdown by rule
    affected: Dict[str, int] = {}
    for i, tx in enumerate(transactions):
        if outcomes[i] != tx["final_result"]:
            for rule in tx.get("rules_fired", "").split(","):
                rule = rule.strip()
                if rule:
                    affected[rule] = affected.get(rule, 0) + 1

    breakdown = [{"rule": r, "count": c, "pct": round(c / n * 100, 1)}
                 for r, c in sorted(affected.items(), key=lambda x: -x[1])]

    return {
        "baseline_pass_rate":  round(baseline_rate, 2),
        "simulated_pass_rate": round(sim_rate, 2),
        "delta":               round(sim_rate - baseline_rate, 2),
        "delta_absolute":      sim_pass - baseline_pass,
        "ci_95_low":           round(ci_low, 2),
        "ci_95_high":          round(ci_high, 2),
        "affected_count":      sum(affected.values()),
        "breakdown":           breakdown,
        "runtime_ms":          0,
    }


def sensitivity_sweep(transactions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """8 preset scenario combos for the sensitivity chart."""
    presets = [
        {"label": "Baseline",                    "overrides": {}},
        {"label": "Rule 7 ON",                   "overrides": {"rule_7_cmra_continue": True}},
        {"label": "Rule 8 ON",                   "overrides": {"rule_8_pbsa_continue": True}},
        {"label": "Rules 7+8",                   "overrides": {"rule_7_cmra_continue": True, "rule_8_pbsa_continue": True}},
        {"label": "Rules 7+8+9",                 "overrides": {"rule_7_cmra_continue": True, "rule_8_pbsa_continue": True, "rule_9_pobox_continue": True}},
        {"label": "Rules 7+8+populateResult",    "overrides": {"rule_7_cmra_continue": True, "rule_8_pbsa_continue": True, "populate_result_relax": True}},
        {"label": "All Hard-Stop Relax",         "overrides": {"rule_7_cmra_continue": True, "rule_8_pbsa_continue": True, "rule_9_pobox_continue": True, "rule_6_fallthrough": True, "rule_3_fallthrough": True}},
        {"label": "Full Override",               "overrides": {"rule_7_cmra_continue": True, "rule_8_pbsa_continue": True, "rule_9_pobox_continue": True, "rule_6_fallthrough": True, "rule_3_fallthrough": True, "populate_result_relax": True}},
    ]
    results = []
    for p in presets:
        sim = run_simulation(transactions, p["overrides"], n_iterations=100)
        results.append({"label": p["label"], "pass_rate": sim["simulated_pass_rate"], "delta": sim["delta"]})
    return results


SCENARIO_CARDS = [
    {"id": "s1", "name": "Route CMRA → PDMA",          "description": "Override Rule 7: allow CMRA addresses to continue to PDMA evaluation instead of hard-stopping.", "overrides": {"rule_7_cmra_continue": True}},
    {"id": "s2", "name": "Route PBSA → PDMA",          "description": "Override Rule 8: allow PBSA addresses to continue to PDMA evaluation.", "overrides": {"rule_8_pbsa_continue": True}},
    {"id": "s3", "name": "CMRA + PBSA + populateResult", "description": "Combine Rules 7 & 8 override with populateResult() relaxation.", "overrides": {"rule_7_cmra_continue": True, "rule_8_pbsa_continue": True, "populate_result_relax": True}},
    {"id": "s4", "name": "All Hard-Stops → PDMA",      "description": "Route all GSA hard-stop cases to PDMA — maximum recovery scenario.", "overrides": {"rule_7_cmra_continue": True, "rule_8_pbsa_continue": True, "rule_9_pobox_continue": True, "rule_6_fallthrough": True, "rule_3_fallthrough": True}},
    {"id": "s5", "name": "KOEC0039 All WARN",           "description": "Treat all KOEC0039 sub-codes (including X) as WARN severity.", "overrides": {"rule_3_fallthrough": True, "koec0039_A_severity": "WARN", "koec0039_B_severity": "WARN", "koec0039_Z_severity": "WARN"}},
    {"id": "s6", "name": "POBox → PDMA",                "description": "Override Rule 9: allow PO Box addresses into PDMA.", "overrides": {"rule_9_pobox_continue": True}},
    {"id": "s7", "name": "Comm Error Fallthrough",      "description": "Override Rule 6: don't hard-stop on GSA comm errors.", "overrides": {"rule_6_fallthrough": True}},
]
