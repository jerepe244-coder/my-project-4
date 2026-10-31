import React from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  variant?: 'default' | 'accent' | 'warning' | 'error' | 'success';
  className?: string;
}

export function MetricCard({
  title,
  value,
  description,
  icon,
  badge,
  variant = 'default',
  className = '',
}: MetricCardProps) {
  let accentBorder = 'border-zyrvae-750/80';
  let valueColor = 'text-zyrvae-100';

  if (variant === 'accent') {
    accentBorder = 'border-electric/40 hover:border-electric/70';
    valueColor = 'text-blue-400';
  } else if (variant === 'warning') {
    accentBorder = 'border-amber-700/40 hover:border-amber-600/60';
    valueColor = 'text-amber-400';
  } else if (variant === 'error') {
    accentBorder = 'border-rose-700/40 hover:border-rose-600/60';
    valueColor = 'text-rose-400';
  } else if (variant === 'success') {
    accentBorder = 'border-emerald-700/40 hover:border-emerald-600/60';
    valueColor = 'text-emerald-400';
  }

  return (
    <div
      className={`bg-zyrvae-900 border ${accentBorder} rounded-xl p-5 shadow-subtle transition-all duration-200 hover:shadow-card ${className}`}
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="text-xs font-medium text-zyrvae-400 tracking-wider uppercase">
          {title}
        </span>
        {icon && <div className="text-zyrvae-400 shrink-0">{icon}</div>}
      </div>

      <div className="flex items-baseline justify-between gap-2 mt-1">
        <div className={`text-3xl font-bold font-mono tracking-tight ${valueColor}`}>
          {value}
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
      </div>

      {description && (
        <p className="text-xs text-zyrvae-500 mt-2 leading-relaxed">
          {description}
        </p>
      )}
    </div>
  );
}
