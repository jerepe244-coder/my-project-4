'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { DashboardMode } from '@/types/system';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mode, setMode] = useState<DashboardMode>('DEMO');
  const [isSynthetic, setIsSynthetic] = useState(true);

  useEffect(() => {
    async function checkMode() {
      try {
        const res = await fetch('/api/system/status');
        const json = await res.json();
        if (json.data) {
          setMode(json.data.mode || (json.data.is_synthetic_mode ? 'DEMO' : 'LIVE_READ_ONLY'));
          setIsSynthetic(Boolean(json.data.is_synthetic_mode));
        }
      } catch {
        // Fallback to safe DEMO defaults
      }
    }
    checkMode();
  }, []);

  return (
    <div className="min-h-screen bg-zyrvae-950 text-zyrvae-100 flex flex-col antialiased selection:bg-electric selection:text-white">
      {/* Sidebar */}
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      {/* Main Content Area */}
      <div className="lg:pl-64 flex flex-col flex-1 min-w-0">
        <Header
          onMenuToggle={() => setMobileOpen(!mobileOpen)}
          mode={mode}
          isSynthetic={isSynthetic}
        />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
