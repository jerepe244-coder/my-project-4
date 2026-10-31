import React from 'react';

export interface FilterOption {
  label: string;
  value: string;
}

interface FilterDropdownProps {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  className?: string;
}

export function FilterDropdown({
  label,
  value,
  options,
  onChange,
  className = '',
}: FilterDropdownProps) {
  return (
    <div className={`relative flex items-center gap-1.5 ${className}`}>
      <span className="text-xs text-zyrvae-500 font-medium whitespace-nowrap hidden sm:inline">
        {label}:
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-xs bg-zyrvae-950 border border-zyrvae-750/90 rounded-lg text-zyrvae-200 px-3 py-2 pr-7 focus:outline-none focus:border-electric focus:ring-1 focus:ring-electric transition-colors cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ba5b9%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:12px_12px] bg-[right_8px_center] bg-no-repeat"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-zyrvae-900 text-zyrvae-100">
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
