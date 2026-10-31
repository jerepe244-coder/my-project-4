import React from 'react';
import { Search, X } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Buscar...',
  className = '',
}: SearchInputProps) {
  return (
    <div className={`relative flex items-center ${className}`}>
      <Search className="w-4 h-4 text-zyrvae-500 absolute left-3.5 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-9 py-2 text-xs bg-zyrvae-950 border border-zyrvae-750/90 rounded-lg text-zyrvae-100 placeholder-zyrvae-500 focus:outline-none focus:border-electric focus:ring-1 focus:ring-electric transition-colors"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-3 text-zyrvae-500 hover:text-zyrvae-300 focus:outline-none"
          aria-label="Limpiar búsqueda"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
