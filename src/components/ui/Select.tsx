import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
    label: string;
    value: string;
}

interface SelectProps {
    value: string;
    onChange: (value: string) => void;
    options: SelectOption[];
    className?: string;
    size?: 'sm' | 'md';
    placeholder?: string;
}

export default function Select({ value, onChange, options, className = '', size = 'md', placeholder = 'Select...' }: SelectProps) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selected = options.find((o) => o.value === value);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    // Close on Escape
    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [open]);

    const sizeClasses = size === 'sm'
        ? 'px-2.5 py-1.5 text-[11.5px]'
        : 'px-3.5 py-2.5 text-[13px]';

    const menuItemClasses = size === 'sm'
        ? 'px-2.5 py-1.5 text-[11.5px]'
        : 'px-3 py-2 text-[13px]';

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            {/* Trigger */}
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className={`
                    w-full flex items-center justify-between gap-2
                    ${sizeClasses}
                    bg-zinc-900 border rounded-lg font-medium
                    text-zinc-300 cursor-pointer
                    transition-all duration-150
                    ${open
                        ? 'border-zinc-500 ring-1 ring-zinc-500/20'
                        : 'border-zinc-700 hover:border-zinc-600'
                    }
                `}
            >
                <span className={`truncate ${!selected ? 'text-zinc-500' : ''}`}>
                    {selected?.label ?? placeholder}
                </span>
                <ChevronDown
                    className={`w-3.5 h-3.5 text-zinc-500 shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
                />
            </button>

            {/* Dropdown Menu */}
            {open && (
                <div className="absolute z-50 mt-1.5 w-full min-w-[160px] bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl shadow-black/50 p-1 animate-in fade-in slide-in-from-top-1 duration-100 max-h-60 overflow-y-auto">
                    <ul className="space-y-0.5">
                        {options.map((opt) => {
                            const isSelected = opt.value === value;
                            return (
                                <li key={opt.value}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onChange(opt.value);
                                            setOpen(false);
                                        }}
                                        className={`
                                            w-full flex items-center justify-between gap-2
                                            ${menuItemClasses}
                                            rounded-md cursor-pointer transition-colors duration-100 text-left
                                            ${isSelected
                                                ? 'text-zinc-100 bg-zinc-800'
                                                : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                                            }
                                        `}
                                    >
                                        <span className="truncate">{opt.label}</span>
                                        {isSelected && (
                                            <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                        )}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </div>
    );
}
