import { NavLink, useLocation } from 'react-router-dom';

const navItems = [
    { to: '/',         num: '01', label: 'EXPERIMENTS', meta: '12' },
    { to: '/new',      num: '02', label: 'NEW · RUN',   meta: '▸'  },
    { to: '/datasets', num: '03', label: 'DATASETS',    meta: '140'},
    { to: '/settings', num: '04', label: 'SETTINGS',    meta: ''   },
];

export default function Sidebar() {
    const location = useLocation();

    const isActive = (to: string) =>
        to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

    return (
        <aside className="flex flex-col w-[248px] h-screen fixed left-0 top-0 z-30 border-r border-[var(--color-border)] bg-[var(--color-canvas)]">
            {/* Wordmark */}
            <div className="px-5 pt-6 pb-5 border-b border-[var(--color-border)] relative">
                <div className="font-crt glow-amber text-[36px] leading-[0.85] tracking-[0.04em] text-[var(--color-amber)]">
                    EVAL<br/>STUDIO
                </div>
                <div className="mt-2 flex items-center gap-2 text-[10px] text-[var(--color-text-dim)] tracking-[0.18em] uppercase">
                    <span className="text-[var(--color-mint)] glow-mint">◉</span>
                    <span>Terminal&nbsp;Lab&nbsp;v2.0</span>
                </div>
                <span className="absolute top-2 right-3 text-[10px] text-[var(--color-text-fade)] tracking-widest">
                    /R7.42
                </span>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 py-5 space-y-px">
                <div className="px-2 pb-3 text-[10px] text-[var(--color-text-dim)] tracking-[0.22em]">
                    ─ MODULES ─
                </div>
                {navItems.map((item) => {
                    const active = isActive(item.to);
                    return (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={`
                                relative flex items-center gap-3 px-3 py-2.5
                                font-mono text-[12px] tracking-[0.12em]
                                transition-all duration-100
                                ${active
                                    ? 'text-[var(--color-amber)] bg-[var(--color-amber-trace)] glow-amber-soft'
                                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-bright)] hover:bg-[var(--color-panel)]'
                                }
                            `}
                        >
                            {active && (
                                <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[var(--color-amber)]" />
                            )}
                            <span className={`font-data text-[10.5px] ${active ? 'text-[var(--color-amber)]' : 'text-[var(--color-text-fade)]'}`}>
                                {item.num}
                            </span>
                            <span className="flex-1">{item.label}</span>
                            <span className={`font-data text-[10px] ${active ? 'text-[var(--color-amber)]' : 'text-[var(--color-text-fade)]'}`}>
                                {item.meta}
                            </span>
                        </NavLink>
                    );
                })}
            </nav>

            {/* Status block */}
            <div className="px-4 py-4 border-t border-[var(--color-border)] space-y-2.5 text-[10.5px] tracking-[0.08em]">
                <div className="flex items-center justify-between text-[var(--color-text-dim)]">
                    <span>SESSION</span>
                    <span className="font-data text-[var(--color-text-muted)]">7A·F2·B4</span>
                </div>
                <div className="flex items-center justify-between text-[var(--color-text-dim)]">
                    <span>UPLINK</span>
                    <span className="flex items-center gap-1.5 text-[var(--color-mint)]">
                        <span className="inline-block w-1.5 h-1.5 bg-[var(--color-mint)] glow-mint" />
                        <span className="font-data">ONLINE</span>
                    </span>
                </div>
                <div className="flex items-center justify-between text-[var(--color-text-dim)]">
                    <span>BUDGET</span>
                    <span className="font-data text-[var(--color-amber)]">¥04.12</span>
                </div>

                <div className="pt-3 mt-3 border-t border-[var(--color-border)] text-[10px] tracking-[0.15em] text-[var(--color-text-fade)]">
                    PRESS&nbsp;<span className="text-[var(--color-text-muted)] px-1 border border-[var(--color-border)]">⌘K</span>&nbsp;FOR&nbsp;OPS
                </div>
            </div>
        </aside>
    );
}
