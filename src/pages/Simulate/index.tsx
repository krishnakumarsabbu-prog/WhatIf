import { useNavigate, useLocation, Routes, Route } from 'react-router-dom';
import { WhatIfEngine } from '@/pages/WhatIfEngine';
import { RequestAnalyzer } from '@/pages/RequestAnalyzer';
import { Zap, FileSearch } from 'lucide-react';

const TABS = [
  { id: '',         label: 'What-If Engine',    icon: Zap,        path: '/simulate' },
  { id: 'analyzer', label: 'Request Analyzer',  icon: FileSearch, path: '/simulate/analyzer' },
];

function TabBar() {
  const location = useLocation();
  const navigate = useNavigate();

  const active = TABS.find(t => {
    if (t.id === '') return location.pathname === '/simulate' || location.pathname === '/simulate/';
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
      width: 'fit-content',
    }}>
      {TABS.map(tab => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            onClick={() => navigate(tab.path)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              padding: '9px 20px',
              borderRadius: 8,
              cursor: 'pointer',
              border: 'none',
              background: isActive ? 'var(--bg-elevated)' : 'transparent',
              color: isActive ? 'var(--accent-primary)' : 'var(--status-neutral)',
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              fontFamily: 'var(--font-body)',
              transition: 'all var(--transition-fast)',
              boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
            }}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function Simulate() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', animation: 'fade-in 0.3s ease' }}>
      <TabBar />
      <Routes>
        <Route index           element={<WhatIfEngine />} />
        <Route path="analyzer" element={<RequestAnalyzer />} />
      </Routes>
    </div>
  );
}
