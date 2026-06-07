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

export function AppRouter() {
  return (
    <AppShell>
      <Routes>
        <Route path="/"         element={<Dashboard />} />
        <Route path="/sankey"   element={<SankeyJourney />} />
        <Route path="/bayesian" element={<BayesianExplorer />} />
        <Route path="/whatif"   element={<WhatIfEngine />} />
        <Route path="/copilot"  element={<AICopilot />} />
        <Route path="/rules"    element={<RuleIntelligence />} />
        <Route path="/drift"    element={<DriftDetection />} />
        <Route path="/analyzer" element={<RequestAnalyzer />} />
      </Routes>
    </AppShell>
  );
}
