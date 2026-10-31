import React from 'react';
import { PriorityClassification, TraceabilityStatus, ProspectStatus } from '@/types/prospect';
import { FindingSeverity } from '@/types/audit';

interface BadgeProps {
  children?: React.ReactNode;
  variant?: 'priority' | 'traceability' | 'severity' | 'status' | 'custom';
  value?: PriorityClassification | TraceabilityStatus | FindingSeverity | ProspectStatus | string;
  size?: 'sm' | 'md';
  className?: string;
}

export function Badge({
  children,
  variant = 'custom',
  value,
  size = 'md',
  className = '',
}: BadgeProps) {
  let colorClasses = 'bg-zyrvae-800 text-zyrvae-300 border-zyrvae-700';

  if (variant === 'priority' || (value && typeof value === 'string' && value.startsWith('PRIORITY_'))) {
    switch (value) {
      case 'PRIORITY_HIGH':
        colorClasses = 'bg-emerald-950/70 text-emerald-300 border-emerald-700/60';
        break;
      case 'PRIORITY_MEDIUM':
        colorClasses = 'bg-amber-950/70 text-amber-300 border-amber-700/60';
        break;
      case 'PRIORITY_LOW':
        colorClasses = 'bg-slate-900 text-slate-300 border-slate-700';
        break;
      case 'REVIEW_REQUIRED':
        colorClasses = 'bg-purple-950/70 text-purple-300 border-purple-700/60';
        break;
      case 'EXCLUDED_TEST_DATA':
        colorClasses = 'bg-rose-950/70 text-rose-300 border-rose-700/60';
        break;
    }
  } else if (variant === 'traceability') {
    switch (value) {
      case 'CONFIRMED_REAL':
        colorClasses = 'bg-emerald-950/50 text-emerald-400 border-emerald-800/50';
        break;
      case 'TEST_DATA':
        colorClasses = 'bg-rose-950/50 text-rose-400 border-rose-800/50';
        break;
      case 'UNKNOWN_TRACEABILITY':
        colorClasses = 'bg-amber-950/50 text-amber-400 border-amber-800/50';
        break;
      case 'CONTRADICTORY_TRACEABILITY':
        colorClasses = 'bg-purple-950/50 text-purple-400 border-purple-800/50';
        break;
    }
  } else if (variant === 'severity') {
    switch (value) {
      case 'confirmed_problem':
        colorClasses = 'bg-rose-950/70 text-rose-300 border-rose-700/70';
        break;
      case 'warning':
        colorClasses = 'bg-amber-950/70 text-amber-300 border-amber-700/70';
        break;
      case 'unverified':
        colorClasses = 'bg-purple-950/70 text-purple-300 border-purple-700/70';
        break;
      case 'missing_data':
        colorClasses = 'bg-slate-900 text-slate-400 border-slate-700';
        break;
      case 'audit_error':
        colorClasses = 'bg-red-950/80 text-red-200 border-red-700';
        break;
    }
  } else if (variant === 'status') {
    switch (value) {
      case 'validated':
        colorClasses = 'bg-emerald-950/50 text-emerald-300 border-emerald-700/50';
        break;
      case 'pending_review':
        colorClasses = 'bg-amber-950/50 text-amber-300 border-amber-700/50';
        break;
      case 'rejected':
        colorClasses = 'bg-rose-950/50 text-rose-300 border-rose-700/50';
        break;
      case 'imported':
        colorClasses = 'bg-zyrvae-800 text-zyrvae-300 border-zyrvae-700';
        break;
    }
  }

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center font-medium rounded-md border tracking-wide transition-colors ${sizeClasses} ${colorClasses} ${className}`}
    >
      {children || value}
    </span>
  );
}
