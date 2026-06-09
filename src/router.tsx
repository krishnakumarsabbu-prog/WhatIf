import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '@/layouts/AppShell';
import { Dashboard } from '@/pages/Dashboard';
import { Analytics } from '@/pages/Analytics';
import { Intelligence } from '@/pages/Intelligence';
import { Simulate } from '@/pages/Simulate';
import { Copilot } from '@/pages/Copilot';
import { FraudDetection } from '@/pages/FraudDetection';

export function AppRouter() {
  return (
    <AppShell>
      <Routes>
        <Route path="/"             element={<Dashboard />} />
        <Route path="/analytics/*"  element={<Analytics />} />
        <Route path="/intelligence/*" element={<Intelligence />} />
        <Route path="/simulate/*"   element={<Simulate />} />
        <Route path="/copilot"      element={<Copilot />} />
        <Route path="/fraud/*"      element={<FraudDetection />} />
        <Route path="*"             element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
