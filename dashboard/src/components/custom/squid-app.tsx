import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode, CSSProperties, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import SquidLogo from '@/components/ui/SquidLogo';

/* ═══════════════════════════════════════════════════════════════
   SQUIDCLOUD · WORKBENCH LAYER
   The same visual language as the homepage and pricing page
   (squid-ui.tsx), tuned for people who sit in it for hours:

   · no animated grain / fog, no scroll theatre
   · 13px density, 48px top bar, hairline structure instead of cards
   · every text colour clears WCAG AA on its surface
   · focus rings, reduced-motion, keyboard hints, skeleton / empty /
     error states are first-class
   · dark by default, light via  html.light  or  [data-theme="light"]

   Place at: src/components/custom/squid-app.tsx

   HOW THE THEMING REACHES EXISTING COMPONENTS
   <AppTheme /> adds the class `sq-app-root` to <html> while a page is
   mounted and overrides the shadcn variables (--background, --card,
   --primary …) under that class. Because Radix portals (dialogs,
   dropdowns, selects, toasts) render into <body>, they inherit it too,
   so every shadcn component and every untouched child component picks
   up the new look without being edited. The variable format (HSL
   triplet vs full colour) is detected from your existing stylesheet.
   ═══════════════════════════════════════════════════════════════ */

/* ── Tokens ─────────────────────────────────────────────────── */

type Tok = {
  bg: string; bg2: string; bg3: string; bg4: string;
  text: string; text2: string; mute: string; dim: string;
  line: string; line2: string;
  ok: string; warn: string; err: string; info: string;
  pop: string; destructive: string;
};

const DARK: Tok = {
  bg: '#090b0a', bg2: '#0e1110', bg3: '#141816', bg4: '#1b201d',
  text: '#e8e7e1', text2: '#b9bab3', mute: '#8d8f89', dim: '#62655f',
  line: '#1f2221', line2: '#2f3230',
  ok: '#86c3a1', warn: '#d9ac62', err: '#e5796f', info: '#8fb4d9',
  pop: '#101412', destructive: '#c4443a',
};

const LIGHT: Tok = {
  bg: '#f3f2ec', bg2: '#faf9f5', bg3: '#ebeae2', bg4: '#e2e1d8',
  text: '#121513', text2: '#3a3e3b', mute: '#666a64', dim: '#9b9e97',
  line: '#dddcd3', line2: '#c6c5bb',
  ok: '#2c7a52', warn: '#8f6310', err: '#b3433a', info: '#2b5f94',
  pop: '#fcfbf8', destructive: '#b3433a',
};

function hexToTriplet(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return `${Math.round(h * 10) / 10} ${Math.round(s * 1000) / 10}% ${Math.round(l * 1000) / 10}%`;
}

type VarFormat = 'triplet' | 'color';
let DETECTED: VarFormat | null = null;

/** shadcn ships HSL triplets ("222 47% 11%") in Tailwind v3 and full colours
 *  ("oklch(…)") in v4. Read what the app already uses so we write the same. */
function detectFormat(): VarFormat {
  if (DETECTED) return DETECTED;
  if (typeof document === 'undefined') return 'triplet';
  const root = document.documentElement;
  if (root.classList.contains('sq-app-root')) return 'triplet';
  const raw = getComputedStyle(root).getPropertyValue('--background').trim();
  DETECTED = raw && !/^[\d.]+\s+[\d.]+%\s+[\d.]+%/.test(raw) ? 'color' : 'triplet';
  return DETECTED;
}

function themeBlock(t: Tok, fmt: VarFormat): string {
  const v = (hex: string) => (fmt === 'triplet' ? hexToTriplet(hex) : hex);
  return `
  --sa-bg:${t.bg}; --sa-bg-2:${t.bg2}; --sa-bg-3:${t.bg3}; --sa-bg-4:${t.bg4};
  --sa-text:${t.text}; --sa-text-2:${t.text2}; --sa-mute:${t.mute}; --sa-dim:${t.dim};
  --sa-line:${t.line}; --sa-line-2:${t.line2};
  --sa-ok:${t.ok}; --sa-warn:${t.warn}; --sa-err:${t.err}; --sa-info:${t.info};
  --background:${v(t.bg)}; --foreground:${v(t.text)};
  --card:${v(t.bg2)}; --card-foreground:${v(t.text)};
  --popover:${v(t.pop)}; --popover-foreground:${v(t.text)};
  --primary:${v(t.text)}; --primary-foreground:${v(t.bg)};
  --secondary:${v(t.bg3)}; --secondary-foreground:${v(t.text)};
  --muted:${v(t.bg3)}; --muted-foreground:${v(t.mute)};
  --accent:${v(t.bg3)}; --accent-foreground:${v(t.text)};
  --destructive:${v(t.destructive)}; --destructive-foreground:${v('#fafaf7')};
  --border:${v(t.line)}; --input:${v(t.line2)}; --ring:${v(t.text2)};
  --sidebar-background:${v(t.bg)}; --sidebar-foreground:${v(t.text2)};
  --sidebar-primary:${v(t.text)}; --sidebar-primary-foreground:${v(t.bg)};
  --sidebar-accent:${v(t.bg3)}; --sidebar-accent-foreground:${v(t.text)};
  --sidebar-border:${v(t.line)}; --sidebar-ring:${v(t.text2)};`;
}

const GRAIN_URI =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

function buildCss(fmt: VarFormat): string {
  return `
html.sq-app-root {
  color-scheme: dark;
  --sa-f: 'Hanken Grotesk', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --sa-mono: 'Geist Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  --sa-ease: cubic-bezier(0.16, 1, 0.3, 1);
  --sa-gut: clamp(16px, 2.6vw, 32px);
  --radius: 0.3rem;
  ${themeBlock(DARK, fmt)}
}
html.sq-app-root.light, html.sq-app-root[data-theme="light"] {
  color-scheme: light;
  ${themeBlock(LIGHT, fmt)}
}

/* ── Global: only while an app page is mounted ── */
html.sq-app-root, html.sq-app-root body { background: var(--sa-bg); color: var(--sa-text); }
html.sq-app-root body { font-family: var(--sa-f); -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility; }
html.sq-app-root ::selection { background: var(--sa-text); color: var(--sa-bg); }
html.sq-app-root * { scrollbar-width: thin; scrollbar-color: var(--sa-line-2) transparent; }
html.sq-app-root *::-webkit-scrollbar { width: 10px; height: 10px; }
html.sq-app-root *::-webkit-scrollbar-thumb { background: var(--sa-line-2); border-radius: 10px; border: 3px solid transparent; background-clip: content-box; }
html.sq-app-root *::-webkit-scrollbar-thumb:hover { background: var(--sa-dim); background-clip: content-box; border: 3px solid transparent; }
html.sq-app-root *::-webkit-scrollbar-track { background: transparent; }

/* Hanken Grotesk is loaded 300–500; faux-bold looks cheap, so cap it. */
html.sq-app-root .font-bold, html.sq-app-root .font-semibold, html.sq-app-root .font-extrabold,
html.sq-app-root h1, html.sq-app-root h2, html.sq-app-root h3, html.sq-app-root h4,
html.sq-app-root h5, html.sq-app-root h6, html.sq-app-root strong, html.sq-app-root b,
html.sq-app-root th { font-weight: 500; }
html.sq-app-root code, html.sq-app-root kbd, html.sq-app-root pre, html.sq-app-root samp,
html.sq-app-root .font-mono { font-family: var(--sa-mono); }
html.sq-app-root .tabular-nums, html.sq-app-root table { font-variant-numeric: tabular-nums; }

html.sq-app-root .rounded-xl, html.sq-app-root .rounded-2xl { border-radius: 6px; }
html.sq-app-root .shadow-sm { box-shadow: none; }
html.sq-app-root .shadow, html.sq-app-root .shadow-md, html.sq-app-root .shadow-lg,
html.sq-app-root .shadow-xl, html.sq-app-root .shadow-2xl { box-shadow: 0 18px 44px -18px rgba(0, 0, 0, 0.55); }
html.sq-app-root.light .shadow, html.sq-app-root.light .shadow-md, html.sq-app-root.light .shadow-lg,
html.sq-app-root.light .shadow-xl, html.sq-app-root.light .shadow-2xl { box-shadow: 0 18px 44px -20px rgba(20, 24, 22, 0.28); }

/* Legacy glass utilities used by the dashboard, flattened to hairlines */
html.sq-app-root .lg-card { background: var(--sa-bg-2); border: 1px solid var(--sa-line); border-radius: 6px; box-shadow: none; -webkit-backdrop-filter: none; backdrop-filter: none; }
html.sq-app-root .lg-dropdown { background: var(--sa-bg-2); border: 1px solid var(--sa-line-2); border-radius: 6px; -webkit-backdrop-filter: none; backdrop-filter: none; }
html.sq-app-root .lg-tab-group { display: inline-flex; gap: 2px; padding: 2px; border: 1px solid var(--sa-line); border-radius: 5px; background: var(--sa-bg-2); box-shadow: none; }
html.sq-app-root .lg-tab { display: inline-grid; place-items: center; height: 26px; min-width: 28px; padding: 0 6px; border-radius: 3px; color: var(--sa-mute); background: transparent; border: 0; box-shadow: none; transition: color 0.15s, background 0.15s; }
html.sq-app-root .lg-tab:hover { color: var(--sa-text); }
html.sq-app-root .lg-tab-active, html.sq-app-root .lg-tab.lg-tab-active { background: var(--sa-bg-4); color: var(--sa-text); }
html.sq-app-root .lg-title { font: 400 24px/1.2 var(--sa-f); letter-spacing: -0.02em; color: var(--sa-text); }
html.sq-app-root .lg-section-header { font: 400 11px/1 var(--sa-mono); letter-spacing: 0.12em; text-transform: uppercase; color: var(--sa-mute); }
html.sq-app-root .lg-caption { font-size: 12.5px; line-height: 1.55; color: var(--sa-mute); }
html.sq-app-root .lg-body { font-size: 14px; line-height: 1.4; color: var(--sa-text); }
html.sq-app-root .lg-press-subtle, html.sq-app-root .sq-press { transition: background 0.15s, color 0.15s, border-color 0.15s, transform 0.15s var(--sa-ease); }
html.sq-app-root .lg-press-subtle:active, html.sq-app-root .sq-press:active { transform: scale(0.97); }
html.sq-app-root .sq-tab-enter { animation: sa-in 0.18s var(--sa-ease) both; }
/* keyboard-navigated file items in the dashboard */
html.sq-app-root [data-kbd-item]:focus-visible { outline: 1px solid var(--sa-text); outline-offset: 2px; border-radius: 6px; }
@keyframes sa-in { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: none; } }

/* ── Reconcile with the app's own global stylesheet (index.css / globals.css) ──
   Everything below targets classes that already exist in the app and are used
   by components these pages do not own (file cards, badges, glass tiers …). */
html.sq-app-root { --radius-card: 8px; --radius-file: 6px; --blur-sm: 0px; --blur-md: 0px; --blur-lg: 0px; --blur-xl: 0px; --blur-2xl: 0px; }

/* Viewport units under html { zoom } (globals.css) overshoot by the zoom factor. */
html.sq-app-root .h-screen { height: calc(100vh / var(--sa-zoom, 1)); }
html.sq-app-root .min-h-screen { min-height: calc(100vh / var(--sa-zoom, 1)); }
html.sq-app-root .max-h-screen { max-height: calc(100vh / var(--sa-zoom, 1)); }

/* Text must stay selectable where people copy from it (docs, keys, endpoints, code).
   The app sets user-select:none on <body>; the dashboard keeps that, these pages do not. */
html.sq-app-root .sa, html.sq-app-root :is(input, textarea, select, pre, code, samp, [contenteditable="true"]) { -webkit-user-select: text; user-select: text; }
html.sq-app-root .sa :is(button, summary, [role="tab"], [role="button"], .sa-btn, .sa-nav-i, .sa-top, th) { -webkit-user-select: none; user-select: none; }

/* One calm focus ring for every control (globals.css paints a blue one on buttons/links). */
html.sq-app-root :is(button, a, summary, [role="button"], [role="tab"], [tabindex]:not([tabindex="-1"])):focus-visible { outline: 1px solid var(--sa-text); outline-offset: 2px; }
/* No spring overshoot on controls in a tool people use all day. */
html.sq-app-root :is(button, a, [role="button"], summary, [tabindex]) { transition-timing-function: cubic-bezier(0.2, 0, 0, 1); transition-duration: 120ms; }

/* Glass tiers → flat, opaque, hairline. No blur, no sheen, no tint. */
html.sq-app-root :is(.lg, .lg-strong, .lg-subtle, .lg-surface, .lg-raised, .lg-elevated, .lg-modal, .lg-toolbar, .lg-surface-raised, .glass-card, .glass-surface, .glass-button, .liquid-glass, .liquid-glass-card, .liquid-glass-surface, .liquid-glass-nav, .liquid-glass-ios, .mono-glass, .mono-glass-strong, .mono-glass-subtle, .glass-effect, .backdrop-blur-smooth) {
  -webkit-backdrop-filter: none; backdrop-filter: none; background-image: none; box-shadow: none;
  background-color: var(--sa-bg-2); border-color: var(--sa-line); }
html.sq-app-root :is(.lg, .lg-strong, .lg-subtle, .mono-glass, .mono-glass-strong, .mono-glass-subtle)::after { display: none; }
html.sq-app-root .lg-toolbar { background-color: var(--sa-bg); border-bottom: 1px solid var(--sa-line); }
html.sq-app-root :is(.lg-card, .lg-card-premium, .material-card, .liquid-glass-card, .liquid-glass-ios):is(:hover, :active) { transform: none; box-shadow: none; border-color: var(--sa-line-2); }
html.sq-app-root .lg-card { transform: none; }
html.sq-app-root .lg-glow:hover { box-shadow: none; }

/* File cards / rows — the surface the dashboard lives on */
html.sq-app-root .lg-card-file { background: transparent; border: 1px solid transparent; border-radius: var(--radius-file); will-change: auto; transition: background-color 0.12s, border-color 0.12s; }
html.sq-app-root .lg-card-file:hover { background: var(--sa-bg-3); border-color: var(--sa-line); }
html.sq-app-root .lg-card-file:active { transform: none; }
html.sq-app-root .lg-card-file.selected { background: var(--sa-bg-4); border-color: var(--sa-text-2); }
html.sq-app-root .lg-selected { border-color: var(--sa-text-2) !important; box-shadow: 0 0 0 1px var(--sa-text-2); }
@media (min-width: 1024px) { html.sq-app-root .lg-card-file-list-row { min-height: 40px; } }

/* Badges, labels and captions: hairline mono, text that clears AA */
html.sq-app-root .lg-badge { padding: 1px 6px; border-radius: 4px; border: 1px solid var(--sa-line-2); background: transparent; color: var(--sa-text-2); font: 400 10.5px/1.4 var(--sa-mono); letter-spacing: 0.04em; text-transform: uppercase; }
html.sq-app-root .lg-badge-primary { background: var(--sa-bg-4); color: var(--sa-text); }
html.sq-app-root .lg-badge-success { color: var(--sa-ok); border-color: color-mix(in srgb, var(--sa-ok) 45%, transparent); background: transparent; }
html.sq-app-root .lg-badge-warning { color: var(--sa-warn); border-color: color-mix(in srgb, var(--sa-warn) 45%, transparent); background: transparent; }
html.sq-app-root .lg-badge-danger { color: var(--sa-err); border-color: color-mix(in srgb, var(--sa-err) 45%, transparent); background: transparent; }
html.sq-app-root :is(.lg-stat-label, .lg-text-label, .lg-label) { font: 400 11px/1.3 var(--sa-mono); letter-spacing: 0.1em; text-transform: uppercase; color: var(--sa-mute); }
html.sq-app-root :is(.lg-text-caption, .lg-text-meta) { color: var(--sa-mute); }
html.sq-app-root .lg-empty { border: 1px dashed var(--sa-line-2); background: transparent; border-radius: var(--radius-card); }
html.sq-app-root :is(.lg-icon-box, .lg-icon-box-sm) { border-radius: 6px; }
html.sq-app-root .lg-shimmer { border-radius: 4px; background: linear-gradient(90deg, var(--sa-bg-3) 0%, var(--sa-bg-4) 50%, var(--sa-bg-3) 100%); background-size: 200% 100%; }
html.sq-app-root .liquid-glass-upload-zone { border-width: 1px; border-radius: var(--radius-card); background: transparent; }
html.sq-app-root .lg-press:active { transform: scale(0.98); }

/* Actions that only appear on hover must also appear for keyboard users */
html.sq-app-root :is(.lg-hover-reveal, .lg-hover-reveal-subtle) { transition: opacity 0.12s; }
html.sq-app-root :focus-within > :is(.lg-hover-reveal, .lg-hover-reveal-subtle),
html.sq-app-root .group:focus-within :is(.lg-hover-reveal, .lg-hover-reveal-subtle) { opacity: 1; }

/* Ambient motion has no place in an all-day tool */
html.sq-app-root :is(.sq-live-dot, .glow-pulse, .animate-gradient-x, .animate-ambient-1, .animate-ambient-2, .lg-stagger > *) { animation: none; }
html.sq-app-root .mono-aurora::before { display: none; }
html.sq-app-root :is(.lg-entrance-fade, .lg-entrance-scale, .lg-entrance-slide, .lg-glass-enter, .animate-enter, .slide-fade-in) { animation-duration: 0.14s; }

/* ── App shell ── */
.sa { position: relative; min-height: calc(100vh / var(--sa-zoom, 1)); background: var(--sa-bg); color: var(--sa-text); font-family: var(--sa-f); font-size: 14px; line-height: 1.5; }
.sa *, .sa *::before, .sa *::after { box-sizing: border-box; }
.sa a { color: inherit; }
:where(.sa) a:focus-visible, :where(.sa) summary:focus-visible, :where(.sa) [role="tab"]:focus-visible,
:where(.sa) .sa-btn:focus-visible, :where(.sa) .sa-nav-i:focus-visible, :where(.sa) .sa-seg button:focus-visible,
:where(.sa) .sa-link:focus-visible, :where(.sa) .sa-focusable:focus-visible { outline: 1px solid var(--sa-text); outline-offset: 2px; }
.sa-mono { font-family: var(--sa-mono); }
.sa-num { font-family: var(--sa-mono); font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
.sa-mute { color: var(--sa-mute); }
.sa-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.sa-link { color: var(--sa-text); text-decoration: underline; text-decoration-color: var(--sa-line-2); text-underline-offset: 3px; transition: text-decoration-color 0.2s; }
.sa-link:hover { text-decoration-color: var(--sa-text); }
.sa-grain { position: absolute; inset: 0; pointer-events: none; background-image: ${GRAIN_URI}; background-size: 240px 240px; opacity: 0.055; mix-blend-mode: screen; }
html.light .sa-grain, html[data-theme="light"] .sa-grain { opacity: 0.05; mix-blend-mode: multiply; filter: invert(1); }

/* Top bar */
.sa-top { position: sticky; top: 0; z-index: 40; display: flex; align-items: center; gap: 12px; height: 48px; padding: 0 var(--sa-gut); border-bottom: 1px solid var(--sa-line); background: color-mix(in srgb, var(--sa-bg) 88%, transparent); -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px); }
.sa-brand { display: inline-flex; align-items: center; gap: 9px; font: 500 14px/1 var(--sa-f); letter-spacing: -0.01em; text-decoration: none; color: var(--sa-text); flex: none; }
.sa-crumbs { display: flex; align-items: center; gap: 8px; min-width: 0; font-size: 13px; color: var(--sa-mute); }
.sa-crumbs a { text-decoration: none; transition: color 0.15s; white-space: nowrap; }
.sa-crumbs a:hover { color: var(--sa-text); }
.sa-crumbs .cur { color: var(--sa-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sa-sep { color: var(--sa-dim); user-select: none; }
.sa-top-r { margin-left: auto; display: flex; align-items: center; gap: 6px; flex: none; }
@media (max-width: 640px) { .sa-crumbs .hide-sm, .sa-top .hide-sm { display: none; } }

/* Page frame */
.sa-wrap { width: 100%; max-width: 1120px; margin: 0 auto; padding: 28px var(--sa-gut) 96px; }
.sa-wrap.narrow { max-width: 760px; }
.sa-wrap.wide { max-width: 1400px; }
.sa-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; flex-wrap: wrap; padding-bottom: 22px; margin-bottom: 24px; border-bottom: 1px solid var(--sa-line); }
.sa-eyebrow { font: 400 11px/1 var(--sa-mono); letter-spacing: 0.14em; text-transform: uppercase; color: var(--sa-mute); margin-bottom: 12px; }
.sa-title { margin: 0; font: 400 clamp(24px, 2.6vw, 30px)/1.12 var(--sa-f); letter-spacing: -0.025em; color: var(--sa-text); }
.sa-desc { margin: 8px 0 0; max-width: 62ch; font-size: 14px; line-height: 1.55; color: var(--sa-text-2); }
.sa-head-r { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

/* Panels & rows */
.sa-panel { background: var(--sa-bg-2); border: 1px solid var(--sa-line); border-radius: 5px; }
.sa-panel + .sa-panel { margin-top: 16px; }
.sa-panel-h { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 13px 16px; border-bottom: 1px solid var(--sa-line); }
.sa-panel-t { margin: 0; font: 500 13px/1.3 var(--sa-f); letter-spacing: -0.005em; color: var(--sa-text); }
.sa-panel-d { margin: 3px 0 0; font-size: 12.5px; line-height: 1.5; color: var(--sa-mute); }
.sa-panel-b { padding: 16px; }
.sa-panel-b.flush { padding: 0; }
.sa-panel.danger { border-color: color-mix(in srgb, var(--sa-err) 38%, var(--sa-line)); }
.sa-panel.danger .sa-panel-h { border-bottom-color: color-mix(in srgb, var(--sa-err) 24%, var(--sa-line)); }
.sa-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 8px 24px; padding: 14px 16px; }
.sa-row + .sa-row, .sa-panel-b.flush > .sa-row:not(:first-child) { border-top: 1px solid var(--sa-line); }
.sa-row.top { align-items: start; }
.sa-row-l { min-width: 0; }
.sa-row-t { font: 500 13.5px/1.35 var(--sa-f); color: var(--sa-text); }
.sa-row-d { margin-top: 3px; font-size: 12.5px; line-height: 1.5; color: var(--sa-mute); }
.sa-row-r { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; min-width: 0; }
@media (max-width: 640px) { .sa-row { grid-template-columns: 1fr; } .sa-row-r { justify-content: flex-start; } }
.sa-sh { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; margin: 32px 0 12px; }
.sa-sh:first-child { margin-top: 0; }
.sa-sh h2 { margin: 0; font: 500 13px/1.3 var(--sa-f); color: var(--sa-text); }
.sa-sh p { margin: 3px 0 0; font-size: 12.5px; color: var(--sa-mute); }

/* Key / value, stats */
.sa-kv { display: grid; grid-template-columns: minmax(110px, 200px) minmax(0, 1fr); gap: 9px 20px; font-size: 13px; margin: 0; }
.sa-kv dt { color: var(--sa-mute); }
.sa-kv dd { margin: 0; color: var(--sa-text); word-break: break-word; }
.sa-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); border: 1px solid var(--sa-line); border-radius: 5px; background: var(--sa-bg-2); overflow: hidden; }
.sa-stat { padding: 16px; border-right: 1px solid var(--sa-line); border-bottom: 1px solid var(--sa-line); margin: 0 -1px -1px 0; }
.sa-stat-k { font: 400 10.5px/1 var(--sa-mono); letter-spacing: 0.12em; text-transform: uppercase; color: var(--sa-mute); }
.sa-stat-v { margin-top: 10px; font: 300 26px/1 var(--sa-f); letter-spacing: -0.02em; font-variant-numeric: tabular-nums; color: var(--sa-text); }
.sa-stat-s { margin-top: 8px; font-size: 12px; color: var(--sa-mute); }

/* Controls */
.sa-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 32px; padding: 0 12px; border: 1px solid var(--sa-line-2); border-radius: 4px; background: transparent; color: var(--sa-text); font: 500 13px/1 var(--sa-f); letter-spacing: -0.005em; text-decoration: none; white-space: nowrap; cursor: pointer; transition: background 0.15s, border-color 0.15s, color 0.15s, transform 0.15s var(--sa-ease); }
.sa-btn:hover { background: var(--sa-bg-3); border-color: var(--sa-dim); }
.sa-btn:active { transform: scale(0.98); }
.sa-btn.primary { background: var(--sa-text); color: var(--sa-bg); border-color: var(--sa-text); }
.sa-btn.primary:hover { background: var(--sa-text-2); border-color: var(--sa-text-2); }
.sa-btn.ghost { border-color: transparent; color: var(--sa-text-2); }
.sa-btn.ghost:hover { background: var(--sa-bg-3); color: var(--sa-text); }
.sa-btn.danger { color: var(--sa-err); border-color: color-mix(in srgb, var(--sa-err) 40%, var(--sa-line-2)); }
.sa-btn.danger:hover { background: color-mix(in srgb, var(--sa-err) 12%, transparent); border-color: var(--sa-err); }
.sa-btn.sm { height: 28px; padding: 0 10px; font-size: 12.5px; }
.sa-btn.lg { height: 40px; padding: 0 18px; font-size: 14px; }
.sa-btn.icon { width: 32px; padding: 0; }
.sa-btn.icon.sm { width: 28px; }
.sa-btn.block { width: 100%; }
.sa-btn[disabled], .sa-btn[aria-disabled="true"] { opacity: 0.45; cursor: default; pointer-events: none; }
.sa-btn svg { flex: none; }
.sa-input { width: 100%; height: 32px; padding: 0 10px; border: 1px solid var(--sa-line-2); border-radius: 4px; background: var(--sa-bg-2); color: var(--sa-text); font: 400 13px/1 var(--sa-f); transition: border-color 0.15s, background 0.15s; }
.sa-input::placeholder { color: var(--sa-mute); opacity: 0.8; }
.sa-input:hover { border-color: var(--sa-dim); }
.sa-input:focus { outline: none; border-color: var(--sa-text-2); background: var(--sa-bg); }
.sa-input.pl { padding-left: 32px; }
.sa-input.pr { padding-right: 44px; }
.sa-field-wrap { position: relative; }
.sa-field-wrap > svg, .sa-field-wrap > .ico { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--sa-mute); pointer-events: none; }
.sa-field-wrap > .end { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); display: flex; align-items: center; gap: 4px; }
.sa-label { display: block; margin-bottom: 7px; font: 500 12.5px/1.2 var(--sa-f); color: var(--sa-text-2); }
.sa-hint { margin-top: 6px; font-size: 12px; line-height: 1.5; color: var(--sa-mute); }
.sa-err { margin-top: 6px; font-size: 12px; line-height: 1.5; color: var(--sa-err); }

/* Segmented control */
.sa-seg { display: inline-flex; gap: 2px; padding: 2px; border: 1px solid var(--sa-line); border-radius: 5px; background: var(--sa-bg-2); }
.sa-seg button { height: 26px; padding: 0 11px; border: 0; border-radius: 3px; background: transparent; color: var(--sa-mute); font: 500 12.5px/1 var(--sa-f); cursor: pointer; white-space: nowrap; transition: background 0.15s, color 0.15s; }
.sa-seg button:hover { color: var(--sa-text); }
.sa-seg button[aria-pressed="true"], .sa-seg button[aria-selected="true"] { background: var(--sa-bg-4); color: var(--sa-text); }
.sa-seg.lg button { height: 32px; padding: 0 16px; font-size: 13px; }
.sa-seg.block { display: flex; } .sa-seg.block button { flex: 1; }

/* Underline tabs */
.sa-tabs { display: flex; gap: 22px; overflow-x: auto; border-bottom: 1px solid var(--sa-line); scrollbar-width: none; }
.sa-tabs::-webkit-scrollbar { display: none; }
.sa-tab { appearance: none; display: inline-flex; align-items: center; gap: 7px; padding: 12px 0 11px; margin-bottom: -1px; border: 0; border-bottom: 1px solid transparent; background: none; color: var(--sa-mute); font: 400 13px/1 var(--sa-f); white-space: nowrap; cursor: pointer; transition: color 0.15s, border-color 0.15s; }
.sa-tab:hover { color: var(--sa-text); }
.sa-tab[aria-selected="true"] { color: var(--sa-text); border-bottom-color: var(--sa-text); }
.sa-tab .n { font: 400 10.5px/1 var(--sa-mono); color: var(--sa-mute); }

/* Side navigation (settings, docs) */
.sa-nav { display: flex; flex-direction: column; gap: 1px; }
.sa-nav-h { padding: 18px 10px 7px; font: 400 10.5px/1 var(--sa-mono); letter-spacing: 0.12em; text-transform: uppercase; color: var(--sa-mute); }
.sa-nav-h:first-child { padding-top: 0; }
.sa-nav-i { display: flex; align-items: center; gap: 9px; width: 100%; min-height: 30px; padding: 5px 10px; border: 0; border-radius: 4px; background: transparent; color: var(--sa-text-2); font: 400 13px/1.3 var(--sa-f); text-align: left; text-decoration: none; cursor: pointer; transition: background 0.15s, color 0.15s; }
.sa-nav-i:hover { background: var(--sa-bg-3); color: var(--sa-text); }
.sa-nav-i.on, .sa-nav-i[aria-current="page"], .sa-nav-i[aria-current="true"] { background: var(--sa-bg-4); color: var(--sa-text); }
.sa-nav-i svg { flex: none; color: var(--sa-mute); }
.sa-nav-i.on svg, .sa-nav-i:hover svg { color: var(--sa-text); }
.sa-nav-i .end { margin-left: auto; }

/* Pills, dots, kbd */
.sa-pill { display: inline-flex; align-items: center; gap: 5px; height: 20px; padding: 0 7px; border: 1px solid var(--sa-line-2); border-radius: 3px; font: 400 10.5px/1 var(--sa-mono); letter-spacing: 0.06em; text-transform: uppercase; color: var(--sa-text-2); white-space: nowrap; }
.sa-pill.ok { color: var(--sa-ok); border-color: color-mix(in srgb, var(--sa-ok) 40%, var(--sa-line)); }
.sa-pill.warn { color: var(--sa-warn); border-color: color-mix(in srgb, var(--sa-warn) 40%, var(--sa-line)); }
.sa-pill.err { color: var(--sa-err); border-color: color-mix(in srgb, var(--sa-err) 40%, var(--sa-line)); }
.sa-pill.info { color: var(--sa-info); border-color: color-mix(in srgb, var(--sa-info) 40%, var(--sa-line)); }
.sa-pill.solid { background: var(--sa-text); border-color: var(--sa-text); color: var(--sa-bg); }
.sa-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--sa-dim); flex: none; }
.sa-dot.ok { background: var(--sa-ok); } .sa-dot.warn { background: var(--sa-warn); } .sa-dot.err { background: var(--sa-err); } .sa-dot.info { background: var(--sa-info); }
.sa-dot.pulse { animation: sa-pulse 2.4s ease-in-out infinite; }
@keyframes sa-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
.sa-kbd { display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px; padding: 0 5px; border: 1px solid var(--sa-line-2); border-bottom-width: 2px; border-radius: 3px; background: var(--sa-bg-3); color: var(--sa-text-2); font: 400 10.5px/1 var(--sa-mono); }

/* Meter */
.sa-meter { height: 3px; border-radius: 2px; background: var(--sa-line-2); overflow: hidden; }
.sa-meter > i { display: block; height: 100%; background: var(--sa-text); border-radius: 2px; transition: width 0.5s var(--sa-ease); }
.sa-meter.warn > i { background: var(--sa-warn); } .sa-meter.err > i { background: var(--sa-err); }

/* Notes */
.sa-note { display: flex; gap: 12px; padding: 12px 14px; border: 1px solid var(--sa-line); border-left: 2px solid var(--sa-dim); border-radius: 4px; background: var(--sa-bg-2); font-size: 13px; line-height: 1.55; color: var(--sa-text-2); }
.sa-note b { color: var(--sa-text); font-weight: 500; }
.sa-note.ok { border-left-color: var(--sa-ok); } .sa-note.warn { border-left-color: var(--sa-warn); }
.sa-note.err { border-left-color: var(--sa-err); } .sa-note.info { border-left-color: var(--sa-info); }
.sa-note > svg { flex: none; margin-top: 2px; color: var(--sa-mute); }

/* Code */
.sa-code { border: 1px solid var(--sa-line); border-radius: 5px; background: var(--sa-bg); overflow: hidden; }
.sa-code-h { display: flex; align-items: center; justify-content: space-between; gap: 12px; height: 34px; padding: 0 6px 0 12px; border-bottom: 1px solid var(--sa-line); background: var(--sa-bg-2); }
.sa-code-h span { font: 400 10.5px/1 var(--sa-mono); letter-spacing: 0.1em; text-transform: uppercase; color: var(--sa-mute); }
.sa-code pre { margin: 0; padding: 14px 16px; overflow: auto; font: 400 12.5px/1.7 var(--sa-mono); color: var(--sa-text-2); tab-size: 2; }
.sa-code pre.wrap { white-space: pre-wrap; word-break: break-word; }
.sa-code.inline { display: inline-flex; align-items: center; gap: 4px; padding: 0 4px 0 10px; height: 30px; }
.sa-code.inline code { font: 400 12.5px/1 var(--sa-mono); color: var(--sa-text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Tables */
.sa-tablewrap { overflow-x: auto; }
.sa-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.sa-table th { padding: 10px 16px; text-align: left; font: 400 10.5px/1 var(--sa-mono); letter-spacing: 0.12em; text-transform: uppercase; color: var(--sa-mute); border-bottom: 1px solid var(--sa-line); white-space: nowrap; }
.sa-table td { padding: 11px 16px; border-bottom: 1px solid var(--sa-line); color: var(--sa-text-2); vertical-align: middle; }
.sa-table tbody tr { transition: background 0.12s; }
.sa-table tbody tr:hover { background: var(--sa-bg-3); }
.sa-table tbody tr:last-child td { border-bottom: 0; }
.sa-table td.k { color: var(--sa-text); }

/* Empty, skeleton, spinner */
.sa-empty { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 56px 24px; }
.sa-empty-i { display: grid; place-items: center; width: 38px; height: 38px; margin-bottom: 16px; border: 1px solid var(--sa-line-2); border-radius: 5px; color: var(--sa-mute); }
.sa-empty h3 { margin: 0; font: 500 14px/1.3 var(--sa-f); color: var(--sa-text); }
.sa-empty p { margin: 6px 0 0; max-width: 42ch; font-size: 13px; line-height: 1.55; color: var(--sa-mute); }
.sa-empty .act { margin-top: 18px; display: flex; gap: 8px; }
.sa-skel { display: block; border-radius: 3px; background: linear-gradient(90deg, var(--sa-bg-3) 0%, var(--sa-bg-4) 50%, var(--sa-bg-3) 100%); background-size: 200% 100%; animation: sa-shimmer 1.6s linear infinite; }
@keyframes sa-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
.sa-spin { display: inline-block; width: 14px; height: 14px; border: 1.5px solid currentColor; border-top-color: transparent; border-radius: 50%; animation: sa-rot 0.7s linear infinite; flex: none; }
@keyframes sa-rot { to { transform: rotate(360deg); } }
.sa-in { animation: sa-in 0.18s var(--sa-ease) both; }

@media (prefers-reduced-motion: reduce) {
  .sa *:not(.sa-spin), .sa *:not(.sa-spin)::before, .sa *:not(.sa-spin)::after,
  html.sq-app-root .sq-tab-enter { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
}
@media print { .sa-top, .sa-grain { display: none !important; } }
`;
}

/* ── Fonts + theme ──────────────────────────────────────────── */

const APP_FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@300;400;500&family=Geist+Mono:wght@400;500&display=swap';

export function useAppFonts() {
  useEffect(() => {
    if (document.querySelector('link[data-sq-app-fonts]')) return;
    const pre1 = document.createElement('link');
    pre1.rel = 'preconnect';
    pre1.href = 'https://fonts.googleapis.com';
    const pre2 = document.createElement('link');
    pre2.rel = 'preconnect';
    pre2.href = 'https://fonts.gstatic.com';
    pre2.crossOrigin = 'anonymous';
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = APP_FONT_HREF;
    link.setAttribute('data-sq-app-fonts', 'true');
    document.head.append(pre1, pre2, link);
    // Deliberately not removed on unmount: moving between app pages
    // should never flash the fallback font.
  }, []);
}

let themeUsers = 0;

/** Mount once per page. Applies the workbench theme to <html> while mounted. */
export function AppTheme() {
  useAppFonts();
  const css = useMemo(() => buildCss(detectFormat()), []);
  useLayoutEffect(() => {
    const root = document.documentElement;
    themeUsers += 1;
    root.classList.add('sq-app-root');
    // The app may scale the whole page with `html { zoom }`; viewport units do not
    // follow it, so publish the factor and let the CSS divide it back out.
    const syncZoom = () => {
      let z = 1;
      try {
        z = parseFloat((getComputedStyle(root) as CSSStyleDeclaration & { zoom?: string }).zoom || '1');
      } catch { /* ignore */ }
      root.style.setProperty('--sa-zoom', String(Number.isFinite(z) && z > 0 ? z : 1));
    };
    syncZoom();
    window.addEventListener('resize', syncZoom);
    return () => {
      window.removeEventListener('resize', syncZoom);
      themeUsers -= 1;
      if (themeUsers <= 0) {
        themeUsers = 0;
        root.classList.remove('sq-app-root');
        root.style.removeProperty('--sa-zoom');
      }
    };
  }, []);
  return <style data-sq-app-theme="">{css}</style>;
}

/* ── Hooks ──────────────────────────────────────────────────── */

/** Section / tab state that survives refresh and can be linked to:  #tab=keys&x=1 */
export function useHashState<T extends string>(
  key: string,
  initial: T,
  valid?: readonly T[],
): [T, (v: T) => void] {
  const read = useCallback((): T => {
    if (typeof window === 'undefined') return initial;
    const p = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const v = p.get(key) as T | null;
    if (v && (!valid || valid.includes(v))) return v;
    return initial;
  }, [key, initial, valid]);

  const [value, setValue] = useState<T>(read);

  useEffect(() => {
    const onHash = () => setValue(read());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [read]);

  const set = useCallback(
    (next: T) => {
      setValue(next);
      try {
        const p = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        if (next === initial) p.delete(key);
        else p.set(key, next);
        const h = p.toString();
        const url = window.location.pathname + window.location.search + (h ? `#${h}` : '');
        // keep history.state: react-router stores its index there
        window.history.replaceState(window.history.state, '', url);
      } catch {
        /* non-critical */
      }
    },
    [key, initial],
  );

  return [value, set];
}

export function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

/** `/` (or ⌘K / Ctrl+K) focuses the given field, unless you are already typing. */
export function useSearchShortcut(ref: React.RefObject<HTMLElement>, opts?: { slash?: boolean }) {
  useEffect(() => {
    const slash = opts?.slash !== false;
    const onKey = (e: KeyboardEvent) => {
      const mod = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
      if (!ref.current) return; // field not on screen (other tab / hidden): leave the key alone
      if (mod || (slash && e.key === '/' && !isTypingTarget(e.target) && !e.metaKey && !e.ctrlKey && !e.altKey)) {
        e.preventDefault();
        ref.current?.focus();
        if (ref.current instanceof HTMLInputElement) ref.current.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ref, opts?.slash]);
}

export function useDocTitle(title: string) {
  useEffect(() => {
    const prev = document.title;
    document.title = `${title} · SquidCloud`;
    return () => {
      document.title = prev;
    };
  }, [title]);
}

export function useCopy(timeout = 1600) {
  const [copied, setCopied] = useState(false);
  const t = useRef<number | undefined>();
  useEffect(() => () => window.clearTimeout(t.current), []);
  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand('copy');
        } catch {
          /* ignore */
        }
        ta.remove();
      }
      setCopied(true);
      window.clearTimeout(t.current);
      t.current = window.setTimeout(() => setCopied(false), timeout);
    },
    [timeout],
  );
  return { copied, copy };
}

/* ── Icons (inline so this file has no icon-map dependency) ──── */

type IcoProps = { size?: number; className?: string; style?: CSSProperties };
const svgBase = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
});

export const Ico = {
  Copy: ({ size = 14, ...p }: IcoProps) => (
    <svg {...svgBase(size)} {...p}><rect x="5.2" y="5.2" width="8" height="8" rx="1.4" /><path d="M10.8 5.2V3.6a1.4 1.4 0 0 0-1.4-1.4H3.6a1.4 1.4 0 0 0-1.4 1.4v5.8a1.4 1.4 0 0 0 1.4 1.4h1.6" /></svg>
  ),
  Check: ({ size = 14, ...p }: IcoProps) => (
    <svg {...svgBase(size)} {...p}><path d="m3 8.4 3.2 3.1L13 4.6" /></svg>
  ),
  Search: ({ size = 14, ...p }: IcoProps) => (
    <svg {...svgBase(size)} {...p}><circle cx="7" cy="7" r="4.6" /><path d="m10.4 10.4 3.2 3.2" /></svg>
  ),
  Arrow: ({ size = 14, ...p }: IcoProps) => (
    <svg {...svgBase(size)} {...p}><path d="M3 8h10M8.6 3.6 13 8l-4.4 4.4" /></svg>
  ),
  ArrowLeft: ({ size = 14, ...p }: IcoProps) => (
    <svg {...svgBase(size)} {...p}><path d="M13 8H3M7.4 3.6 3 8l4.4 4.4" /></svg>
  ),
  ArrowUpRight: ({ size = 14, ...p }: IcoProps) => (
    <svg {...svgBase(size)} {...p}><path d="M4.5 11.5 11.5 4.5M5.5 4.5h6v6" /></svg>
  ),
  Chevron: ({ size = 14, ...p }: IcoProps) => (
    <svg {...svgBase(size)} {...p}><path d="m5.5 3.5 4.5 4.5-4.5 4.5" /></svg>
  ),
  Info: ({ size = 14, ...p }: IcoProps) => (
    <svg {...svgBase(size)} {...p}><circle cx="8" cy="8" r="6" /><path d="M8 7.2v3.6M8 5.2v.1" /></svg>
  ),
  Alert: ({ size = 14, ...p }: IcoProps) => (
    <svg {...svgBase(size)} {...p}><path d="M8 2.4 14 13H2L8 2.4Z" /><path d="M8 6.6v3M8 11.4v.1" /></svg>
  ),
  Eye: ({ size = 14, ...p }: IcoProps) => (
    <svg {...svgBase(size)} {...p}><path d="M1.6 8S4 3.6 8 3.6 14.4 8 14.4 8 12 12.4 8 12.4 1.6 8 1.6 8Z" /><circle cx="8" cy="8" r="1.8" /></svg>
  ),
  EyeOff: ({ size = 14, ...p }: IcoProps) => (
    <svg {...svgBase(size)} {...p}><path d="M2 2l12 12M6.6 3.8A6 6 0 0 1 8 3.6c4 0 6.4 4.4 6.4 4.4a10 10 0 0 1-2 2.5M4.1 5.5A10 10 0 0 0 1.6 8S4 12.4 8 12.4c1 0 1.9-.3 2.7-.7" /></svg>
  ),
  Menu: ({ size = 14, ...p }: IcoProps) => (
    <svg {...svgBase(size)} {...p}><path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" /></svg>
  ),
  Close: ({ size = 14, ...p }: IcoProps) => (
    <svg {...svgBase(size)} {...p}><path d="m3.5 3.5 9 9M12.5 3.5l-9 9" /></svg>
  ),
  Lock: ({ size = 14, ...p }: IcoProps) => (
    <svg {...svgBase(size)} {...p}><rect x="3" y="7" width="10" height="6.6" rx="1.4" /><path d="M5.2 7V5.2a2.8 2.8 0 0 1 5.6 0V7" /></svg>
  ),
};

export function Spinner({ size = 14 }: { size?: number }) {
  return <span className="sa-spin" style={{ width: size, height: size }} role="status" aria-label="Loading" />;
}

/* ── Layout ─────────────────────────────────────────────────── */

export function AppShell({ children, grain }: { children: ReactNode; grain?: boolean }) {
  return (
    <div className="sa">
      <AppTheme />
      {grain && <div className="sa-grain" aria-hidden="true" />}
      {children}
    </div>
  );
}

export type Crumb = { label: string; to?: string };

export function TopBar({
  crumbs,
  children,
  home = '/dashboard',
  below,
}: {
  crumbs?: Crumb[];
  children?: ReactNode;
  home?: string;
  below?: ReactNode;
}) {
  return (
    <>
      <header className="sa-top">
        <Link to={home} className="sa-brand" aria-label="SquidCloud home">
          <SquidLogo size={18} mono />
          <span className="hide-sm">SquidCloud</span>
        </Link>
        {crumbs && crumbs.length > 0 && (
          <nav className="sa-crumbs" aria-label="Breadcrumb">
            {crumbs.map((c, i) => {
              const last = i === crumbs.length - 1;
              return (
                <React.Fragment key={`${c.label}-${i}`}>
                  <span className={`sa-sep${last ? '' : ' hide-sm'}`} aria-hidden="true">/</span>
                  {c.to && !last ? (
                    <Link to={c.to} className="hide-sm">{c.label}</Link>
                  ) : (
                    <span className="cur" aria-current={last ? 'page' : undefined}>{c.label}</span>
                  )}
                </React.Fragment>
              );
            })}
          </nav>
        )}
        <div className="sa-top-r">{children}</div>
      </header>
      {below}
    </>
  );
}

export function Wrap({
  width = 'default',
  children,
  className = '',
  style,
}: {
  width?: 'narrow' | 'default' | 'wide';
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <main className={`sa-wrap ${width === 'default' ? '' : width} ${className}`.trim()} style={style}>
      {children}
    </main>
  );
}

export function PageHead({
  eyebrow,
  title,
  desc,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  desc?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="sa-head">
      <div style={{ minWidth: 0 }}>
        {eyebrow && <div className="sa-eyebrow">{eyebrow}</div>}
        <h1 className="sa-title">{title}</h1>
        {desc && <p className="sa-desc">{desc}</p>}
      </div>
      {actions && <div className="sa-head-r">{actions}</div>}
    </div>
  );
}

export function SecHead({ title, desc, actions }: { title: ReactNode; desc?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="sa-sh">
      <div>
        <h2>{title}</h2>
        {desc && <p>{desc}</p>}
      </div>
      {actions && <div className="sa-head-r">{actions}</div>}
    </div>
  );
}

export function Panel({
  title,
  desc,
  actions,
  children,
  flush,
  danger,
  id,
  className = '',
}: {
  title?: ReactNode;
  desc?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  flush?: boolean;
  danger?: boolean;
  id?: string;
  className?: string;
}) {
  return (
    <section id={id} className={`sa-panel${danger ? ' danger' : ''} ${className}`.trim()}>
      {(title || actions) && (
        <div className="sa-panel-h">
          <div style={{ minWidth: 0 }}>
            {title && <h3 className="sa-panel-t">{title}</h3>}
            {desc && <p className="sa-panel-d">{desc}</p>}
          </div>
          {actions && <div className="sa-head-r">{actions}</div>}
        </div>
      )}
      {children !== undefined && <div className={`sa-panel-b${flush ? ' flush' : ''}`}>{children}</div>}
    </section>
  );
}

export function Row({
  label,
  desc,
  children,
  top,
}: {
  label: ReactNode;
  desc?: ReactNode;
  children?: ReactNode;
  top?: boolean;
}) {
  return (
    <div className={`sa-row${top ? ' top' : ''}`}>
      <div className="sa-row-l">
        <div className="sa-row-t">{label}</div>
        {desc && <div className="sa-row-d">{desc}</div>}
      </div>
      {children && <div className="sa-row-r">{children}</div>}
    </div>
  );
}

/* ── Atoms ──────────────────────────────────────────────────── */

export type Tone = 'neutral' | 'ok' | 'warn' | 'err' | 'info' | 'solid';

export function Pill({ tone = 'neutral', children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return (
    <span className={`sa-pill${tone === 'neutral' ? '' : ` ${tone}`}`} title={title}>
      {children}
    </span>
  );
}

export function Dot({ tone = 'neutral', pulse }: { tone?: Exclude<Tone, 'solid'>; pulse?: boolean }) {
  return <span className={`sa-dot${tone === 'neutral' ? '' : ` ${tone}`}${pulse ? ' pulse' : ''}`} aria-hidden="true" />;
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="sa-kbd">{children}</kbd>;
}

/** `plain` keeps the bar neutral (progress). Without it the bar warns near the
 *  limit, which is what you want for quotas and credits. */
export function Meter({ value, max = 100, label, plain }: { value: number; max?: number; label?: string; plain?: boolean }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const tone = plain ? '' : pct >= 95 ? 'err' : pct >= 80 ? 'warn' : '';
  return (
    <div
      className={`sa-meter ${tone}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-label={label}
    >
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Stat({ label, value, sub }: { label: ReactNode; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="sa-stat">
      <div className="sa-stat-k">{label}</div>
      <div className="sa-stat-v">{value}</div>
      {sub && <div className="sa-stat-s">{sub}</div>}
    </div>
  );
}

export function Stats({ children }: { children: ReactNode }) {
  return <div className="sa-stats">{children}</div>;
}

export function KV({ items }: { items: Array<[ReactNode, ReactNode]> }) {
  return (
    <dl className="sa-kv">
      {items.map(([k, v], i) => (
        <React.Fragment key={i}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

export function Note({
  tone = 'neutral',
  title,
  children,
  icon = true,
}: {
  tone?: Exclude<Tone, 'solid'>;
  title?: ReactNode;
  children?: ReactNode;
  icon?: boolean;
}) {
  const I = tone === 'warn' || tone === 'err' ? Ico.Alert : Ico.Info;
  return (
    <div className={`sa-note${tone === 'neutral' ? '' : ` ${tone}`}`} role={tone === 'err' ? 'alert' : undefined}>
      {icon && <I size={15} />}
      <div style={{ minWidth: 0 }}>
        {title && <b>{title}</b>}
        {title && children ? ' ' : null}
        {children}
      </div>
    </div>
  );
}

export function Empty({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="sa-empty">
      <div className="sa-empty-i">{icon ?? <Ico.Search size={16} />}</div>
      <h3>{title}</h3>
      {body && <p>{body}</p>}
      {action && <div className="act">{action}</div>}
    </div>
  );
}

export function Skel({ w = '100%', h = 12, style }: { w?: number | string; h?: number | string; style?: CSSProperties }) {
  return <span className="sa-skel" style={{ width: w, height: h, ...style }} aria-hidden="true" />;
}

export function SkelRows({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="sa-row" style={{ gridTemplateColumns: '1fr auto' }}>
          <div>
            <Skel w={`${40 + ((i * 17) % 30)}%`} h={11} />
            <Skel w={`${55 + ((i * 11) % 25)}%`} h={9} style={{ marginTop: 9 }} />
          </div>
          <Skel w={64} h={24} />
        </div>
      ))}
    </div>
  );
}

/* ── Controls ───────────────────────────────────────────────── */

export function btn(kind: 'default' | 'primary' | 'ghost' | 'danger' = 'default', size: 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm' = 'md') {
  const k = kind === 'default' ? '' : ` ${kind}`;
  const s = size === 'md' ? '' : size === 'icon-sm' ? ' icon sm' : ` ${size}`;
  return `sa-btn${k}${s}`;
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  right,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div>
      {(label || right) && (
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
          {label && (
            <label className="sa-label" htmlFor={htmlFor}>
              {label}
            </label>
          )}
          {right}
        </div>
      )}
      {children}
      {error ? <div className="sa-err" role="alert">{error}</div> : hint ? <div className="sa-hint">{hint}</div> : null}
    </div>
  );
}

export function Seg<T extends string>({
  value,
  options,
  onChange,
  size,
  block,
  label,
}: {
  value: T;
  options: ReadonlyArray<{ value: T; label: ReactNode }>;
  onChange: (v: T) => void;
  size?: 'lg';
  block?: boolean;
  label?: string;
}) {
  return (
    <div className={`sa-seg${size ? ` ${size}` : ''}${block ? ' block' : ''}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function UnderlineTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  idPrefix = 'tab',
}: {
  tabs: ReadonlyArray<{ id: T; label: ReactNode; count?: number | string }>;
  value: T;
  onChange: (v: T) => void;
  label?: string;
  idPrefix?: string;
}) {
  const onKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const i = tabs.findIndex((t) => t.id === value);
    let n = i;
    if (e.key === 'ArrowRight') n = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = tabs.length - 1;
    else return;
    e.preventDefault();
    onChange(tabs[n].id);
    requestAnimationFrame(() => document.getElementById(`${idPrefix}-${tabs[n].id}`)?.focus());
  };
  return (
    <div className="sa-tabs" role="tablist" aria-label={label} onKeyDown={onKey}>
      {tabs.map((t) => (
        <button
          key={t.id}
          id={`${idPrefix}-${t.id}`}
          role="tab"
          type="button"
          className="sa-tab"
          aria-selected={value === t.id}
          tabIndex={value === t.id ? 0 : -1}
          onClick={() => onChange(t.id)}
        >
          {t.label}
          {t.count !== undefined && <span className="n">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function CodeBlock({
  code,
  lang,
  wrap,
  maxHeight,
  copyText,
}: {
  code: string;
  lang?: string;
  wrap?: boolean;
  maxHeight?: number;
  /** what lands on the clipboard if it should differ from what is shown */
  copyText?: string;
}) {
  const { copied, copy } = useCopy();
  return (
    <div className="sa-code">
      <div className="sa-code-h">
        <span>{lang ?? 'text'}</span>
        <button type="button" className={btn('ghost', 'sm')} onClick={() => copy(copyText ?? code)} aria-label="Copy code">
          {copied ? <Ico.Check size={13} /> : <Ico.Copy size={13} />}
          <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className={wrap ? 'wrap' : ''} style={maxHeight ? { maxHeight } : undefined} tabIndex={0}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

/** One-line copyable value (URLs, keys, ids). */
export function CopyLine({ value, display }: { value: string; display?: string }) {
  const { copied, copy } = useCopy();
  return (
    <div className="sa-code inline" style={{ maxWidth: '100%' }}>
      <code title={value}>{display ?? value}</code>
      <button type="button" className={btn('ghost', 'icon-sm')} onClick={() => copy(value)} aria-label="Copy">
        {copied ? <Ico.Check size={13} /> : <Ico.Copy size={13} />}
      </button>
    </div>
  );
}
