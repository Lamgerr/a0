import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Github, Twitter } from 'lucide-react';
import SquidLogo from '@/components/ui/SquidLogo';

/* ════════════════════════════════════════════════════════════════
   SHARED FOOTER — same system as landing + pricing. Structure,
   routes and labels preserved exactly; only presentation changed.
   ════════════════════════════════════════════════════════════════ */

const C = {
  canvas: '#060607',
  hair: 'rgba(255,255,255,0.08)',
  paper: '#f2f2ed',
  dim: '#a3a39a',
  faint: '#63635c',
  accent: '#c8f04b',
};

const DISPLAY = { fontFamily: "'Space Grotesk', system-ui, sans-serif" };
const MONO = { fontFamily: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace" };

const footerLinks: { title: string; items: { label: string; href: string }[] }[] = [
  {
    title: 'Product',
    items: [
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Storage', href: '/storage' },
      { label: 'Extensions', href: '/extensions' },
      { label: 'Pricing', href: '/pricing' },
    ],
  },
  {
    title: 'Developers',
    items: [
      { label: 'Documentation', href: '/help/docs' },
      { label: 'Developer API', href: '/developer-api' },
      { label: 'CLI (squidcloudctl)', href: '/cli' },
      { label: 'Webhooks', href: '/webhooks' },
    ],
  },
  {
    title: 'Company',
    items: [
      { label: 'Support', href: '/support' },
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'API Status', href: '/cc/api/status' },
    ],
  },
];

export default function Footer() {
  useEffect(() => {
    const ID = 'sq-landing-fonts';
    if (document.getElementById(ID)) return;
    const l = document.createElement('link');
    l.id = ID;
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap';
    document.head.appendChild(l);
  }, []);

  return (
    <footer className="border-t" style={{ borderColor: C.hair, background: C.canvas }}>
      <style>{`
        .sq-pulse { animation: sq-pulse 2.2s ease-in-out infinite; }
        @keyframes sq-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
      `}</style>
      <div className="mx-auto max-w-[1440px] px-5 py-14">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-5">
          <div className="col-span-2 flex flex-col gap-4">
            <Link to="/" className="flex items-center gap-2.5">
              <SquidLogo size={22} mono />
              <span className="text-[12px] font-semibold uppercase tracking-[0.28em]" style={{ ...DISPLAY, color: C.paper }}>SquidCloud</span>
            </Link>
            <p className="max-w-xs text-[13.5px] leading-relaxed" style={{ color: C.dim }}>
              Cloud storage that can't read your files. Encrypted on your device, before anything uploads.
            </p>
            <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em]" style={{ ...MONO, color: C.faint }}>
              <span className="sq-pulse inline-block h-1.5 w-1.5 rounded-full" style={{ background: C.accent }} />
              Zero-knowledge · server keys: none
            </p>
            <div className="mt-1 flex items-center gap-2">
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer noopener"
                aria-label="GitHub"
                className="flex h-9 w-9 items-center justify-center rounded-full border transition-colors hover:border-white/30"
                style={{ borderColor: C.hair, color: C.dim }}
              >
                <Github size={16} />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noreferrer noopener"
                aria-label="Twitter"
                className="flex h-9 w-9 items-center justify-center rounded-full border transition-colors hover:border-white/30"
                style={{ borderColor: C.hair, color: C.dim }}
              >
                <Twitter size={16} />
              </a>
            </div>
          </div>

          {footerLinks.map((group) => (
            <div key={group.title} className="flex flex-col gap-4">
              <h4 className="font-mono text-[10px] uppercase tracking-[0.24em]" style={{ ...MONO, color: C.faint }}>
                {group.title}
              </h4>
              <ul className="flex flex-col gap-2.5">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      to={item.href}
                      className="text-[13.5px] transition-colors hover:text-white"
                      style={{ color: C.dim }}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t pt-6 md:flex-row md:items-center" style={{ borderColor: C.hair }}>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em]" style={{ ...MONO, color: C.faint }}>
            © {new Date().getFullYear()} SquidCloud · secure · unlimited · yours
          </p>
          <div className="flex items-center gap-6 text-[13px]">
            <Link to="/terms" className="transition-colors hover:text-white" style={{ color: C.dim }}>Terms</Link>
            <Link to="/privacy" className="transition-colors hover:text-white" style={{ color: C.dim }}>Privacy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
