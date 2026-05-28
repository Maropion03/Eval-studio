import { Link } from 'react-router-dom';

interface Props {
    code: string;
    title: string;
    subtitle: string;
}

export default function Placeholder({ code, title, subtitle }: Props) {
    return (
        <div className="max-w-[920px] mx-auto reveal-in">
            <div className="flex items-center gap-3 text-[10.5px] tracking-[0.28em] text-[var(--color-text-dim)]">
                <span className="text-[var(--color-amber)]">▌</span>
                MODULE&nbsp;{code}
            </div>
            <h1 className="font-crt text-[64px] leading-[0.9] text-[var(--color-text-bright)] mt-2">
                {title}<span className="blink text-[var(--color-amber)] glow-amber">_</span>
            </h1>
            <p className="mt-3 text-[12px] tracking-[0.06em] text-[var(--color-text-muted)] max-w-[560px]">
                {subtitle}
            </p>

            <div className="mt-10 px-8 py-12">
                <div className="tl-rule mb-6"><span>SECTOR · UNDER · CONSTRUCTION</span></div>
                <div className="font-data text-[13px] text-[var(--color-text-muted)] leading-[1.8] space-y-2">
                    <div>
                        <span className="text-[var(--color-mint)]">$</span>{' '}
                        <span className="text-[var(--color-amber)]">eval-studio</span>{' '}
                        <span className="text-[var(--color-text-bright)]">scaffold</span>{' '}
                        <span className="text-[var(--color-text-muted)]">--module={title.toLowerCase()}</span>
                    </div>
                    <div className="text-[var(--color-text-dim)]">
                        &gt; resolving page contract …{' '}
                        <span className="text-[var(--color-mint)] glow-mint">ok</span>
                    </div>
                    <div className="text-[var(--color-text-dim)]">
                        &gt; estimating delivery …{' '}
                        <span className="text-[var(--color-amber)] glow-amber-soft">WEEK 2-3</span>
                    </div>
                    <div className="text-[var(--color-text-dim)]">
                        &gt; awaiting design tokens …{' '}
                        <span className="text-[var(--color-mint)]">received</span>
                    </div>
                    <div className="text-[var(--color-text-fade)]">─────────────────────────────────────</div>
                    <div>
                        <span className="text-[var(--color-text-dim)]">status:</span>{' '}
                        <span className="text-[var(--color-amber)] glow-amber-soft">QUEUED</span>{' '}
                        <span className="blink text-[var(--color-amber)]">▌</span>
                    </div>
                </div>

                <Link
                    to="/"
                    className="inline-flex mt-10 px-4 py-2 text-[11px] tracking-[0.22em] uppercase
                               text-[var(--color-amber)] border border-[var(--color-amber)]
                               hover:bg-[var(--color-amber)] hover:text-[var(--color-canvas)]
                               transition-colors duration-100 font-mono"
                >
                    ◀&nbsp;BACK&nbsp;TO&nbsp;EXPERIMENTS
                </Link>
            </div>
        </div>
    );
}
