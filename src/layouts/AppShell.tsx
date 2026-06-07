import { type ReactNode } from 'react';
import { Sidebar } from './Sidebar';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: 'var(--bg-base)',
    }}>
      <Sidebar />

      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        overflow: 'hidden',
      }}>
        {/* Top bar */}
        <header style={{
          height: 52,
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="live-dot" />
            <span style={{
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              color: 'var(--status-pass)',
              letterSpacing: '0.06em',
            }}>LIVE</span>
            <span style={{ fontSize: 11, color: 'var(--border-bright)', marginLeft: 8 }}>
              Identity Decision Analytics Platform
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{
              fontSize: 11, fontFamily: 'var(--font-mono)',
              color: 'var(--status-neutral)',
            }}>
              {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            <div style={{
              padding: '4px 12px',
              borderRadius: 4,
              background: 'var(--accent-muted)',
              border: '1px solid rgba(0,180,216,0.25)',
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              color: 'var(--accent-primary)',
            }}>
              Last 30 Days
            </div>
          </div>
        </header>

        {/* Page content */}
        <main style={{
          flex: 1,
          overflow: 'auto',
          padding: '24px',
        }}>
          {children}
        </main>
      </div>
    </div>
  );
}
