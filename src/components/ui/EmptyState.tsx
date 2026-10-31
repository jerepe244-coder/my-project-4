import React from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-12 text-center border border-dashed border-zyrvae-750/70 rounded-xl bg-zyrvae-950/30 ${className}`}
    >
      <div className="w-12 h-12 rounded-full bg-zyrvae-850 flex items-center justify-center text-zyrvae-400 mb-4 border border-zyrvae-750">
        {icon || <Inbox className="w-6 h-6 text-zyrvae-500" />}
      </div>
      <h4 className="text-base font-semibold text-zyrvae-200 tracking-tight">
        {title}
      </h4>
      <p className="text-xs text-zyrvae-400 max-w-sm mt-1.5 leading-relaxed">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
