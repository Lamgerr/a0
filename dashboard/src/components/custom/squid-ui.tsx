import React, { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Lenis from 'lenis';
import { useAuth } from '@/contexts/AuthContext';
import SquidLogo from '@/components/ui/SquidLogo';
import Footer from '@/components/custom/Footer';

/* ═══════════════════════════════════════════════════════════════
   SQUIDCLOUD DESIGN LAYER
   Shared by the homepage and the pricing page so both read as one
   product: same tokens, nav, buttons, hero field, plan cards,
   billing toggle and closing section.
   Place at: src/components/custom/squid-ui.tsx
   ═══════════════════════════════════════════════════════════════ */

export const ease = [0.16, 1, 0.3, 1] as const;

/* ── Fonts, scroll ──────────────────────────────────────────── */

const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@125,800&family=Hanken+Grotesk:wght@200;300;400;500&family=Geist+Mono:wght@400;500&display=swap';

export function useFonts() {
  useEffect(() => {
    if (document.querySelector('link[data-sq-fonts]')) return;
    const pre1 = document.createElement('link');
    pre1.rel = 'preconnect';
    pre1.href = 'https://fonts.googleapis.com';
    const pre2 = document.createElement('link');
    pre2.rel = 'preconnect';
    pre2.href = 'https://fonts.gstatic.com';
    pre2.crossOrigin = 'anonymous';
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FONT_HREF;
    link.setAttribute('data-sq-fonts', 'true');
    document.head.append(pre1, pre2, link);
    return () => {
      pre1.remove();
      pre2.remove();
      link.remove();
    };
  }, []);
}

let lenisRef: Lenis | null = null;

export function useSmoothScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const lenis = new Lenis({ lerp: 0.085, smoothWheel: true });
    lenisRef = lenis;
    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
      lenisRef = null;
    };
  }, []);
}

export function scrollToId(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
  e.preventDefault();
  const el = document.getElementById(id);
  if (!el) return;
  if (lenisRef) lenisRef.scrollTo(el, { offset: -72, duration: 1.4 });
  else el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── Styles ─────────────────────────────────────────────────── */

const GRAIN_URI =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

export const SQ_CSS = `
:root {
  --ink: #090b0a;
  --ink-2: #0e1110;
  --bone: #e8e7e1;
  --mute: #8d8f89;
  --dim: #4d504c;
  --mark: #90928c;
  --line: rgba(232, 231, 225, 0.12);
  --line-2: rgba(232, 231, 225, 0.22);
  --f-display: 'Hanken Grotesk', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --f-mono: 'Geist Mono', ui-monospace, 'SF Mono', Menlo, monospace;
  --f-mark: 'Archivo', 'Arial Black', Impact, sans-serif;
  --ease: cubic-bezier(0.16, 1, 0.3, 1);
  --gutter: 44px;
}

html, body { background: var(--ink); color: var(--bone); margin: 0; overflow-x: hidden; }

.sq { position: relative; background: var(--ink); color: var(--bone); font-family: var(--f-display); -webkit-font-smoothing: antialiased; min-height: 100vh; }
.sq *, .sq *::before, .sq *::after { box-sizing: border-box; }
.sq a { color: inherit; }
.sq ::selection { background: var(--bone); color: var(--ink); }
.sq a:focus-visible, .sq button:focus-visible { outline: 1px solid var(--bone); outline-offset: 3px; }

.grain { position: fixed; inset: -50%; z-index: 80; pointer-events: none; background-image: ${GRAIN_URI}; background-size: 240px 240px; opacity: 0.075; animation: grain 1.1s steps(6) infinite; }
@keyframes grain {
  0% { transform: translate(0, 0); } 17% { transform: translate(-3%, 2%); } 33% { transform: translate(2%, -4%); }
  50% { transform: translate(-4%, -1%); } 67% { transform: translate(3%, 3%); } 83% { transform: translate(-1%, 4%); } 100% { transform: translate(0, 0); }
}

/* ── Buttons ── */
.btn { display: inline-flex; align-items: center; text-decoration: none; border: 0; border-radius: 3px; font: 500 14px/1 var(--f-display); letter-spacing: -0.005em; cursor: pointer; }
.btn-fill { background: var(--bone); color: var(--ink) !important; padding: 4px 4px 4px 18px; gap: 18px; transition: background 0.3s; }
.btn-fill:hover { background: #fff; }
.btn-fill i, .btn-ink i { width: 38px; height: 38px; border-radius: 2px; background: var(--ink); color: var(--bone); display: grid; place-items: center; overflow: hidden; }
.btn i svg { transition: transform 0.45s var(--ease); }
.btn:hover i svg { transform: translate(2px, -2px); }
.btn-fill.sm { padding: 3px 3px 3px 14px; gap: 14px; font-size: 13px; }
.btn-fill.sm i { width: 30px; height: 30px; }
.btn-ink { background: var(--ink); color: var(--bone) !important; padding: 4px 4px 4px 18px; gap: 18px; transition: opacity 0.3s; }
.btn-ink i { background: var(--bone); color: var(--ink); }
.btn-ink:hover { opacity: 0.88; }
.btn-ghost { height: 46px; padding: 0 20px; border: 1px solid var(--line-2); color: var(--bone); background: transparent; transition: background 0.3s, border-color 0.3s; }
.btn-ghost:hover { background: rgba(232, 231, 225, 0.06); border-color: rgba(232, 231, 225, 0.4); }
.btn[disabled] { opacity: 0.45; cursor: default; pointer-events: none; }

/* ── Nav ── */
.nav { position: fixed; top: 0; left: 0; right: 0; z-index: 70; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; padding: 14px var(--gutter); border-bottom: 1px solid transparent; transition: background 0.4s, border-color 0.4s; }
.nav.solid { background: rgba(9, 11, 10, 0.72); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border-bottom-color: var(--line); }
.brand { display: inline-flex; align-items: center; gap: 10px; font: 500 15px/1 var(--f-display); letter-spacing: -0.01em; text-decoration: none; justify-self: start; }
.links { display: flex; gap: 2px; padding: 4px; border: 1px solid var(--line); border-radius: 3px; background: rgba(14, 17, 16, 0.55); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); }
.links a { font: 400 11px/1 var(--f-mono); letter-spacing: 0.14em; text-transform: uppercase; color: var(--mute); text-decoration: none; padding: 10px 14px; border-radius: 2px; transition: color 0.25s, background 0.25s; }
.links a:hover { color: var(--bone); background: rgba(232, 231, 225, 0.07); }
.nav-r { justify-self: end; display: flex; align-items: center; gap: 18px; }
.signin { font: 400 13px/1 var(--f-display); color: var(--mute); text-decoration: none; transition: color 0.25s; }
.signin:hover { color: var(--bone); }

/* ── Hero ── */
.hero { position: relative; display: flex; flex-direction: column; min-height: max(100svh, 700px); overflow: hidden; isolation: isolate; }
.hero-field { position: absolute; inset: 0; z-index: 0; }
.hero-field canvas { width: 100%; height: 100%; display: block; filter: blur(16px); transform: scale(1.08); }
.hero-shade { position: absolute; inset: 0; z-index: 1; pointer-events: none;
  background: radial-gradient(120% 70% at 50% 38%, transparent 30%, rgba(9, 11, 10, 0.72) 100%), linear-gradient(180deg, rgba(9, 11, 10, 0.55) 0%, transparent 28%, transparent 70%, rgba(9, 11, 10, 0.5) 100%); }
.hero::after { content: ''; position: absolute; inset: 0; z-index: 3; pointer-events: none; background-image: radial-gradient(rgba(0, 0, 0, 0.55) 0.9px, transparent 1.2px); background-size: 4px 4px; opacity: 0.35; mix-blend-mode: multiply; }
.hero-core { position: relative; z-index: 2; flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 26px; padding: 128px var(--gutter) 36px; }
.hero.compact { min-height: 0; }
.hero.compact .hero-core { padding-top: 140px; padding-bottom: 72px; flex: none; }
.hero.compact::before { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 38%; z-index: 2; pointer-events: none; background: linear-gradient(180deg, transparent, var(--ink)); }
.eyebrow { font: 400 11px/1 var(--f-mono); letter-spacing: 0.22em; text-transform: uppercase; color: var(--mute); }
.hero-h { margin: 0; font: 300 5.6rem/1.02 var(--f-display); letter-spacing: -0.04em; text-wrap: balance; }
.hero-h .ln { display: block; overflow: hidden; padding-bottom: 0.08em; margin-bottom: -0.08em; }
.hero-h .ln > span { display: block; }
.hero-sub { margin: 0; max-width: 31em; color: var(--mute); font: 400 1.06rem/1.65 var(--f-display); text-wrap: pretty; }
.hero-ctas { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-top: 6px; }

.mark-pad { position: relative; z-index: 2; padding: 0 var(--gutter); }
.mark-clip { overflow: hidden; padding-top: 0.02em; padding-bottom: 0.1em; margin-bottom: -0.06em; }
.mark { display: inline-block; white-space: nowrap; font-family: var(--f-mark); font-stretch: 125%; font-weight: 800; font-size: 100px; line-height: 0.8; letter-spacing: -0.02em; text-transform: uppercase; color: var(--mark); user-select: none; }
.mark .lt { display: inline-block; }
.eye { display: inline-block; width: 0.86em; height: 0.7em; vertical-align: baseline; margin: 0 0.01em; }
.eye svg { display: block; width: 100%; height: 100%; overflow: visible; }
.eye-p { transform-box: fill-box; transform-origin: center; animation: blink 7s infinite; }
@keyframes blink { 0%, 93%, 100% { transform: scaleY(1); } 96% { transform: scaleY(0.08); } }

/* ── Section primitives ── */
.sec { max-width: 1480px; margin: 0 auto; padding: 180px var(--gutter); }
.sec-h { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); gap: 80px; align-items: end; margin-bottom: 88px; }
.h2 { margin: 0; font: 300 4rem/1.04 var(--f-display); letter-spacing: -0.035em; text-wrap: balance; }
.lede { margin: 0; max-width: 30em; color: var(--mute); font: 400 1rem/1.65 var(--f-display); text-wrap: pretty; }
.lnk { display: inline-flex; align-items: center; gap: 10px; font: 500 14px/1 var(--f-display); text-decoration: none; padding-bottom: 6px; border-bottom: 1px solid var(--line-2); transition: border-color 0.3s; }
.lnk:hover { border-color: var(--bone); }
.lnk svg { transition: transform 0.45s var(--ease); }
.lnk:hover svg { transform: translate(2px, -2px); }

/* ── Billing toggle ── */
.bill { position: relative; display: inline-flex; padding: 4px; border: 1px solid var(--line-2); border-radius: 3px; background: rgba(14, 17, 16, 0.6); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
.bill button { all: unset; box-sizing: border-box; position: relative; z-index: 1; cursor: pointer; display: flex; align-items: center; gap: 8px; padding: 12px 18px; font: 400 11px/1 var(--f-mono); letter-spacing: 0.14em; text-transform: uppercase; color: var(--mute); transition: color 0.3s; }
.bill button:hover { color: var(--bone); }
.bill button[aria-pressed='true'] { color: var(--ink); }
.bill button:focus-visible { outline: 1px solid var(--bone); outline-offset: 2px; }
.bill .pill { position: absolute; inset: 0; z-index: -1; background: var(--bone); border-radius: 2px; }
.bill .bdg { font-size: 9px; letter-spacing: 0.04em; padding: 3px 5px; border: 1px solid currentColor; border-radius: 2px; }

/* ── Plan cards ── */
.plans { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; align-items: stretch; }
.plan-w { display: flex; min-width: 0; }
.plan { position: relative; display: flex; flex-direction: column; width: 100%; border: 1px solid var(--line-2); border-radius: 6px; background: var(--ink-2); padding: 34px; overflow: hidden; isolation: isolate; }
.plan::before { content: ''; position: absolute; inset: 0; z-index: -1; opacity: 0; transition: opacity 0.4s; background: radial-gradient(380px circle at var(--mx, 50%) var(--my, 0%), rgba(232, 231, 225, 0.08), transparent 60%); }
.plan:hover::before { opacity: 1; }
.plan-name { display: flex; justify-content: space-between; align-items: center; gap: 12px; font: 400 11px/1 var(--f-mono); letter-spacing: 0.18em; text-transform: uppercase; color: var(--mute); }
.plan-flag { padding: 5px 7px; border-radius: 2px; background: var(--ink); color: var(--bone); font-size: 10px; letter-spacing: 0.1em; }
.plan-tag { margin: 12px 0 0; font: 400 0.95rem/1.4 var(--f-display); color: var(--mute); }
.plan-price { margin: 34px 0 0; display: flex; align-items: baseline; gap: 10px; font: 300 4.4rem/1 var(--f-display); letter-spacing: -0.05em; min-height: 1em; }
.plan-price small { font: 400 12px/1 var(--f-mono); letter-spacing: 0.08em; color: var(--mute); }
.price { position: relative; display: inline-flex; overflow: hidden; padding: 0 0.04em 0.06em; font-variant-numeric: tabular-nums; }
.plan-note { margin: 12px 0 0; font: 400 11px/1.4 var(--f-mono); letter-spacing: 0.06em; color: var(--dim); }
.plan-cta { margin: 28px 0 30px; }
.plan-cta .btn { width: 100%; justify-content: space-between; }
.plan-cta .btn-ghost { justify-content: center; }
.spec { margin: 0; padding: 22px 0 0; border-top: 1px solid var(--line); display: flex; flex-direction: column; }
.spec-h { margin: 0 0 6px; font: 400 11px/1.3 var(--f-mono); letter-spacing: 0.14em; text-transform: uppercase; color: var(--dim); }
.spec-r { display: flex; justify-content: space-between; align-items: baseline; gap: 18px; padding: 12px 0; border-bottom: 1px solid var(--line); font: 400 0.9rem/1.35 var(--f-display); }
.spec-r:last-child { border-bottom: 0; }
.spec-r b { font-weight: 500; color: var(--bone); white-space: nowrap; }
.spec-r span { color: var(--mute); text-align: right; }
.plan.feat { background: var(--bone); border-color: var(--bone); color: var(--ink); }
.plan.feat::before { background: radial-gradient(380px circle at var(--mx, 50%) var(--my, 0%), rgba(9, 11, 10, 0.07), transparent 60%); }
.plan.feat .plan-name, .plan.feat .plan-tag, .plan.feat .plan-price small, .plan.feat .plan-note, .plan.feat .spec-r span, .plan.feat .spec-h { color: rgba(9, 11, 10, 0.62); }
.plan.feat .spec { border-top-color: rgba(9, 11, 10, 0.16); }
.plan.feat .spec-r { border-bottom-color: rgba(9, 11, 10, 0.12); }
.plan.feat .spec-r b { color: var(--ink); }

/* ── Closing ── */
.end { position: relative; overflow: hidden; border-top: 1px solid var(--line); background: radial-gradient(560px circle at var(--mx, 50%) var(--my, 40%), rgba(232, 231, 225, 0.06), transparent 62%); }
.end-in { max-width: 1480px; margin: 0 auto; padding: 210px var(--gutter); display: flex; flex-direction: column; gap: 52px; }
.end h2 { margin: 0; font: 300 9rem/0.96 var(--f-display); letter-spacing: -0.05em; text-wrap: balance; max-width: 10em; }
.end-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 28px; }

@media (max-width: 1000px) {
  .plans { grid-template-columns: minmax(0, 1fr); max-width: 560px; margin: 0 auto; }
}
@media (max-width: 900px) {
  .nav { grid-template-columns: 1fr auto; }
  .links { display: none; }
  .signin { display: none; }
  .sec-h { grid-template-columns: minmax(0, 1fr); align-items: start; }
  .hero-core { padding-top: 112px; }
  .hero.compact .hero-core { padding-top: 120px; }
}
/* Small screens get one fixed smaller step — still no fluid scaling. */
@media (max-width: 720px) {
  .hero-h { font-size: 2.4rem; }
  .h2 { font-size: 2rem; }
  .sec { padding-top: 80px; padding-bottom: 80px; }
  .sec-h { gap: 24px; margin-bottom: 40px; }
  .plan-price { font-size: 3rem; }
  .end-in { padding-top: 100px; padding-bottom: 100px; gap: 28px; }
  .end h2 { font-size: 2.8rem; }
}
@media (prefers-reduced-motion: reduce) {
  .grain, .eye-p { animation: none; }
}
`;

/* ── Small pieces ───────────────────────────────────────────── */

export function Arrow() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M3 9L9 3M4 3h5v5" />
    </svg>
  );
}

export function Shell({ children, css = '' }: { children: ReactNode; css?: string }) {
  useFonts();
  useSmoothScroll();
  return (
    <div className="sq">
      <style>{SQ_CSS + css}</style>
      <div className="grain" aria-hidden="true" />
      {children}
      <Footer />
    </div>
  );
}

/* ── Nav ────────────────────────────────────────────────────── */

export type NavLinkItem = { label: string; href?: string; to?: string };

export function Nav({ links }: { links: NavLinkItem[] }) {
  const { user } = useAuth();
  const [solid, setSolid] = React.useState(false);
  useEffect(() => {
    const on = () => setSolid(window.scrollY > 40);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return (
    <header className={`nav${solid ? ' solid' : ''}`}>
      <Link to="/" className="brand">
        <SquidLogo size={20} mono /> SquidCloud
      </Link>
      <nav className="links" aria-label="Primary">
        {links.map((l) =>
          l.to ? (
            <Link key={l.label} to={l.to}>{l.label}</Link>
          ) : (
            <a key={l.label} href={l.href} onClick={(e) => l.href && scrollToId(e, l.href.replace('#', ''))}>{l.label}</a>
          ),
        )}
      </nav>
      <div className="nav-r">
        {!user && <Link to="/auth" className="signin">Sign in</Link>}
        <Link to={user ? '/dashboard' : '/auth?tab=signup'} className="btn btn-fill sm">
          <span>{user ? 'Dashboard' : 'Get started'}</span>
          <i><Arrow /></i>
        </Link>
      </div>
    </header>
  );
}

/* ── Hero field, wordmark, eye ──────────────────────────────── */

function useFitWidth() {
  const box = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    // The fit writes font-size, which changes this box's height and so re-triggers the
    // observer. Doing that write inside the callback makes the browser report a
    // ResizeObserver loop, so measure and write on the next frame instead.
    let raf = 0;
    const fit = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const b = box.current;
        const t = text.current;
        if (!b || !t) return;
        t.style.fontSize = '100px';
        const w = t.offsetWidth;
        if (w > 0) t.style.fontSize = `${(100 * b.clientWidth) / w}px`;
      });
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (box.current) ro.observe(box.current);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);
  return { box, text };
}

export function SquidEye() {
  const pupil = useRef<SVGGElement>(null);
  const wrap = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const move = (e: MouseEvent) => {
      const el = wrap.current;
      const p = pupil.current;
      if (!el || !p) return;
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2);
      const dy = (e.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2);
      p.style.transform = `translate(${Math.max(-1, Math.min(1, dx)) * 11}px, ${Math.max(-1, Math.min(1, dy)) * 7}px)`;
    };
    window.addEventListener('mousemove', move, { passive: true });
    return () => window.removeEventListener('mousemove', move);
  }, []);
  return (
    <span className="eye" ref={wrap}>
      <svg viewBox="0 0 120 100" aria-hidden="true">
        <ellipse cx="60" cy="50" rx="49" ry="39" fill="none" stroke="currentColor" strokeWidth="22" />
        <g ref={pupil} style={{ transition: 'transform 0.22s ease-out' }}>
          <rect className="eye-p" x="43" y="44" width="34" height="12" rx="6" fill="currentColor" />
        </g>
      </svg>
    </span>
  );
}

export function Wordmark({ reduce }: { reduce: boolean }) {
  const { box, text } = useFitWidth();
  const letters: Array<string | null> = ['S', 'Q', 'U', 'I', 'D', 'C', 'L', null, 'U', 'D'];
  return (
    <div className="mark-pad">
      <div className="mark-clip" ref={box} role="img" aria-label="SquidCloud">
        <span className="mark" ref={text} aria-hidden="true">
          {letters.map((ch, i) => (
            <motion.span
              key={i}
              className="lt"
              initial={reduce ? false : { y: '115%' }}
              animate={{ y: 0 }}
              transition={{ duration: 1.2, ease, delay: 0.6 + i * 0.05 }}
            >
              {ch === null ? <SquidEye /> : ch}
            </motion.span>
          ))}
        </span>
      </div>
    </div>
  );
}

/* Slow fog bands on a tiny canvas, blurred up by CSS. */
export function Field({ reduce }: { reduce: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const SCALE = 0.4;
    let w = 2;
    let h = 2;
    let raf = 0;
    let visible = true;
    const m = { x: 0.5, y: 0.5, sx: 0.5, sy: 0.5 };
    const fog = [
      { y: 0.28, rx: 0.7, ry: 0.22, sp: 0.00011, ph: 0, depth: 0.6, c: '96,108,102', a: 0.55 },
      { y: 0.2, rx: 0.45, ry: 0.16, sp: 0.00013, ph: 1, depth: 0.8, c: '70,82,78', a: 0.45 },
      { y: 0.5, rx: 0.55, ry: 0.1, sp: 0.00016, ph: 2, depth: 1, c: '158,156,142', a: 0.5 },
      { y: 0.66, rx: 0.85, ry: 0.2, sp: 0.00009, ph: 4, depth: 0.4, c: '14,17,15', a: 0.95 },
    ];
    const draw = (t: number) => {
      m.sx += (m.x - m.sx) * 0.04;
      m.sy += (m.y - m.sy) * 0.04;
      ctx.fillStyle = '#090b0a';
      ctx.fillRect(0, 0, w, h);
      for (const f of fog) {
        const cx = w * (0.5 + Math.sin(t * f.sp + f.ph) * 0.18 + (m.sx - 0.5) * 0.08 * f.depth);
        const cy = h * (f.y + Math.cos(t * f.sp * 0.8 + f.ph) * 0.03 + (m.sy - 0.5) * 0.04 * f.depth);
        const R = w * f.rx;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(1, (f.ry * h) / R);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
        g.addColorStop(0, `rgba(${f.c},${f.a})`);
        g.addColorStop(1, `rgba(${f.c},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(-R, -R, R * 2, R * 2);
        ctx.restore();
      }
    };
    const resize = () => {
      const r = c.getBoundingClientRect();
      w = Math.max(2, Math.floor(r.width * SCALE));
      h = Math.max(2, Math.floor(r.height * SCALE));
      c.width = w;
      c.height = h;
      draw(performance.now());
    };
    const loop = (t: number) => {
      if (visible) draw(t);
      raf = requestAnimationFrame(loop);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(c);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
    });
    io.observe(c);
    const onMove = (e: MouseEvent) => {
      m.x = e.clientX / window.innerWidth;
      m.y = e.clientY / window.innerHeight;
    };
    if (!reduce) {
      window.addEventListener('mousemove', onMove, { passive: true });
      raf = requestAnimationFrame(loop);
    }
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener('mousemove', onMove);
    };
  }, [reduce]);
  return <canvas ref={ref} aria-hidden="true" />;
}

/* ── Pricing: data, toggle, cards ───────────────────────────── */

export type Billing = 'weekly' | 'monthly' | 'annual';

export const BILLING_OPTIONS: { value: Billing; label: string; badge?: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'annual', label: 'Annual', badge: '4 mos free' },
];

const PLAN_PRICES = {
  supporter: { weekly: '$0.75', monthly: '$4', annual: '$32' },
  'supporter-plus': { weekly: '$1.89', monthly: '$10', annual: '$80' },
};

type Feature = readonly [string, string];

const FREE_FEATURES: readonly Feature[] = [
  ['Unlimited', 'storage, forever'],
  ['2', 'concurrent uploads'],
  ['2', 'concurrent downloads'],
  ['1 GB', 'max file size'],
  ['20', 'file uploads / day'],
  ['1,000', 'API tokens / day'],
];

const SUPP_FEATURES: readonly Feature[] = [
  ['10', 'concurrent uploads'],
  ['10', 'concurrent downloads'],
  ['12 GB', 'max file size'],
  ['50', 'file uploads / day'],
  ['10,000', 'API tokens / day'],
  ['Priority', 'processing queue'],
  ['Included', 'custom domains'],
  ['Before public', 'early access'],
];

const PLUS_FEATURES: readonly Feature[] = [
  ['Unlimited', 'concurrency, file size & tokens'],
  ['100', 'file uploads / day'],
  ['Top priority', 'processing queue'],
  ['Always active', 'published sites'],
  ['Before Supporter', 'early access'],
];

export function BillingToggle({ billing, onChange }: { billing: Billing; onChange: (b: Billing) => void }) {
  const id = useId();
  return (
    <div className="bill" role="group" aria-label="Billing period">
      {BILLING_OPTIONS.map((b) => (
        <button key={b.value} type="button" aria-pressed={billing === b.value} onClick={() => onChange(b.value)}>
          {billing === b.value && (
            <motion.span className="pill" layoutId={`pill-${id}`} transition={{ duration: 0.45, ease }} />
          )}
          {b.label}
          {b.badge && <span className="bdg">{b.badge}</span>}
        </button>
      ))}
    </div>
  );
}

function Price({ value }: { value: string }) {
  return (
    <span className="price">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: '70%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '-70%', opacity: 0 }}
          transition={{ duration: 0.45, ease }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

type PlanDef = {
  id: string;
  name: string;
  tag: string;
  price: string;
  per?: string;
  note: string;
  cta: string;
  lead?: string;
  items: readonly Feature[];
  feat?: boolean;
};

export function PlanCards({ billing }: { billing: Billing }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const reduce = !!useReducedMotion();
  const userTier = (profile?.tier as string) ?? 'free';

  const go = (planId: string) => {
    if (planId === 'free') {
      navigate('/auth');
      return;
    }
    navigate(`/checkout?plan=${planId}&billing=${billing}`);
  };

  const per = billing === 'annual' ? 'year' : billing === 'weekly' ? 'week' : 'month';
  const note = (annual: string, monthly: string) =>
    billing === 'annual' ? `${annual} billed once a year` : billing === 'weekly' ? 'billed every 7 days' : `${monthly} billed monthly`;

  const plans: PlanDef[] = [
    { id: 'free', name: 'Free', tag: 'Unlimited storage, always', price: '$0', note: 'free forever', cta: 'Get started', items: FREE_FEATURES },
    {
      id: 'supporter', name: 'Supporter', tag: 'For serious creators',
      price: PLAN_PRICES.supporter[billing], per, note: note('$32', '$4'), cta: 'Go Supporter',
      lead: 'Everything in Free, plus:', items: SUPP_FEATURES,
    },
    {
      id: 'supporter-plus', name: 'Supporter+', tag: 'For power users & teams',
      price: PLAN_PRICES['supporter-plus'][billing], per, note: note('$80', '$10'), cta: 'Go Unlimited',
      lead: 'Everything in Supporter, plus:', items: PLUS_FEATURES, feat: true,
    },
  ];

  const spot = (e: React.MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
  };

  return (
    <div className="plans" id="plans-grid">
      {plans.map((p, i) => {
        const current = userTier === p.id;
        return (
          <motion.div
            className="plan-w"
            key={p.id}
            initial={reduce ? false : { opacity: 0, y: 26 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.9, ease, delay: i * 0.08 }}
          >
            <article className={`plan${p.feat ? ' feat' : ''}`} onMouseMove={spot}>
              <div className="plan-name">
                <span>{p.name}</span>
                {p.feat && <span className="plan-flag">Best value</span>}
              </div>
              <p className="plan-tag">{p.tag}</p>
              <div className="plan-price">
                <Price value={p.price} />
                {p.per && <small>/{p.per}</small>}
              </div>
              <p className="plan-note">{p.note}</p>
              <div className="plan-cta">
                <button
                  type="button"
                  disabled={current}
                  onClick={() => !current && go(p.id)}
                  className={`btn ${p.feat ? 'btn-ink' : p.id === 'free' ? 'btn-ghost' : 'btn-fill'}`}
                >
                  <span>{current ? 'Current plan' : p.cta}</span>
                  {p.id !== 'free' && !current && <i><Arrow /></i>}
                </button>
              </div>
              <div className="spec">
                {p.lead && <p className="spec-h">{p.lead}</p>}
                {p.items.map(([val, label]) => (
                  <div className="spec-r" key={label}>
                    <b>{val}</b>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </article>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ── Closing ────────────────────────────────────────────────── */

export function Closing({ title, body }: { title: string; body: string }) {
  const { user } = useAuth();
  const ref = useRef<HTMLElement>(null);
  const onMove = (e: React.MouseEvent<HTMLElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  };
  return (
    <section className="end" ref={ref} onMouseMove={onMove}>
      <div className="end-in">
        <h2>{title}</h2>
        <div className="end-row">
          <p className="lede">{body}</p>
          <div className="hero-ctas" style={{ margin: 0 }}>
            <Link to={user ? '/dashboard' : '/auth?tab=signup'} className="btn btn-fill">
              <span>{user ? 'Open dashboard' : 'Create free account'}</span>
              <i><Arrow /></i>
            </Link>
            <Link to="/docs" className="btn btn-ghost">Read the docs</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
