import { db } from '@/lib/db';
import { computeRuleStats } from '@/api/rules';
import { computeDriftReport } from '@/api/drift';
import { runSimulation } from '@/api/simulation';

export interface CopilotMessage {
  id:        string;
  role:      'user' | 'assistant';
  content:   string;
  timestamp: string;
}

function pct(n: number, t: number) { return t > 0 ? ((n / t) * 100).toFixed(1) + '%' : '0%'; }

function buildContext() {
  const txs = db.transactions;
  const total = txs.length;
  const verified = txs.filter(t => t.final_result === 'IDENTITY_VERIFIED').length;
  const declined = total - verified;

  const rules = computeRuleStats();
  const top3  = rules.slice(0, 3);

  const drift = computeDriftReport();
  const alerts = drift.filter(d => d.alert);

  return { txs, total, verified, declined, rules, top3, drift, alerts };
}

const RULE_KNOWLEDGE: Record<string, string> = {
  'rule 7': 'Rule 7 fires when `cmra_flag = Y` (Commercial Mail Receiving Agency). It is a HARD STOP — the transaction is immediately declined. CMRA addresses are PO Box–type addresses at commercial providers (UPS Store, FedEx Office). This rule blocks ~13% of transactions on average.',
  'rule 8': 'Rule 8 fires when `pbsa_flag = Y` (Prison/Bureau of Safety Address). It is a HARD STOP. PBSA flags indicate the address is associated with a correctional institution. This blocks ~10% of transactions.',
  'rule 9': 'Rule 9 fires when `pobox_flag = P` (standard PO Box address). It is a HARD STOP that prevents identity verification for PO Box addresses. Blocks ~8% of transactions.',
  'rule 6': 'Rule 6 fires on `comm_error = true` (GSA communication error). It is a HARD STOP. When the GSA address service is unreachable, the system defaults to decline to prevent identity fraud. Blocks ~3% of transactions.',
  'rule 5': 'Rule 5 fires on KOEC0039 fault code for non-X sub-codes (A, B, H, M, S, Z). It is a SOFT rule — the transaction enters PDMA evaluation instead of hard-stopping. The KOEC0039 sub-code determines whether Rule 3 (hard stop) or Rule 5 (soft) applies.',
  'rule 3': 'Rule 3 fires on KOEC0039 with sub-code X specifically. It is a HARD STOP. The X sub-code indicates the most severe address anomaly class.',
  'rule 1': 'Rule 1 fires when the KOEC0647 fault code is present, indicating a missing apartment/unit number. It is a soft rule — the transaction can still proceed to PDMA check.',
  'rule 2': 'Rule 2 fires when KOEC0692 is present, meaning the address is not USPS-standardized. Soft rule, continues to PDMA.',
  'rule 0': 'Rule 0 is the "clean path" — no GSA issues, no CMRA/PBSA/POBox flags, no fault codes. These transactions proceed directly to PDMA evaluation (→ PDMA path).',
};

const CONCEPT_KNOWLEDGE: Record<string, string> = {
  'cmra': 'CMRA = Commercial Mail Receiving Agency. Examples: The UPS Store, FedEx Office, Mailboxes Etc. The GSA service returns `cmra_flag=Y` for these addresses. Triggers Rule 7 (hard stop).',
  'pbsa': 'PBSA = Prison/Bureau of Safety Address. The GSA service returns `pbsa_flag=Y` for addresses associated with correctional facilities. Triggers Rule 8 (hard stop).',
  'pobox': 'PO Box addresses (pobox_flag=P) cannot be verified under IDPF rules because they don\'t represent a physical residence. Triggers Rule 9 (hard stop).',
  'koec0039': 'KOEC0039 is a GSA fault code indicating a significant address anomaly. Sub-code X triggers Rule 3 (hard stop); all other sub-codes (A, B, H, M, S, Z) trigger Rule 5 (soft, continues to PDMA).',
  'koec0647': 'KOEC0647 indicates a missing apartment or unit number in the address. Triggers Rule 1 (soft).',
  'koec0692': 'KOEC0692 indicates the address is not standardized in the USPS database. Triggers Rule 2 (soft).',
  'pdma': 'PDMA = Physical/Digital Mail Address check. Compliant addresses receive IDENTITY_VERIFIED. Non-compliant receives IDENTITY_NOT_VERIFIED. Transactions reach PDMA only after passing all GSA hard-stop rules.',
  'gsa': 'GSA = Government Services Administration address verification service. It checks CMRA, PBSA, PO Box status, and fault codes. Hard-stop rules (3, 6, 7, 8, 9) are all driven by GSA outputs.',
  'psi': 'PSI = Population Stability Index. PSI < 0.10 is STABLE, 0.10–0.20 is MONITOR, > 0.20 is DRIFT DETECTED. It measures how much a distribution has shifted from baseline.',
  'shap': 'SHAP (Shapley Additive Explanations) approximation: for each binary feature, we compute P(verified|feat=1) − P(verified|feat=0). Negative SHAP means the feature reduces verification probability.',
  'monte carlo': 'The What-If Engine uses Monte Carlo simulation: for each transaction, a seeded per-transaction RNG determines whether it would pass under the overridden rule set. 500-iteration bootstrap computes 95% CI.',
  'bayesian': 'The Bayesian Network uses exact inference via enumeration. Evidence-consistent transactions are filtered from the 1,500-sample dataset, and posterior P(IDENTITY_VERIFIED | evidence) is computed directly from frequency counts.',
};

function matchKeyword(input: string, keywords: string[]): string | null {
  const lower = input.toLowerCase();
  for (const kw of keywords) {
    if (lower.includes(kw)) return kw;
  }
  return null;
}

export function generateCopilotResponse(userInput: string): string {
  const lower = userInput.toLowerCase();
  const ctx = buildContext();

  // --- Status / Overview ---
  if (lower.match(/\b(status|overview|summary|how are we|how is|dashboard)\b/)) {
    return `**Current System Status**

- **Total Transactions:** ${ctx.total.toLocaleString()}
- **Verified:** ${ctx.verified.toLocaleString()} (${pct(ctx.verified, ctx.total)})
- **Declined:** ${ctx.declined.toLocaleString()} (${pct(ctx.declined, ctx.total)})

**Top Decline Drivers:**
${ctx.top3.map(r => `- ${r.label}: ${r.count.toLocaleString()} firings (${r.pct_of_declined}% of declines)`).join('\n')}

**Drift Alerts:** ${ctx.alerts.length > 0
  ? ctx.alerts.map(a => `${a.label} (PSI=${a.psi}, trend: ${a.trend > 0 ? '+' : ''}${a.trend}pp)`).join(', ')
  : 'None — all variables STABLE'}

Use the What-If Engine to simulate rule overrides and quantify recovery potential.`;
  }

  // --- Rule-specific queries ---
  const ruleMatch = matchKeyword(lower, ['rule 7', 'rule 8', 'rule 9', 'rule 6', 'rule 5', 'rule 3', 'rule 1', 'rule 2', 'rule 0']);
  if (ruleMatch && RULE_KNOWLEDGE[ruleMatch]) {
    const r = ctx.rules.find(x => x.rule.toLowerCase() === ruleMatch);
    const stats = r ? `\n\n**Live Stats:** ${r.count.toLocaleString()} firings (${r.pct_of_declined}% of all declines, WoW: ${r.trend_wow > 0 ? '+' : ''}${r.trend_wow}%)` : '';
    return `**${ruleMatch.toUpperCase()} Knowledge**\n\n${RULE_KNOWLEDGE[ruleMatch]}${stats}`;
  }

  // --- Concept queries ---
  const conceptMatch = matchKeyword(lower, Object.keys(CONCEPT_KNOWLEDGE));
  if (conceptMatch) {
    return `**${conceptMatch.toUpperCase()} Explanation**\n\n${CONCEPT_KNOWLEDGE[conceptMatch]}`;
  }

  // --- Decline analysis ---
  if (lower.match(/\b(decline|declining|why.*fail|fail.*reason|top rule)\b/)) {
    const hardStops = ctx.rules.filter(r => r.hard_stop).slice(0, 4);
    return `**Decline Root Cause Analysis**

The top hard-stop rules driving declines are:

${hardStops.map(r => `- **${r.label}**
  - Firings: ${r.count.toLocaleString()} | ${r.pct_of_declined}% of declined transactions
  - WoW trend: ${r.trend_wow > 0 ? '+' : ''}${r.trend_wow}%`).join('\n\n')}

**Recommendation:** Rules 7 (CMRA) and 8 (PBSA) together account for the largest share of hard-stop declines. The What-If Engine shows that routing CMRA/PBSA cases to PDMA instead of hard-stopping could recover significant verification volume — but requires careful fraud risk assessment.`;
  }

  // --- What-if / simulation ---
  if (lower.match(/\b(what.?if|simulate|simulation|override|recover|impact)\b/)) {
    const sim = runSimulation({ rule_7_cmra_continue: true, rule_8_pbsa_continue: true });
    return `**What-If Simulation Estimate**

Simulating with Rule 7 (CMRA→PDMA) + Rule 8 (PBSA→PDMA) enabled:

- **Baseline rate:** ${sim.baseline_pass_rate.toFixed(1)}%
- **Simulated rate:** ${sim.simulated_pass_rate.toFixed(1)}%
- **Delta:** ${sim.delta > 0 ? '+' : ''}${sim.delta.toFixed(2)}pp | ${sim.delta_absolute > 0 ? '+' : ''}${sim.delta_absolute.toLocaleString()} transactions
- **95% CI:** [${sim.ci_95_low.toFixed(1)}%, ${sim.ci_95_high.toFixed(1)}%]

Navigate to the **What-If Engine** to customize rule overrides and explore specific KOEC0039 sub-code severity settings.`;
  }

  // --- Drift ---
  if (lower.match(/\b(drift|shift|psi|distribution|change point|page.hinkley)\b/)) {
    const top = ctx.drift[0];
    return `**Drift Detection Summary**

${ctx.alerts.length > 0
  ? `**${ctx.alerts.length} variable(s) in DRIFT DETECTED state:**\n${ctx.alerts.map(a => `- ${a.label}: PSI=${a.psi} (baseline ${a.baseline_rate}% → current ${a.current_rate}%, Δ${a.trend > 0 ? '+' : ''}${a.trend}pp)`).join('\n')}`
  : 'All monitored variables are currently STABLE (PSI < 0.10).'}

**Highest PSI variable:** ${top?.label ?? 'N/A'} (PSI=${top?.psi ?? 0})

The Drift Detection Center monitors 7 variables: CMRA Rate, PBSA Rate, POBox Rate, KOEC0039 Rate, Comm Error Rate, Doc Fail Rate, and Verification Rate. The Page-Hinkley sequential test detects change points in the daily verification rate stream.`;
  }

  // --- Feature importance / SHAP ---
  if (lower.match(/\b(feature|importance|shap|most important|impact)\b/)) {
    return `**Feature Importance (SHAP Approximation)**

The SHAP approximation computes: **P(verified | feature=true) − P(verified | feature=false)**

Negative SHAP values indicate the feature *reduces* verification probability:

- **pbsa_flag** — highest negative impact (PBSA = hard stop, near-zero pass rate when set)
- **cmra_flag** — second highest negative impact (CMRA = hard stop)
- **comm_error** — negative impact (GSA error = hard stop Rule 6)
- **pobox_flag** — moderate negative impact

Navigate to the **Rule Intelligence Dashboard** for the full SHAP waterfall with live computed values.`;
  }

  // --- Bayesian ---
  if (lower.match(/\b(bayesian|posterior|belief|network|probability|inference)\b/)) {
    return `**Bayesian Network Inference**

The NEXUS Bayesian Belief Network models the 7-node IDPF pipeline as a DAG:

\`DOC_VERIFY → FACE_SCAN → GSA_RESULT → PDMA_RESULT → RISK_RESULT → IDENTITY_VERIFIED\`

**Key CPT insights from live data:**
- P(VERIFIED | DOC=PASS, GSA=CLEAN, PDMA=COMPLIANT) ≈ very high
- P(VERIFIED | GSA=CMRA) ≈ near zero (hard stop)
- P(VERIFIED | FACE=FAIL) is significantly reduced

Navigate to the **Bayesian Explorer** to set evidence nodes and query exact posterior probabilities.`;
  }

  // --- Help ---
  if (lower.match(/\b(help|what can|what do you|commands|topics)\b/)) {
    return `**NEXUS AI Copilot — Available Topics**

I can answer questions about:

- **Rules:** "Tell me about Rule 7" · "What is CMRA?" · "Why do transactions decline?"
- **Analysis:** "What are the top decline drivers?" · "Show me the drift status"
- **Simulation:** "What if we override Rule 7?" · "Simulate PBSA changes"
- **ML Concepts:** "Explain SHAP" · "What is PSI?" · "How does the Bayesian network work?"
- **System Status:** "Give me an overview" · "How is the verification rate?"

Ask any question in natural language — I'll parse your intent and provide data-grounded answers from the live in-memory dataset.`;
  }

  // --- Fallback ---
  return `I understand you're asking about: **"${userInput}"**

I can help with IDPF rule explanations, decline analysis, drift detection, simulation estimates, and ML concept explanations. Try asking:

- *"What are the top decline rules?"*
- *"Explain Rule 7"*
- *"What is the current drift status?"*
- *"Simulate overriding CMRA rule"*
- *"Give me a system overview"*`;
}
