'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from '@/lib/i18n/context';
import {
  LayoutDashboard,
  Users,
  Globe,
  Award,
  TrendingUp,
  AlertTriangle,
  Server,
  ShieldCheck,
} from 'lucide-react';

interface SidebarProps {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export function Sidebar({ mobileOpen, setMobileOpen }: SidebarProps) {
  const pathname = usePathname();
  const { t } = useTranslation();

  const navItems = [
    { href: '/overview', label: t.nav.overview, icon: LayoutDashboard },
    { href: '/prospects', label: t.nav.prospects, icon: Users },
    { href: '/audits', label: t.nav.audits, icon: Globe },
    { href: '/qualification', label: t.nav.qualification, icon: Award },
    { href: '/insights', label: t.nav.insights, icon: TrendingUp },
    { href: '/errors', label: t.nav.errors, icon: AlertTriangle },
    { href: '/system', label: t.nav.system, icon: Server },
  ];

  const closeMobile = () => setMobileOpen(false);

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden"
          onClick={closeMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-zyrvae-950 border-r border-zyrvae-800/90 flex flex-col transition-transform duration-300 lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-6 border-b border-zyrvae-800/80 flex items-center justify-between">
          <Link href="/overview" onClick={closeMobile} className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-electric to-blue-700 flex items-center justify-center shadow-glow">
              <span className="text-white font-bold text-sm tracking-wider">Z</span>
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-zyrvae-100 flex items-center gap-1.5">
                ZYRVAE
                <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-zyrvae-800 text-electric border border-zyrvae-700">
                  INTEL
                </span>
              </div>
              <p className="text-[10px] text-zyrvae-500 tracking-wider uppercase font-mono">
                Digital Studio
              </p>
            </div>
          </Link>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/overview' && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeMobile}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all group ${
                  isActive
                    ? 'bg-zyrvae-850 text-zyrvae-100 border border-zyrvae-750/90 shadow-subtle'
                    : 'text-zyrvae-400 hover:text-zyrvae-200 hover:bg-zyrvae-900/60'
                }`}
              >
                <Icon
                  className={`w-4 h-4 transition-colors ${
                    isActive ? 'text-electric' : 'text-zyrvae-500 group-hover:text-zyrvae-300'
                  }`}
                />
                <span className="tracking-wide">{item.label}</span>
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-electric shadow-glow" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Security & System Pill Footer */}
        <div className="p-4 border-t border-zyrvae-800/80 bg-zyrvae-950">
          <div className="p-3 rounded-lg bg-zyrvae-900 border border-zyrvae-800 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-tight">
              <span className="font-medium text-zyrvae-200 block">
                {t.common.readOnlyMode}
              </span>
              <span className="text-[10px] text-zyrvae-500 block mt-0.5">
                Cero escrituras activas
              </span>
            </div>
          </div>
          <div className="mt-2 text-center">
            <span className="text-[10px] font-mono text-zyrvae-600">
              v1.0.0 • ZYRVAE OPS
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
