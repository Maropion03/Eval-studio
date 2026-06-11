import { Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Sidebar from './Sidebar';

function useClock() {
    const [time, setTime] = useState(() => new Date());
    useEffect(() => {
        const id = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(id);
    }, []);
    return time.toLocaleTimeString('en-GB', { hour12: false });
}

function StatusStrip() {
    const location = useLocation();
    const clock = useClock();
    const segments = [
        { label: 'SYS', value: 'READY',  glow: true },
        { label: 'USR', value: 'medusa@local' },
        { label: 'API', value: '4 KEYS', sub: '◉' },
        { label: 'RUN', value: '12 / 3 ACTIVE' },
        { label: 'PATH', value: location.pathname === '/' ? '/EXPERIMENTS' : location.pathname.toUpperCase() },
    ];

    return (
        <div className="h-[28px] border-b border-[var(--color-border)] bg-[var(--color-canvas)] flex items-stretch text-[10.5px] tracking-[0.14em] select-none">
            {segments.map((seg, i) => (
                <div
                    key={seg.label}
                    className={`flex items-center gap-2 px-3 ${
                        i === 0 ? '' : 'border-l border-[var(--color-border)]'
                    }`}
                >
                    <span className="text-[var(--color-text-fade)]">{seg.label}</span>
                    {seg.sub && <span className="text-[var(--color-mint)]">{seg.sub}</span>}
                    <span className={seg.glow
                        ? 'text-[var(--color-mint)] glow-mint font-data'
                        : 'text-[var(--color-text-muted)] font-data'
                    }>
                        {seg.value}
                    </span>
                </div>
            ))}
            <div className="ml-auto flex items-center px-4 border-l border-[var(--color-border)] font-data text-[var(--color-amber)] glow-amber-soft">
                {clock}
                <span className="ml-2 text-[var(--color-text-fade)] tracking-widest">UTC+8</span>
            </div>
        </div>
    );
}

export default function Layout() {
    return (
        <div className="flex min-h-screen bg-[var(--color-canvas)]">
            <Sidebar />
            <div className="flex-1 ml-[248px] flex flex-col min-w-0">
                <StatusStrip />
                <main className="flex-1 p-8 overflow-x-hidden">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
