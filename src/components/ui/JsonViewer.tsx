'use client';

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface JsonViewerProps {
  data: unknown;
  title?: string;
  defaultExpanded?: boolean;
  className?: string;
}

export function JsonViewer({
  data,
  title,
  className = '',
}: JsonViewerProps) {
  const [copied, setCopied] = useState(false);

  const formattedJson = typeof data === 'string'
    ? (() => {
        try {
          return JSON.stringify(JSON.parse(data), null, 2);
        } catch {
          return data;
        }
      })()
    : JSON.stringify(data, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(formattedJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`rounded-lg border border-zyrvae-800 bg-zyrvae-950/80 overflow-hidden font-mono text-xs ${className}`}
    >
      <div className="flex items-center justify-between px-3 py-2 bg-zyrvae-900 border-b border-zyrvae-800">
        <span className="text-zyrvae-400 font-sans text-xs font-medium">
          {title || 'JSON Inspector'}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 rounded text-zyrvae-400 hover:text-zyrvae-200 hover:bg-zyrvae-800 transition-colors"
          title="Copiar contenido"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-[10px] text-emerald-400 font-sans">Copiado</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span className="text-[10px] font-sans">Copiar</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3.5 overflow-x-auto text-zyrvae-300 leading-relaxed text-[11px] max-h-96">
        <code>{formattedJson}</code>
      </pre>
    </div>
  );
}
