'use client';

import React from 'react';
import { useTranslation } from '@/lib/i18n/context';
import { Menu, Globe } from 'lucide-react';
import { DashboardMode } from '@/types/system';

interface HeaderProps {
  onMenuToggle: () => void;
  isSynthetic?: boolean;
  mode?: DashboardMode;
}

export function Header({
  onMenuToggle,
  isSynthetic = true,
  mode = 'DEMO',
}: HeaderProps) {
  const { language, setLanguage, t } = useTranslation();
  const isDemo = mode === 'DEMO' || isSynthetic;

  return (
    <header className="h-16 px-4 lg:px-8 border-b border-zyrvae-800/80 bg-zyrvae-950/80 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between">
      {/* Left: Mobile hamburger & branding */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuToggle}
          className="p-2 -ml-2 text-zyrvae-400 hover:text-zyrvae-200 lg:hidden focus:outline-none"
          aria-label="Abrir navegación móvil"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="hidden sm:block">
          <span className="text-xs font-mono text-zyrvae-500 uppercase tracking-wider">
            ZYRVAE Digital Studio
          </span>
          <span className="text-xs text-zyrvae-600 mx-2">/</span>
          <span className="text-xs text-zyrvae-300 font-medium">
            Intelligence Operations
          </span>
        </div>
      </div>

      {/* Right: Badges, Language Switcher, Controls */}
      <div className="flex items-center gap-3">
        {/* Environment Badge */}
        <div className="hidden sm:flex items-center">
          {isDemo ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-medium bg-blue-950/70 text-blue-300 border border-blue-800/60 shadow-subtle">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              {t.common.syntheticBadge}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-medium bg-emerald-950/70 text-emerald-300 border border-emerald-800/60 shadow-subtle">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              {t.common.liveBadge}
            </span>
          )}
        </div>

        {/* Language Switcher */}
        <div className="flex items-center bg-zyrvae-900 border border-zyrvae-750/90 rounded-lg p-0.5">
          <Globe className="w-3.5 h-3.5 text-zyrvae-500 ml-2 mr-1" />
          <button
            type="button"
            onClick={() => setLanguage('es')}
            className={`px-2 py-1 text-xs font-mono rounded font-medium transition-colors ${
              language === 'es'
                ? 'bg-electric text-white shadow-subtle'
                : 'text-zyrvae-400 hover:text-zyrvae-200'
            }`}
            aria-label="Cambiar idioma a Español"
          >
            ES
          </button>
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={`px-2 py-1 text-xs font-mono rounded font-medium transition-colors ${
              language === 'en'
                ? 'bg-electric text-white shadow-subtle'
                : 'text-zyrvae-400 hover:text-zyrvae-200'
            }`}
            aria-label="Switch language to English"
          >
            EN
          </button>
        </div>
      </div>
    </header>
  );
}
