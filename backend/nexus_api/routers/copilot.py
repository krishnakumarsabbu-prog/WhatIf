"""
AI Copilot router — rule-grounded NLU response generator.
No external LLM API. Responses are built from live DB statistics.
"""
from fastapi import APIRouter
from ..database import query
from ..models.domain import CopilotRequest

router = APIRouter()

RULE_KNOWLEDGE = {
    "rule 7": "Rule 7 fires when cmra_flag=Y (Commercial Mail Receiving Agency). It is a HARD STOP — the transaction is immediately declined. CMRA addresses are PO Box–type addresses at commercial providers (UPS Store, FedEx Office). This rule blocks ~13% of transactions.",
    "rule 8": "Rule 8 fires when pbsa_flag=Y (Prison/Bureau of Safety Address). It is a HARD STOP. PBSA flags indicate the address is associated with a correctional institution. This blocks ~10% of transactions.",
    "rule 9": "Rule 9 fires when pobox_flag=P (standard PO Box address). It is a HARD STOP that prevents identity verification for PO Box addresses. Blocks ~8% of transactions.",
    "rule 6": "Rule 6 fires on comm_error=true (GSA communication error). It is a HARD STOP. When the GSA address service is unreachable, the system defaults to decline. Blocks ~3% of transactions.",
    "rule 5": "Rule 5 fires on KOEC0039 fault code for non-X sub-codes (A, B, H, M, S, Z). It is a SOFT rule — the transaction enters PDMA evaluation instead of hard-stopping.",
    "rule 3": "Rule 3 fires on KOEC0039 with sub-code X specifically. It is a HARD STOP. The X sub-code indicates the most severe address anomaly class.",
    "rule 1": "Rule 1 fires when the KOEC0647 fault code is present, indicating a missing apartment/unit number. Soft rule — transaction can continue to PDMA.",
    "rule 2": "Rule 2 fires when KOEC0692 is present, meaning the address is not USPS-standardized. Soft rule, continues to PDMA.",
    "rule 0": "Rule 0 is the clean path — no GSA issues. These transactions proceed directly to PDMA evaluation.",
}

CONCEPT_KNOWLEDGE = {
    "cmra":         "CMRA = Commercial Mail Receiving Agency. The GSA service returns cmra_flag=Y for these addresses. Triggers Rule 7 (hard stop).",
    "pbsa":         "PBSA = Prison/Bureau of Safety Address. GSA returns pbsa_flag=Y. Triggers Rule 8 (hard stop).",
    "koec0039":     "KOEC0039 is a GSA fault code indicating a significant address anomaly. Sub-code X triggers Rule 3 (hard stop); all other sub-codes trigger Rule 5 (soft).",
    "pdma":         "PDMA = Physical/Digital Mail Address check. Compliant addresses receive IDENTITY_VERIFIED. Transactions reach PDMA only after passing all GSA hard-stop rules.",
    "gsa":          "GSA = Government Services Administration address verification service. Checks CMRA, PBSA, PO Box status, and fault codes.",
    "psi":          "PSI = Population Stability Index. PSI < 0.10 is STABLE, 0.10–0.20 is MONITOR, > 0.20 is DRIFT DETECTED.",
    "shap":         "SHAP approximation: for each binary feature, we compute P(verified|feat=1) − P(verified|feat=0). Negative SHAP means the feature reduces verification probability.",
    "monte carlo":  "The What-If Engine uses Monte Carlo simulation: for each transaction, a seeded per-transaction RNG determines whether it would pass under overridden rules.",
    "bayesian":     "The Bayesian Network uses exact inference via enumeration. Evidence-consistent transactions are filtered from the dataset and posterior P(IDENTITY_VERIFIED | evidence) is computed from frequency counts.",
}


def _build_response(user_input: str) -> str:
    lower = user_input.lower()
    txs   = query("SELECT * FROM transactions")
    total = len(txs)
    verified = sum(1 for t in txs if t["final_result"] == "IDENTITY_VERIFIED")
    declined = total - verified

    # Status / overview
    if any(w in lower for w in ["status", "overview", "summary", "how are", "dashboard"]):
        from ..engines.rule_engine import compute_rule_stats
        from ..engines.drift_engine import compute_drift_report
        rules = compute_rule_stats(txs)[:3]
        drift = compute_drift_report(txs)
        alerts = [d for d in drift if d["alert"]]
        top_rules = "\n".join(f"- {r['label']}: {r['count']:,} firings ({r['pct_of_declined']}% of declines)" for r in rules)
        alert_str = ", ".join(f"{a['label']} (PSI={a['psi']})" for a in alerts) if alerts else "None — all STABLE"
        return (f"**Current System Status**\n\n"
                f"- **Total Transactions:** {total:,}\n"
                f"- **Verified:** {verified:,} ({verified/total*100:.1f}%)\n"
                f"- **Declined:** {declined:,} ({declined/total*100:.1f}%)\n\n"
                f"**Top Decline Drivers:**\n{top_rules}\n\n"
                f"**Drift Alerts:** {alert_str}")

    # Rule-specific
    for key, text in RULE_KNOWLEDGE.items():
        if key in lower:
            from ..engines.rule_engine import compute_rule_stats
            rules = compute_rule_stats(txs)
            rule_name = key.replace("rule ", "Rule ")
            stats = next((r for r in rules if r["rule"].lower() == rule_name.lower()), None)
            extra = f"\n\n**Live Stats:** {stats['count']:,} firings ({stats['pct_of_declined']}% of declines, WoW: {stats['trend_wow']:+.1f}%)" if stats else ""
            return f"**{key.upper()} Knowledge**\n\n{text}{extra}"

    # Concepts
    for key, text in CONCEPT_KNOWLEDGE.items():
        if key in lower:
            return f"**{key.upper()} Explanation**\n\n{text}"

    # Decline analysis
    if any(w in lower for w in ["decline", "fail", "top rule", "why"]):
        from ..engines.rule_engine import compute_rule_stats
        rules = [r for r in compute_rule_stats(txs) if r["hard_stop"]][:4]
        lines = "\n\n".join(f"- **{r['label']}**\n  - Firings: {r['count']:,} | {r['pct_of_declined']}% of declines | WoW: {r['trend_wow']:+.1f}%" for r in rules)
        return f"**Decline Root Cause Analysis**\n\nTop hard-stop rules:\n\n{lines}"

    # What-if
    if any(w in lower for w in ["what-if", "whatif", "simulate", "override", "recover"]):
        from ..engines.whatif_engine import run_simulation
        sim = run_simulation(txs, {"rule_7_cmra_continue": True, "rule_8_pbsa_continue": True})
        return (f"**What-If Simulation Estimate**\n\n"
                f"Simulating Rule 7 (CMRA→PDMA) + Rule 8 (PBSA→PDMA):\n\n"
                f"- **Baseline rate:** {sim['baseline_pass_rate']:.1f}%\n"
                f"- **Simulated rate:** {sim['simulated_pass_rate']:.1f}%\n"
                f"- **Delta:** {sim['delta']:+.2f}pp | {sim['delta_absolute']:+,} transactions\n"
                f"- **95% CI:** [{sim['ci_95_low']:.1f}%, {sim['ci_95_high']:.1f}%]")

    # Drift
    if any(w in lower for w in ["drift", "psi", "distribution", "shift", "page-hinkley"]):
        from ..engines.drift_engine import compute_drift_report
        drift = compute_drift_report(txs)
        alerts = [d for d in drift if d["alert"]]
        top = drift[0] if drift else None
        alert_str = "\n".join(f"- {a['label']}: PSI={a['psi']} (Δ{a['trend']:+.1f}pp)" for a in alerts) if alerts else "All variables STABLE."
        return (f"**Drift Detection Summary**\n\n"
                f"Active alerts: {len(alerts)}\n{alert_str}\n\n"
                f"Highest PSI: {top['label'] if top else 'N/A'} (PSI={top['psi'] if top else 0})")

    # Help
    if any(w in lower for w in ["help", "what can", "commands"]):
        return ("**NEXUS AI Copilot — Topics**\n\n"
                "- **Rules:** 'Tell me about Rule 7' · 'What is CMRA?'\n"
                "- **Analysis:** 'What are the top decline drivers?'\n"
                "- **Drift:** 'Show drift status' · 'What is PSI?'\n"
                "- **Simulation:** 'Simulate overriding Rule 7'\n"
                "- **Status:** 'Give me a system overview'")

    return (f"I understand you're asking about: **\"{user_input}\"**\n\n"
            "Try: 'system overview', 'explain Rule 7', 'drift status', 'simulate CMRA override', or 'help'.")


@router.post("/chat")
def chat(request: CopilotRequest):
    response = _build_response(request.message)
    return {"reply": response, "model": "nexus-rule-engine-v1"}
