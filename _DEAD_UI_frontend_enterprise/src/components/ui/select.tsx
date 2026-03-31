'use client';

import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface SelectContextValue {
    value: string;
    onValueChange: (value: string) => void;
    open: boolean;
    setOpen: (open: boolean) => void;
}

const SelectContext = createContext<SelectContextValue | null>(null);

export function Select({
    value,
    onValueChange,
    children,
}: {
    value: string;
    onValueChange: (value: string) => void;
    children: React.ReactNode;
}) {
    const [open, setOpen] = useState(false);
    return (
        <SelectContext.Provider value={{ value, onValueChange, open, setOpen }}>
            <div className="relative">{children}</div>
        </SelectContext.Provider>
    );
}

export function SelectTrigger({ children, className }: { children: React.ReactNode; className?: string }) {
    const ctx = useContext(SelectContext)!;
    return (
        <button
            type="button"
            className={cn(
                'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                className,
            )}
            onClick={() => ctx.setOpen(!ctx.open)}
        >
            {children}
            <svg
                className="h-4 w-4 opacity-50"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
            >
                <path d="m6 9 6 6 6-6" />
            </svg>
        </button>
    );
}

export function SelectValue({ placeholder }: { placeholder?: string }) {
    const ctx = useContext(SelectContext)!;
    return <span>{ctx.value || placeholder}</span>;
}

export function SelectContent({ children }: { children: React.ReactNode }) {
    const ctx = useContext(SelectContext)!;
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!ctx.open) return;
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                ctx.setOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [ctx.open]);

    if (!ctx.open) return null;
    return (
        <div
            ref={ref}
            className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        >
            {children}
        </div>
    );
}

export function SelectItem({ value, children }: { value: string; children: React.ReactNode }) {
    const ctx = useContext(SelectContext)!;
    return (
        <div
            className={cn(
                'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 px-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground',
                ctx.value === value && 'bg-accent text-accent-foreground',
            )}
            onClick={() => {
                ctx.onValueChange(value);
                ctx.setOpen(false);
            }}
        >
            {children}
        </div>
    );
}
