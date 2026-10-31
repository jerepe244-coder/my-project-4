import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  footer?: React.ReactNode;
}

export function Card({
  children,
  className = '',
  title,
  subtitle,
  action,
  footer,
}: CardProps) {
  return (
    <div
      className={`bg-zyrvae-900 border border-zyrvae-750/80 rounded-xl overflow-hidden shadow-card transition-all ${className}`}
    >
      {(title || subtitle || action) && (
        <div className="px-5 py-4 border-b border-zyrvae-800/80 flex items-start justify-between gap-4">
          <div>
            {title && (
              <h3 className="text-base font-semibold text-zyrvae-100 tracking-tight">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-zyrvae-400 mt-1 leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
      {footer && (
        <div className="px-5 py-3 border-t border-zyrvae-800/80 bg-zyrvae-950/40 text-xs text-zyrvae-400">
          {footer}
        </div>
      )}
    </div>
  );
}
