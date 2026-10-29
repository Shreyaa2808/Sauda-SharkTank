import React from 'react';
import type { Startup } from '../../types/startup.ts';
import type { RegistryMetrics } from '../../utils/registryMetrics.ts';
import { formatCurrencyCompact, formatEquity } from '../../utils/formatters.ts';
import './DiscoveryHero.css';

interface DiscoveryHeroProps {
  loading: boolean;
  /** True when the startup request failed (KPIs show an unavailable state, never zeros). */
  hasError: boolean;
  metrics: RegistryMetrics;
  /** True when the API page size was reached, so totals are a lower bound. */
  isCapped: boolean;
  /** Most recent published records (API order), used for the live preview panel. */
  startups: Startup[];
  onSelectStartup: (startup: Startup) => void;
  onExplore: () => void;
  onBrowseShow: () => void;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

const ROTATE_MS = 6000;
const FEATURED_COUNT = 5;
const VIDEO_SRC = '/media/sauda-pitch-arena.mp4';
const VIDEO_POSTER = '/media/sauda-pitch-arena-poster.jpg';

/** Subscribe to a CSS media query without effects (SSR-safe, updates live). */
function useMediaQuery(query: string): boolean {
  return React.useSyncExternalStore(
    (notify) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', notify);
      return () => mql.removeEventListener('change', notify);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Adds `is-in` to elements marked data-reveal once they scroll into view. */
export function useScrollReveal(rootRef: React.RefObject<HTMLElement | null>) {
  React.useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'));
    if (typeof IntersectionObserver === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      els.forEach((el) => el.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.18, rootMargin: '0px 0px -8% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [rootRef]);
}

/** Thin gold bar showing page scroll progress. */
export const ScrollProgress: React.FC = () => {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      if (ref.current) ref.current.style.transform = `scaleX(${p})`;
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return <div className="scroll-progress" aria-hidden="true"><div ref={ref} /></div>;
};

/** Soft spotlight that follows the pointer (desktop, motion-OK only). */
export const CursorGlow: React.FC = () => {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce), (pointer: coarse)').matches) return;
    let x = window.innerWidth / 2, y = window.innerHeight / 2, cx = x, cy = y, raf = 0;
    const tick = () => {
      cx += (x - cx) * 0.14;
      cy += (y - cy) * 0.14;
      if (ref.current) ref.current.style.transform = `translate3d(${cx - 260}px, ${cy - 260}px, 0)`;
      raf = requestAnimationFrame(tick);
    };
    const onMove = (e: MouseEvent) => { x = e.clientX; y = e.clientY; if (ref.current) ref.current.style.opacity = '1'; };
    window.addEventListener('mousemove', onMove, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => { window.removeEventListener('mousemove', onMove); cancelAnimationFrame(raf); };
  }, []);
  return <div className="cursor-glow" ref={ref} aria-hidden="true" />;
};

const RAIL_ITEMS = [
  { id: 'hero', label: 'Home' },
  { id: 'story', label: 'How it works' },
  { id: 'explorer', label: 'Ventures' },
];

/** Right-edge dot rail that shows which section you're in and jumps between them. */
export const SectionRail: React.FC = () => {
  const [active, setActive] = React.useState('hero');
  React.useEffect(() => {
    const els = RAIL_ITEMS.map((r) => document.getElementById(r.id)).filter(Boolean) as HTMLElement[];
    if (typeof IntersectionObserver === 'undefined' || !els.length) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); }),
      { rootMargin: '-45% 0px -50% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return (
    <nav className="section-rail" aria-label="Page sections">
      {RAIL_ITEMS.map((r) => (
        <a
          key={r.id}
          href={`#${r.id}`}
          className={active === r.id ? 'on' : ''}
          aria-label={r.label}
          aria-current={active === r.id ? 'true' : undefined}
          onClick={(e) => {
            e.preventDefault();
            document.getElementById(r.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        >
          <span>{r.label}</span>
          <i />
        </a>
      ))}
    </nav>
  );
};

/** Slides cards and section blocks in from the right as they enter the viewport, site-wide. */
export const SlideInObserver: React.FC = () => {
  React.useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || typeof IntersectionObserver === 'undefined') return;
    const SEL = '.startup-card, .section-heading, .toolbar, .results-bar';
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const el = e.target as HTMLElement;
          const siblings = el.parentElement ? Array.from(el.parentElement.children) : [];
          el.style.animationDelay = `${(siblings.indexOf(el) % 3) * 90}ms`;
          el.classList.add('is-in');
          io.unobserve(el);
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
    );
    const seen = new WeakSet<Element>();
    const scan = () => {
      document.querySelectorAll<HTMLElement>(SEL).forEach((el) => {
        if (seen.has(el) || el.classList.contains('skeleton-card')) return;
        seen.add(el);
        el.classList.add('slide-r');
        io.observe(el);
      });
    };
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { mo.disconnect(); io.disconnect(); };
  }, []);
  return null;
};

const STORY_STEPS = [
  { n: '01', title: 'Discover', body: 'Browse televised Shark Tank pitches and platform listings, always labelled so you know the source.' },
  { n: '02', title: 'Evaluate', body: 'Open any venture to see the ask, equity, sector and stage side by side with its peers.' },
  { n: '03', title: 'Connect', body: 'Save the ones that stand out and reach founders directly from your workspace.' },
];

/** Scroll-driven story band between the hero and the venture registry. */
export const HomeStory: React.FC<{ startups: Startup[]; onExplore: () => void }> = ({ startups, onExplore }) => {
  const ref = React.useRef<HTMLElement>(null);
  useScrollReveal(ref);
  const names = React.useMemo(() => startups.map((s) => s.brandName).filter(Boolean).slice(0, 14), [startups]);
  const loop = names.length ? [...names, ...names] : [];

  return (
    <section className="home-story" id="story" ref={ref} aria-labelledby="home-story-title">
      {loop.length > 0 && (
        <div className="home-marquee" aria-hidden="true">
          <div className="home-marquee-track">
            {loop.map((n, i) => (
              <span key={`${n}-${i}`}>{n}<i /></span>
            ))}
          </div>
        </div>
      )}

      <div className="home-story-inner">
        <div className="home-story-head" data-reveal>
          <p className="home-hero-eyebrow">How Sauda works</p>
          <h2 id="home-story-title">From first look to <span>real conversation.</span></h2>
        </div>

        <ol className="home-story-steps">
          {STORY_STEPS.map((st, i) => (
            <li
              key={st.n}
              className="home-story-step"
              data-reveal
              style={{ ['--d' as string]: `${i * 120}ms` }}
              onMouseMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
                e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
              }}
            >
              <span className="home-story-num">{st.n}</span>
              <h3>{st.title}</h3>
              <p>{st.body}</p>
            </li>
          ))}
        </ol>

        <div className="home-cta-card" data-reveal>
          <div>
            <h3>Ready to take the stage?</h3>
            <p>Step into the registry and find the venture worth your next conversation.</p>
          </div>
          <button type="button" className="home-btn home-btn-primary" onClick={onExplore}>
            <span>Start exploring</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </section>
  );
};

/** Rotating spotlight over real registry records: one venture leaves, the next arrives. */
const FeaturedSpotlight: React.FC<{
  startups: Startup[];
  loading: boolean;
  hasError: boolean;
  reducedMotion: boolean;
  onSelect: (startup: Startup) => void;
  onViewAll: () => void;
}> = ({ startups, loading, hasError, reducedMotion, onSelect, onViewAll }) => {
  const pool = React.useMemo(() => startups.slice(0, FEATURED_COUNT), [startups]);
  const [rawIndex, setRawIndex] = React.useState(0);
  const [userPaused, setUserPaused] = React.useState(false);
  const [hovering, setHovering] = React.useState(false);

  const count = pool.length;
  const index = count > 0 ? rawIndex % count : 0;
  const playing = count > 1 && !reducedMotion && !userPaused && !hovering;

  React.useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setRawIndex((i) => i + 1), ROTATE_MS);
    return () => window.clearInterval(id);
  }, [playing, index]);

  const go = (delta: number) => setRawIndex((i) => (count ? (i + delta + count * 1000) % count : 0));

  if (loading) {
    return (
      <aside className="spotlight" aria-label="Featured venture" aria-busy="true">
        <div className="spotlight-card is-skeleton">
          <span className="rp-skel rp-skel-title" />
          <span className="rp-skel rp-skel-sub" />
          <span className="rp-skel rp-skel-block" />
        </div>
      </aside>
    );
  }

  if (hasError || count === 0) {
    return (
      <aside className="spotlight" aria-label="Featured venture">
        <div className="spotlight-card">
          <p className="spotlight-eyebrow">Featured venture</p>
          <p className="spotlight-empty">
            {hasError ? 'The registry is unavailable right now.' : 'New ventures will appear here as they are published.'}
          </p>
        </div>
      </aside>
    );
  }

  const s = pool[index];
  const next = pool[(index + 1) % count];
  const isPlatform = s.pitchType === 'PLATFORM';
  const hasAsk = s.originalAskAmount !== null && Number(s.originalAskAmount) > 0;
  const hasEq = s.originalAskEquityPct !== null && Number(s.originalAskEquityPct) > 0;

  return (
    <aside
      className="spotlight"
      aria-label="Featured venture"
      aria-roledescription="carousel"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setHovering(true)}
      onBlur={() => setHovering(false)}
    >
      {count > 1 && <div className="spotlight-ghost" aria-hidden="true">{next.brandName}</div>}

      <div className="spotlight-card" key={s.pitchId} aria-live={playing ? 'off' : 'polite'}>
        <div className="spotlight-top">
          <p className="spotlight-eyebrow">Featured venture</p>
          {count > 1 && (
            <div className="spotlight-controls">
              <button type="button" onClick={() => setUserPaused((p) => !p)} aria-label={playing || !userPaused ? 'Pause rotation' : 'Resume rotation'} disabled={reducedMotion} className="spotlight-pause">
                {userPaused || reducedMotion ? '▶' : '❚❚'}
              </button>
              <button type="button" onClick={() => go(-1)} aria-label="Previous venture">←</button>
              <button type="button" onClick={() => go(1)} aria-label="Next venture">→</button>
            </div>
          )}
        </div>

        <div className="spotlight-head">
          <span className="spotlight-mark" aria-hidden="true">{s.brandName.charAt(0).toUpperCase()}</span>
          <div className="spotlight-title">
            <h2>{s.brandName}</h2>
            <span className={`rp-source ${isPlatform ? 'platform' : 'show'}`}>{isPlatform ? 'Platform' : 'Shark Tank'}</span>
          </div>
        </div>

        <p className="spotlight-hook">{s.pitchHook || [s.industry, s.startupStage].filter(Boolean).join(' · ') || 'Published venture'}</p>

        <dl className="spotlight-stats">
          <div>
            <dt>Capital asked</dt>
            <dd>{hasAsk ? formatCurrencyCompact(s.originalAskAmount) : '—'}</dd>
          </div>
          <div>
            <dt>Equity</dt>
            <dd>{hasEq ? formatEquity(s.originalAskEquityPct, 1) : '—'}</dd>
          </div>
          <div>
            <dt>{s.industry ? 'Sector' : 'Source'}</dt>
            <dd className="is-text">{s.industry || (isPlatform ? 'Platform' : 'Shark Tank')}</dd>
          </div>
        </dl>

        <button type="button" className="spotlight-cta" onClick={() => onSelect(s)} aria-label={`View details for ${s.brandName}`}>
          View details <span aria-hidden="true">→</span>
        </button>

        <div className="spotlight-foot">
          <div className="spotlight-dots" aria-hidden="true">
            {pool.map((p, i) => (
              <span key={p.pitchId} className={i === index ? 'on' : ''} />
            ))}
          </div>
          <button type="button" className="spotlight-all" onClick={onViewAll}>
            Browse all ventures
          </button>
        </div>
      </div>
    </aside>
  );
};

export const DiscoveryHero: React.FC<DiscoveryHeroProps> = ({
  loading,
  hasError,
  metrics,
  isCapped,
  startups,
  onSelectStartup,
  onExplore,
  onBrowseShow,
}) => {
  const pending = loading;
  const unavailable = !loading && hasError;
  const empty = !loading && !hasError && metrics.totalCount === 0;
  const dash = '—';

  const total = pending || unavailable ? dash : `${isCapped ? `${metrics.totalCount}+` : pad2(metrics.totalCount)}`;
  const showPct = metrics.totalCount > 0 ? (metrics.showCount / metrics.totalCount) * 100 : 0;

  const askValue =
    pending || unavailable ? dash : metrics.totalAsk === null ? dash : formatCurrencyCompact(metrics.totalAsk);
  const askSub = unavailable
    ? 'Registry unavailable'
    : pending
      ? 'Loading…'
      : metrics.totalAsk === null
        ? 'No asks recorded'
        : `Stated by ${metrics.askSampleCount} of ${metrics.totalCount} pitches`;

  const equityValue =
    pending || unavailable ? dash : metrics.avgEquity === null ? dash : formatEquity(metrics.avgEquity, 1);
  const equitySub = unavailable
    ? 'Registry unavailable'
    : pending
      ? 'Loading…'
      : metrics.avgEquity === null
        ? 'No equity recorded'
        : `Mean of ${metrics.equitySampleCount} stated ${metrics.equitySampleCount === 1 ? 'value' : 'values'}`;

  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const compactScreen = useMediaQuery('(max-width: 768px)');
  const [videoFailed, setVideoFailed] = React.useState(false);
  const showVideo = !reducedMotion && !compactScreen && !videoFailed;

  const heroRef = React.useRef<HTMLElement>(null);
  React.useEffect(() => {
    if (reducedMotion) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = heroRef.current;
      if (!el) return;
      const p = Math.min(1, Math.max(0, window.scrollY / Math.max(1, el.offsetHeight)));
      el.style.setProperty('--p', p.toFixed(4));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reducedMotion]);

  return (
    <section className="home-hero" id="hero" ref={heroRef} aria-labelledby="home-hero-title">
      <div className="home-hero-stage" aria-hidden="true">
        {showVideo && (
          <video
            className="home-hero-video"
            src={VIDEO_SRC}
            poster={VIDEO_POSTER}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            tabIndex={-1}
            onError={() => setVideoFailed(true)}
          />
        )}
        <div className="home-hero-poster" style={{ backgroundImage: `url(${VIDEO_POSTER})` }} />
        <div className="home-hero-shade" />
        <div className="home-hero-lights" />
      </div>

      <div className="home-hero-inner">
        <div className="home-hero-copy">
          <p className="home-hero-eyebrow">The Sauda pitch floor</p>
          <h1 id="home-hero-title" className="home-hero-title">
            <b className="home-title-line">Ideas enter.</b>
            <span className="home-title-line">Empires begin.</span>
          </h1>
          <p className="home-hero-lede">
            Discover standout ventures, explore founder pitches, and find opportunities worth a closer look.
          </p>

          <div className="home-hero-actions">
            <button type="button" className="home-btn home-btn-primary" onClick={onExplore}>
              <span>Explore the ventures</span>
              <span aria-hidden="true">→</span>
            </button>
            <button type="button" className="home-btn home-btn-ghost" onClick={onBrowseShow}>
              <span className="home-btn-play" aria-hidden="true">▶</span>
              Shark Tank archive
            </button>
          </div>
        </div>

        <div className="home-hero-visual">
          <FeaturedSpotlight
            startups={startups}
            loading={pending}
            hasError={unavailable}
            reducedMotion={reducedMotion}
            onSelect={onSelectStartup}
            onViewAll={onExplore}
          />
        </div>
      </div>

      <a className="home-scroll-cue" href="#explorer" onClick={(e) => { e.preventDefault(); onExplore(); }} aria-label="Scroll to the venture registry">
        <span>Scroll</span>
        <i aria-hidden="true" />
      </a>

      <div className="home-kpi-wrap">
        <dl className="home-kpi-band" aria-label="Registry summary">
          <div className="home-kpi">
            <dt>Published ventures</dt>
            <dd className="home-kpi-value">{total}</dd>
            <p className="home-kpi-sub">
              {unavailable
                ? 'Registry unavailable'
                : empty
                  ? 'No published ventures yet'
                  : isCapped
                    ? 'Showing the most recent listings'
                    : 'In the registry today'}
            </p>
          </div>

          <div className="home-kpi">
            <dt>By source</dt>
            <dd className="home-kpi-value home-kpi-split">
              <span>
                <b>{pending || unavailable ? dash : metrics.showCount}</b> Shark Tank
              </span>
              <span>
                <b>{pending || unavailable ? dash : metrics.platformCount}</b> Platform
              </span>
            </dd>
            <div
              className="home-kpi-bar"
              role="img"
              aria-label={
                pending || unavailable || metrics.totalCount === 0
                  ? 'Source distribution unavailable'
                  : `${metrics.showCount} Shark Tank pitches and ${metrics.platformCount} platform listings`
              }
            >
              <span style={{ width: `${pending || unavailable ? 0 : showPct}%` }} />
            </div>
          </div>

          <div className="home-kpi">
            <dt>Capital asked</dt>
            <dd className="home-kpi-value">{askValue}</dd>
            <p className="home-kpi-sub">{askSub}</p>
          </div>

          <div className="home-kpi">
            <dt>Avg. equity offered</dt>
            <dd className="home-kpi-value">{equityValue}</dd>
            <p className="home-kpi-sub">{equitySub}</p>
          </div>
        </dl>
      </div>
    </section>
  );
};

export default DiscoveryHero;
