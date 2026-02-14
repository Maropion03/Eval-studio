import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UserCircle, CaretRight, Translate } from '@phosphor-icons/react';

const routeKeys: Record<string, string> = {
    '/': 'common.dashboard',
    '/datasets': 'common.datasets',
    '/results': 'common.evaluation',
    '/playground': 'common.playground',
    '/compare': 'common.comparison',
    '/settings': 'common.settings',
};

export default function TopBar() {
    const location = useLocation();
    const { t, i18n } = useTranslation();
    const currentKey = routeKeys[location.pathname] || 'common.dashboard';

    const toggleLanguage = () => {
        const next = i18n.language === 'zh' ? 'en' : 'zh';
        i18n.changeLanguage(next);
    };

    return (
        <header className="flex items-center justify-between h-14 px-6 bg-transparent backdrop-blur-md border-b border-white/10 sticky top-0 z-20">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm">
                <span className="text-zinc-600">Eval Studio</span>
                <CaretRight weight="bold" className="text-xs text-zinc-700" />
                <span className="font-medium text-zinc-300">{t(currentKey)}</span>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-4">
                {/* Language Switcher */}
                <button
                    onClick={toggleLanguage}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/5 bg-zinc-900/30 text-[12px] font-medium text-zinc-400 hover:border-white/10 hover:text-zinc-200 transition-colors"
                    title={i18n.language === 'zh' ? 'Switch to English' : '切换到中文'}
                >
                    <Translate weight="duotone" className="text-base" />
                    <span className="font-mono">{i18n.language === 'zh' ? 'EN' : '中文'}</span>
                </button>

                {/* User */}
                <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
                    <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-zinc-900">
                        A
                    </div>
                    <div className="hidden md:block text-left">
                        <p className="text-[12px] font-medium text-zinc-200 leading-tight">Admin User</p>
                        <p className="text-[11px] text-zinc-600 leading-tight">admin@evalstudio.ai</p>
                    </div>
                </div>
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/[0.06] border border-white/10">
                    <UserCircle weight="duotone" className="text-xl text-zinc-400" />
                </div>
            </div>
        </header>
    );
}
