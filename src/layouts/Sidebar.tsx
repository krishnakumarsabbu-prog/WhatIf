import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, GitBranch, Network, Zap, Bot, Shield, TrendingUp, Search, ChevronRight, ChevronDown, Brain, ChartBar as BarChart3, Users, Lightbulb, Play, FileSearch, Clock, Target, Settings } from 'lucide-react';

const analyticsItems = [
  { path: '/',         icon: LayoutDashboard, label: 'Command Center'    },
  { path: '/sankey',   icon: GitBranch,       label: 'Journey Analytics' },
  { path: '/bayesian', icon: Network,         label: 'Bayesian Explorer' },
  { path: '/whatif',   icon: Zap,             label: 'What-If Engine'    },
  { path: '/copilot',  icon: Bot,             label: 'AI Copilot'        },
  { path: '/rules',    icon: Shield,          label: 'Rule Intelligence' },
  { path: '/drift',    icon: TrendingUp,      label: 'Drift Detection'   },
  { path: '/analyzer', icon: Search,          label: 'Request Analyzer'  },
];

const intelligenceItems = [
  { path: '/di/overview',    icon: Brain,       label: 'Overview'              },
  { path: '/di/graph',       icon: GitBranch,   label: 'Decision Graph'        },
  { path: '/di/impact',      icon: BarChart3,   label: 'Rule Impact Analysis'  },
  { path: '/di/population',  icon: Users,       label: 'Population Intel.'     },
  { path: '/di/recs',        icon: Lightbulb,   label: 'Recommendations'       },
  { path: '/di/replay',      icon: Play,        label: 'Decision Replay'       },
  { path: '/di/explain',     icon: FileSearch,  label: 'Explain My Decline'    },
  { path: '/di/timeline',    icon: Clock,       label: 'Rule Timeline'         },
  { path: '/di/optimize',    icon: Target,      label: 'Policy Optimization'   },
];

function NavItem({ path, icon: Icon, label, end = false }: { path: string; icon: any; label: string; end?: boolean }) {
  return (
    <NavLink
      to={path}
      end={end}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '7px 10px',
        borderRadius: 'var(--radius-md)',
        textDecoration: 'none',
        color: isActive ? '#E2E8F0' : 'var(--status-neutral)',
        background: isActive ? 'var(--bg-hover)' : 'transparent',
        borderLeft: isActive ? '2px solid var(--accent-primary)' : '2px solid transparent',
        transition: 'all var(--transition-fast)',
        fontSize: 12,
        fontWeight: isActive ? 500 : 400,
      })}
    >
      {({ isActive }) => (
        <>
          <Icon size={14} color={isActive ? 'var(--accent-primary)' : undefined} />
          <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {label}
          </span>
          {isActive && <ChevronRight size={11} color="var(--accent-primary)" style={{ flexShrink: 0 }} />}
        </>
      )}
    </NavLink>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{
      padding: '12px 20px 5px',
      fontSize: 9,
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      color: 'var(--border-bright)',
    }}>
      {label}
    </div>
  );
}

export function Sidebar() {
  const [diExpanded, setDiExpanded] = useState(true);

  return (
    <nav style={{
      width: 220,
      minHeight: '100vh',
      background: 'var(--grad-sidebar)',
      borderRight: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      overflowY: 'auto',
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #00B4D8 0%, #0284C7 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--glow-accent)', flexShrink: 0,
          }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, color: '#fff', letterSpacing: '-0.02em' }}>N</span>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, letterSpacing: '0.06em', color: '#E2E8F0' }}>NEXUS</div>
            <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>IDP · v2.0</div>
          </div>
        </div>
      </div>

      {/* Analytics Section */}
      <SectionLabel label="Analytics" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, padding: '0 10px' }}>
        {analyticsItems.map(item => (
          <NavItem key={item.path} path={item.path} icon={item.icon} label={item.label} end={item.path === '/'} />
        ))}
      </div>

      {/* Decision Intelligence Section */}
      <div style={{ padding: '12px 20px 5px', flexShrink: 0 }}>
        <button
          onClick={() => setDiExpanded(v => !v)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
          }}
        >
          <span style={{
            fontSize: 9, fontFamily: 'var(--font-display)', fontWeight: 600,
            letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--accent-primary)',
          }}>
            Decision Intelligence
          </span>
          <ChevronDown size={11} color="var(--accent-primary)" style={{ transform: diExpanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }} />
        </button>
      </div>

      {diExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, padding: '0 10px' }}>
          {intelligenceItems.map(item => (
            <NavItem key={item.path} path={item.path} icon={item.icon} label={item.label} />
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{
        padding: '12px 20px',
        borderTop: '1px solid var(--border-subtle)',
        fontSize: 10,
        fontFamily: 'var(--font-mono)',
        color: 'var(--border-bright)',
        lineHeight: 1.6,
        marginTop: 'auto',
      }}>
        <div>IDPF Intelligence Portal</div>
        <div style={{ color: 'var(--accent-primary)' }}>Phase 2 — Decision Intelligence</div>
      </div>
    </nav>
  );
}
