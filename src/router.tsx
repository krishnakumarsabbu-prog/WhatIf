import { Routes, Route } from 'react-router-dom';
import { AppShell } from '@/layouts/AppShell';
import { Dashboard } from '@/pages/Dashboard';
import { SankeyJourney } from '@/pages/SankeyJourney';
import { BayesianExplorer } from '@/pages/BayesianExplorer';
import { WhatIfEngine } from '@/pages/WhatIfEngine';
import { AICopilot } from '@/pages/AICopilot';
import { RuleIntelligence } from '@/pages/RuleIntelligence';
import { DriftDetection } from '@/pages/DriftDetection';
import { RequestAnalyzer } from '@/pages/RequestAnalyzer';
import { IntelligenceOverview } from '@/pages/DecisionIntelligence/Overview';
import { DecisionGraph } from '@/pages/DecisionIntelligence/DecisionGraph';
import { RuleImpactAnalysis } from '@/pages/DecisionIntelligence/RuleImpact';
import { PopulationIntelligence } from '@/pages/DecisionIntelligence/PopulationIntelligence';
import { Recommendations } from '@/pages/DecisionIntelligence/Recommendations';
import { DecisionReplay } from '@/pages/DecisionIntelligence/DecisionReplay';
import { ExplainDecline } from '@/pages/DecisionIntelligence/ExplainDecline';
import { RuleTimeline } from '@/pages/DecisionIntelligence/RuleTimeline';
import { PolicyOptimization } from '@/pages/DecisionIntelligence/PolicyOptimization';

export function AppRouter() {
  return (
    <AppShell>
      <Routes>
        {/* Existing routes */}
        <Route path="/"         element={<Dashboard />} />
        <Route path="/sankey"   element={<SankeyJourney />} />
        <Route path="/bayesian" element={<BayesianExplorer />} />
        <Route path="/whatif"   element={<WhatIfEngine />} />
        <Route path="/copilot"  element={<AICopilot />} />
        <Route path="/rules"    element={<RuleIntelligence />} />
        <Route path="/drift"    element={<DriftDetection />} />
        <Route path="/analyzer" element={<RequestAnalyzer />} />

        {/* Decision Intelligence routes */}
        <Route path="/di/overview"   element={<IntelligenceOverview />} />
        <Route path="/di/graph"      element={<DecisionGraph />} />
        <Route path="/di/impact"     element={<RuleImpactAnalysis />} />
        <Route path="/di/population" element={<PopulationIntelligence />} />
        <Route path="/di/recs"       element={<Recommendations />} />
        <Route path="/di/replay"     element={<DecisionReplay />} />
        <Route path="/di/explain"    element={<ExplainDecline />} />
        <Route path="/di/timeline"   element={<RuleTimeline />} />
        <Route path="/di/optimize"   element={<PolicyOptimization />} />
      </Routes>
    </AppShell>
  );
}
