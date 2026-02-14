import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    SquaresFour,
    Database,
    Flask,
    GearSix,
    Terminal,
} from '@phosphor-icons/react';

export default function Sidebar() {
    const location = useLocation();
    const { t } = useTranslation();

    const navItems = [
        { to: '/', label: t('common.dashboard'), icon: SquaresFour },
        { to: '/datasets', label: t('common.datasets'), icon: Database },
        { to: '/results', label: t('common.evaluation'), icon: Flask },
        { to: '/playground', label: t('common.playground'), icon: Terminal },
        { to: '/settings', label: t('common.settings'), icon: GearSix },
    ];

    return (
        <aside className="flex flex-col w-60 h-screen bg-zinc-950 border-r border-white/10 fixed left-0 top-0 z-30">
            <div className="px-5 py-5 border-b border-white/10">
                <h1 className="text-[15px] font-semibold text-zinc-100 leading-tight tracking-tight">
                    Eval Studio
                </h1>
                <p className="text-[11px] text-zinc-600 leading-tight mt-0.5">{t('common.subtitle')}</p>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1">
                {navItems.map(({ to, label, icon: Icon }) => {
                    const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
                    return (
                        <NavLink
                            key={to}
                            to={to}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-medium transition-all duration-150 group ${isActive
                                ? 'bg-white/[0.06] text-zinc-100'
                                : 'text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300'
                                }`}
                        >
                            <Icon
                                weight="duotone"
                                className={`text-xl transition-colors ${isActive ? 'text-indigo-400' : 'text-zinc-600 group-hover:text-zinc-400'
                                    }`}
                            />
                            {label}
                        </NavLink>
                    );
                })}
            </nav>

            <div className="px-5 py-4 border-t border-white/10">
                <p className="text-[11px] text-zinc-700">v1.0.0 · Powered by Eval Studio</p>
            </div>
        </aside>
    );
}
