import { useState } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { SankeyJourney } from '@/pages/SankeyJourney';
import { DriftDetection } from '@/pages/DriftDetection';
import { RuleIntelligence } from '@/pages/RuleIntelligence';
import { BayesianExplorer } from '@/pages/BayesianExplorer';
import { GitBranch, Activity, Shield, Network } from 'lucide-react';

const TABS = [
  { id: '',        label: 'Journey Flow',    icon: GitBranch, path: '/analytics' },
  { id: 'drift',   label: 'Drift Detection', icon: Activity,  path: '/analytics/drift' },
  { id: 'rules',   label: 'Rule Intelligence', icon: Shield,  path: '/analytics/rules' },
  { id: 'bayesian',label: 'Bayesian Explorer', icon: Network, path: '/analytics/bayesian' },
];

function TabBar() {
  const location = useLocation();
  const navigate = useNavigate();

  const active = TABS.find(t => {
    if (t.id === '') return location.pathname === '/analytics' || location.pathname === '/analytics/';
    return location.pathname.startsWith(t.path);
  })?.id ?? '';

  return (
    <div style={{
      display: 'flex',
      gap: 2,
      background: 'var(--bg-surface)',
      borderRadius: 10,
      padding: 4,
      border: '1px solid var(--border-subtle)',
      marginBottom: 20,
    }}>
      {TABS.map(tab => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            onClick={() => navigate(tab.path)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              padding: '9px 12px',
              borderRadius: 8,
              cursor: 'pointer',
              border: 'none',
              background: isActive ? 'var(--bg-elevated)' : 'transparent',
              color: isActive ? 'var(--accent-primary)' : 'var(--status-neutral)',
              fontSize: 12,
              fontWeight: isActive ? 600 : 400,
              fontFamily: 'var(--font-body)',
              transition: 'all var(--transition-fast)',
              boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
            }}
          >
            <tab.icon size={13} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function Analytics() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', animation: 'fade-in 0.3s ease' }}>
      <TabBar />
      <Routes>
        <Route index    element={<SankeyJourney />} />
        <Route path="drift"    element={<DriftDetection />} />
        <Route path="rules"    element={<RuleIntelligence />} />
        <Route path="bayesian" element={<BayesianExplorer />} />
      </Routes>
    </div>
  );
}
