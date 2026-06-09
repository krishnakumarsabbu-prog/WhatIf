import { useNavigate, useLocation, Routes, Route, Navigate } from 'react-router-dom';
import { IntelligenceOverview } from '@/pages/DecisionIntelligence/Overview';
import { DecisionGraph } from '@/pages/DecisionIntelligence/DecisionGraph';
import { RuleImpactAnalysis } from '@/pages/DecisionIntelligence/RuleImpact';
import { PopulationIntelligence } from '@/pages/DecisionIntelligence/PopulationIntelligence';
import { Recommendations } from '@/pages/DecisionIntelligence/Recommendations';
import { DecisionReplay } from '@/pages/DecisionIntelligence/DecisionReplay';
import { ExplainDecline } from '@/pages/DecisionIntelligence/ExplainDecline';
import { RuleTimeline } from '@/pages/DecisionIntelligence/RuleTimeline';
import { PolicyOptimization } from '@/pages/DecisionIntelligence/PolicyOptimization';
import { Brain, GitBranch, ChartBar as BarChart2, Users, Lightbulb, Play, FileSearch, Clock, Target } from 'lucide-react';

const SUB_TABS = [
  { id: '',          label: 'Overview',        icon: Brain,        path: '/intelligence' },
  { id: 'graph',     label: 'Decision Graph',  icon: GitBranch,    path: '/intelligence/graph' },
  { id: 'impact',    label: 'Rule Impact',     icon: BarChart2,    path: '/intelligence/impact' },
  { id: 'population',label: 'Population',      icon: Users,        path: '/intelligence/population' },
  { id: 'recs',      label: 'Recommendations', icon: Lightbulb,    path: '/intelligence/recs' },
  { id: 'replay',    label: 'Replay',          icon: Play,         path: '/intelligence/replay' },
  { id: 'explain',   label: 'Explain Decline', icon: FileSearch,   path: '/intelligence/explain' },
  { id: 'timeline',  label: 'Rule Timeline',   icon: Clock,        path: '/intelligence/timeline' },
  { id: 'optimize',  label: 'Optimization',    icon: Target,       path: '/intelligence/optimize' },
];

function SubNav() {
  const location = useLocation();
  const navigate = useNavigate();

  const active = SUB_TABS.find(t => {
    if (t.id === '') return location.pathname === '/intelligence' || location.pathname === '/intelligence/';
    return location.pathname.startsWith(t.path);
  })?.id ?? '';

  return (
    <div style={{
      display: 'flex',
      gap: 2,
      overflowX: 'auto',
      background: 'var(--bg-surface)',
      borderRadius: 10,
      padding: 4,
      border: '1px solid var(--border-subtle)',
      marginBottom: 20,
      flexShrink: 0,
    }}>
      {SUB_TABS.map(tab => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            onClick={() => navigate(tab.path)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              padding: '7px 10px',
              borderRadius: 7,
              cursor: 'pointer',
              border: 'none',
              background: isActive ? 'var(--bg-elevated)' : 'transparent',
              color: isActive ? 'var(--accent-primary)' : 'var(--status-neutral)',
              fontSize: 11,
              fontWeight: isActive ? 600 : 400,
              fontFamily: 'var(--font-body)',
              transition: 'all var(--transition-fast)',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
            }}
          >
            <tab.icon size={12} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function Intelligence() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', animation: 'fade-in 0.3s ease' }}>
      <SubNav />
      <Routes>
        <Route index        element={<IntelligenceOverview />} />
        <Route path="graph"      element={<DecisionGraph />} />
        <Route path="impact"     element={<RuleImpactAnalysis />} />
        <Route path="population" element={<PopulationIntelligence />} />
        <Route path="recs"       element={<Recommendations />} />
        <Route path="replay"     element={<DecisionReplay />} />
        <Route path="explain"    element={<ExplainDecline />} />
        <Route path="timeline"   element={<RuleTimeline />} />
        <Route path="optimize"   element={<PolicyOptimization />} />
      </Routes>
    </div>
  );
}
