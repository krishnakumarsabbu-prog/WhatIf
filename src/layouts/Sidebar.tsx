import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, GitBranch, Network, Zap,
  Bot, Shield, TrendingUp, Search, ChevronRight,
} from 'lucide-react';

const navItems = [
  { path: '/',           icon: LayoutDashboard, label: 'Command Center',       shortLabel: 'Dashboard' },
  { path: '/sankey',     icon: GitBranch,       label: 'Journey Analytics',    shortLabel: 'Sankey' },
  { path: '/bayesian',   icon: Network,         label: 'Bayesian Explorer',    shortLabel: 'Bayesian' },
  { path: '/whatif',     icon: Zap,             label: 'What-If Engine',       shortLabel: 'What-If' },
  { path: '/copilot',    icon: Bot,             label: 'AI Copilot',           shortLabel: 'Copilot' },
  { path: '/rules',      icon: Shield,          label: 'Rule Intelligence',    shortLabel: 'Rules' },
  { path: '/drift',      icon: TrendingUp,      label: 'Drift Detection',      shortLabel: 'Drift' },
  { path: '/analyzer',   icon: Search,          label: 'Request Analyzer',     shortLabel: 'Analyzer' },
];

export function Sidebar() {
  return (
    <nav style={{
      width: 220,
      minHeight: '100vh',
      background: 'var(--grad-sidebar)',
      borderRight: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{
        padding: '20px 20px 16px',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #00B4D8 0%, #0284C7 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--glow-accent)',
            flexShrink: 0,
          }}>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 14,
              color: '#fff',
              letterSpacing: '-0.02em',
            }}>N</span>
          </div>
          <div>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 14,
              letterSpacing: '0.06em',
              color: '#E2E8F0',
            }}>NEXUS</div>
            <div style={{
              fontSize: 9,
              fontFamily: 'var(--font-mono)',
              color: 'var(--accent-primary)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}>IDP · v1.0</div>
          </div>
        </div>
      </div>

      {/* Section label */}
      <div style={{
        padding: '14px 20px 6px',
        fontSize: 9,
        fontFamily: 'var(--font-display)',
        fontWeight: 600,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: 'var(--border-bright)',
      }}>
        Analytics
      </div>

      {/* Nav items */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, padding: '0 10px' }}>
        {navItems.map(({ path, icon: Icon, label }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 10px',
              borderRadius: 'var(--radius-md)',
              textDecoration: 'none',
              color: isActive ? '#E2E8F0' : 'var(--status-neutral)',
              background: isActive ? 'var(--bg-hover)' : 'transparent',
              borderLeft: isActive ? '2px solid var(--accent-primary)' : '2px solid transparent',
              transition: 'all var(--transition-fast)',
              fontSize: 13,
              fontWeight: isActive ? 500 : 400,
            })}
          >
            {({ isActive }) => (
              <>
                <Icon size={15} color={isActive ? 'var(--accent-primary)' : undefined} />
                <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {label}
                </span>
                {isActive && <ChevronRight size={12} color="var(--accent-primary)" style={{ flexShrink: 0 }} />}
              </>
            )}
          </NavLink>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        padding: '12px 20px',
        borderTop: '1px solid var(--border-subtle)',
        fontSize: 10,
        fontFamily: 'var(--font-mono)',
        color: 'var(--border-bright)',
        lineHeight: 1.6,
      }}>
        <div>IDPF Intelligence Portal</div>
        <div style={{ color: 'var(--accent-dim)' }}>Phase 1 — Foundation</div>
      </div>
    </nav>
  );
}
