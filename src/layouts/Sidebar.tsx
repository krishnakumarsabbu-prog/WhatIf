import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, BarChart2, Brain, Zap, Bot, ShieldAlert,
  ChevronRight, type LucideIcon,
} from 'lucide-react';

const NAV_ITEMS = [
  { path: '/',            icon: LayoutDashboard as LucideIcon, label: 'Dashboard',   end: true },
  { path: '/analytics',   icon: BarChart2 as LucideIcon,       label: 'Analytics'          },
  { path: '/intelligence',icon: Brain as LucideIcon,           label: 'Intelligence'       },
  { path: '/simulate',    icon: Zap as LucideIcon,             label: 'Simulate'           },
  { path: '/copilot',     icon: Bot as LucideIcon,             label: 'AI Copilot'         },
];

function NavItem({ path, icon: Icon, label, end = false }: {
  path: string; icon: LucideIcon; label: string; end?: boolean;
}) {
  return (
    <NavLink
      to={path}
      end={end}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 12px',
        borderRadius: 'var(--radius-md)',
        textDecoration: 'none',
        color: isActive ? '#E2E8F0' : 'var(--status-neutral)',
        background: isActive ? 'var(--bg-hover)' : 'transparent',
        borderLeft: isActive ? '2px solid var(--accent-primary)' : '2px solid transparent',
        transition: 'all var(--transition-fast)',
        fontSize: 13,
        fontWeight: isActive ? 600 : 400,
      })}
    >
      {({ isActive }) => (
        <>
          <Icon size={15} color={isActive ? 'var(--accent-primary)' : undefined} />
          <span style={{ flex: 1, whiteSpace: 'nowrap' }}>{label}</span>
          {isActive && <ChevronRight size={11} color="var(--accent-primary)" />}
        </>
      )}
    </NavLink>
  );
}

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
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
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

      {/* Navigation */}
      <div style={{ padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        <div style={{ padding: '4px 12px 8px', fontSize: 9, fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--border-bright)' }}>
          Navigation
        </div>
        {NAV_ITEMS.map(item => (
          <NavItem key={item.path} {...item} />
        ))}
        {/* Fraud Detection section */}
        <div style={{ padding: '10px 12px 4px', fontSize: 9, fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#EF4444', marginTop: 4, borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
          Fraud Detection
        </div>
        <NavItem path="/fraud" icon={ShieldAlert as LucideIcon} label="Fraud Portal" />
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
        <div style={{ color: 'var(--accent-primary)' }}>Phase 2 — Decision Intelligence</div>
      </div>
    </nav>
  );
}
