import { Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import { useFraudStore } from '@/store/fraudStore';
import { FraudDashboard } from './FraudDashboard';
import { TransactionAnalysis } from './TransactionAnalysis';
import { WhatIfAnalysis } from './WhatIfAnalysis';
import { RealRequest } from './RealRequest';
import { AlertCenter } from './AlertCenter';
import { LayoutDashboard, Search, FlaskConical, Wifi, Bell } from 'lucide-react';

const TABS = [
  { path: '/fraud',          icon: LayoutDashboard, label: 'Dashboard',            end: true  },
  { path: '/fraud/analyze',  icon: Search,          label: 'Transaction Analysis',  end: false },
  { path: '/fraud/whatif',   icon: FlaskConical,    label: 'What-If Analysis',      end: false },
  { path: '/fraud/live',     icon: Wifi,            label: 'Real Request',          end: false },
  { path: '/fraud/alerts',   icon: Bell,            label: 'Alert Center',          end: false },
];

export function FraudDetection() {
  const { mode, setMode, alerts } = useFraudStore();
  const unacked = alerts.filter(a => !a.acknowledged).length;
  const location = useLocation();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%', minHeight: 0 }}>

      {/* Page Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444', boxShadow: '0 0 8px rgba(239,68,68,0.8)', animation: 'pulse-opacity 2s ease infinite' }} />
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: '#E2E8F0' }}>
                Fraud Detection Portal
              </h1>
            </div>
            <p style={{ fontSize: 12, color: 'var(--status-neutral)' }}>
              4-layer fraud detection pipeline: Rules → Feature Engineering → ML Algorithms → Explainability
            </p>
          </div>

          {/* Mode Toggle — always visible */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 16px', borderRadius: 10,
            background: mode === 'synthetic' ? 'rgba(139,92,246,0.1)' : 'rgba(74,222,128,0.1)',
            border: `1px solid ${mode === 'synthetic' ? 'rgba(139,92,246,0.3)' : 'rgba(74,222,128,0.3)'}`,
          }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 9, color: 'var(--status-neutral)', fontFamily: 'var(--font-mono)', marginBottom: 1 }}>DATA MODE</div>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: mode === 'synthetic' ? '#A78BFA' : '#4ADE80' }}>
                {mode === 'synthetic' ? 'SYNTHETIC DATA' : 'LIVE API'}
              </div>
            </div>
            <button
              onClick={() => setMode(mode === 'synthetic' ? 'live' : 'synthetic')}
              style={{
                width: 48, height: 26, borderRadius: 13, position: 'relative', cursor: 'pointer',
                background: mode === 'synthetic' ? '#8B5CF6' : '#22C55E',
                border: 'none', transition: 'background 0.3s',
                boxShadow: mode === 'synthetic' ? '0 0 8px rgba(139,92,246,0.6)' : '0 0 8px rgba(34,197,94,0.6)',
              }}
            >
              <span style={{
                position: 'absolute', top: 3, width: 20, height: 20, borderRadius: '50%', background: '#fff',
                left: mode === 'synthetic' ? 4 : 24, transition: 'left 0.3s',
              }} />
            </button>
          </div>
        </div>

        {/* Sub-navigation */}
        <div style={{ display: 'flex', gap: 2, padding: '4px', background: 'var(--bg-elevated)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
          {TABS.map(tab => {
            const isActive = tab.end
              ? location.pathname === tab.path
              : location.pathname.startsWith(tab.path);
            return (
              <NavLink
                key={tab.path}
                to={tab.path}
                end={tab.end}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '7px 10px', borderRadius: 8, textDecoration: 'none',
                  background: isActive ? 'linear-gradient(135deg, rgba(239,68,68,0.18) 0%, rgba(239,68,68,0.08) 100%)' : 'transparent',
                  border: isActive ? '1px solid rgba(239,68,68,0.3)' : '1px solid transparent',
                  color: isActive ? '#FCA5A5' : 'var(--status-neutral)',
                  fontSize: 12, fontWeight: isActive ? 600 : 400,
                  transition: 'all 0.15s', whiteSpace: 'nowrap',
                  position: 'relative',
                }}
              >
                <tab.icon size={13} color={isActive ? '#FCA5A5' : undefined} />
                <span>{tab.label}</span>
                {tab.label === 'Alert Center' && unacked > 0 && (
                  <span style={{
                    position: 'absolute', top: 4, right: 8,
                    width: 16, height: 16, borderRadius: '50%',
                    background: '#EF4444', color: '#fff',
                    fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{unacked > 9 ? '9+' : unacked}</span>
                )}
              </NavLink>
            );
          })}
        </div>
      </div>

      {/* Page content */}
      <Routes>
        <Route index element={<FraudDashboard />} />
        <Route path="analyze" element={<TransactionAnalysis />} />
        <Route path="whatif"  element={<WhatIfAnalysis />} />
        <Route path="live"    element={<RealRequest />} />
        <Route path="alerts"  element={<AlertCenter />} />
        <Route path="*"       element={<Navigate to="/fraud" replace />} />
      </Routes>
    </div>
  );
}
