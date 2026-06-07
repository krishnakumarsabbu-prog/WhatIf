import { Routes, Route } from 'react-router-dom';
import { AppShell } from '@/layouts/AppShell';
import { Dashboard } from '@/pages/Dashboard';
import { SankeyJourney } from '@/pages/SankeyJourney';
import { ComingSoon } from '@/pages/ComingSoon';

export function AppRouter() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/sankey" element={<SankeyJourney />} />
        <Route
          path="/bayesian"
          element={
            <ComingSoon
              title="Bayesian Dependency Explorer"
              description="Interactive Bayesian Belief Network visualization with Variable Elimination inference. Set evidence across service nodes and see posterior probabilities update in real time."
              algorithm="Bayesian Belief Network (pgmpy)"
              category="Probabilistic"
            />
          }
        />
        <Route
          path="/whatif"
          element={
            <ComingSoon
              title="What-If Simulation Engine"
              description="Toggle rule overrides (Rule 7 CMRA→PDMA, Rule 8 PBSA→PDMA, populateResult relaxation) and see Monte Carlo simulated impact on onboarding rate with 95% confidence intervals."
              algorithm="Monte Carlo + Counterfactual Resampling"
              category="Simulation"
            />
          }
        />
        <Route
          path="/copilot"
          element={
            <ComingSoon
              title="AI Copilot — NEXUS Intelligence"
              description="Conversational Claude-powered analyst that understands the full IDPF rule system, explains individual transaction declines with SHAP values, and recommends the highest-ROI rule changes."
              algorithm="Claude API + RAG"
              category="LLM"
              phase="Phase 3"
            />
          }
        />
        <Route
          path="/rules"
          element={
            <ComingSoon
              title="Rule Intelligence Dashboard"
              description="Per-rule firing frequency, outcome distribution, SHAP feature importance (XGBoost), and 7-day firing trend analysis. Identifies over-triggering and high-impact rules."
              algorithm="XGBoost + SHAP TreeExplainer"
              category="Supervised ML"
            />
          }
        />
        <Route
          path="/drift"
          element={
            <ComingSoon
              title="Drift Detection Center"
              description="PSI, KL Divergence, KS Test, and Page-Hinkley sequential monitoring for all IDPF input variable distributions. Fires alerts when cmra_rate, pbsa_rate, or koec0039_rate shift significantly."
              algorithm="PSI + KL Divergence + Page-Hinkley"
              category="Drift Detection"
            />
          }
        />
        <Route
          path="/analyzer"
          element={
            <ComingSoon
              title="Request / Response Analyzer"
              description="Paste or upload any IDPF request/response JSON. The system traces which rules fired, generates a SHAP waterfall for that specific transaction, and runs a What-If quick analysis."
              algorithm="SHAP TreeExplainer + Rule Trace"
              category="Explainability"
              phase="Phase 3"
            />
          }
        />
      </Routes>
    </AppShell>
  );
}
