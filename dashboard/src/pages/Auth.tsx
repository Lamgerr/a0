import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Fingerprint } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppShell, TopBar, Spinner, Ico, btn } from '@/components/custom/squid-app';

/* ═══════════════════════════════════════════════════════════════
   AUTH — SquidCloud single sign-on only.
   a0 is a SquidCloud product: no local sign-up, no local sign-in,
   no password recovery. One door: your SquidCloud identity.
   Provider `custom:squidcloud` (a00 Auth providers panel).
   ═══════════════════════════════════════════════════════════════ */

const AUTH_CSS = `
.au { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); min-height: calc(100vh / var(--sa-zoom, 1) - 48px); }
.au-side { position: relative; display: flex; flex-direction: column; justify-content: space-between; gap: 48px; padding: 64px var(--sa-gut) 40px; border-right: 1px solid var(--sa-line); background: var(--sa-bg-2); overflow: hidden; }
.au-side > * { position: relative; }
.au-rings { position: absolute !important; right: -140px; bottom: -140px; width: 560px; height: 560px; color: var(--sa-text); opacity: 0.07; pointer-events: none; }
.au-eyebrow { font: 400 11px/1 var(--sa-mono); letter-spacing: 0.14em; text-transform: uppercase; color: var(--sa-mute); }
.au-h { margin: 18px 0 0; max-width: 14ch; font: 300 56px/1.04 var(--sa-f); letter-spacing: -0.035em; color: var(--sa-text); }
@media (max-width: 720px) { .au-h { font-size: 36px; } }
.au-p { margin: 18px 0 0; max-width: 40ch; font-size: 15px; line-height: 1.6; color: var(--sa-text-2); }
.au-meta { display: flex; flex-wrap: wrap; gap: 8px 20px; font: 400 11px/1 var(--sa-mono); letter-spacing: 0.1em; text-transform: uppercase; color: var(--sa-mute); }
.au-meta span { display: inline-flex; align-items: center; gap: 8px; }
.au-main { display: flex; align-items: center; justify-content: center; padding: 40px var(--sa-gut) 64px; }
.au-card { width: 100%; max-width: 372px; }
.au-card h1 { margin: 0; font: 400 26px/1.15 var(--sa-f); letter-spacing: -0.025em; }
.au-card .sub { margin: 8px 0 0; font-size: 14px; line-height: 1.55; color: var(--sa-text-2); }
.au-form { display: grid; gap: 16px; margin-top: 24px; }
.au-legal { margin-top: 28px; font-size: 12px; line-height: 1.6; color: var(--sa-mute); }
@media (max-width: 900px) { .au { grid-template-columns: 1fr; } .au-side { display: none; } .au-main { align-items: flex-start; padding-top: 40px; } }
`;

const COPY = {
  eyebrow: 'SquidCloud SSO',
  h: 'One identity for every Squid product.',
  p: 'a0 gates its panel behind your SquidCloud account. No new passwords here — your keys and quota all attach to the same identity.',
};

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const getRedirectTarget = useCallback(() => {
    const nextParam = searchParams.get('next') || localStorage.getItem('a0_auth_next');
    if (nextParam && nextParam.startsWith('/')) return nextParam;
    return '/dashboard';
  }, [searchParams]);

  useEffect(() => {
    const nextParam = searchParams.get('next');
    if (nextParam) localStorage.setItem('a0_auth_next', nextParam);
  }, [searchParams]);

  useEffect(() => {
    if (user) {
      const target = getRedirectTarget();
      localStorage.removeItem('a0_auth_next');
      navigate(target);
    }
  }, [getRedirectTarget, navigate, user]);

  const authenticate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const redirectTo = `${window.location.origin}/auth`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'custom:squidcloud',
        options: { redirectTo },
      });
      if (error) throw error;
    } catch (err: any) {
      setIsLoading(false);
      const raw = String(err?.message || err || '');
      setError(
        raw.includes('unsupported_provider') || raw.includes('not configured')
          ? 'SquidCloud SSO is not wired on this deployment yet — add custom provider custom:squidcloud in project a00 → Auth → Providers.'
          : raw,
      );
    }
  };

  return (
    <AppShell>
      <style>{AUTH_CSS}</style>
      <TopBar home="/" crumbs={[{ label: 'Authenticate' }]} />

      <div className="au">
        <aside className="au-side">
          <svg className="au-rings" viewBox="0 0 560 560" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true">
            <circle cx="280" cy="280" r="270" />
            <circle cx="280" cy="280" r="205" />
            <circle cx="280" cy="280" r="140" />
            <circle cx="280" cy="280" r="76" />
            <circle cx="280" cy="280" r="26" fill="currentColor" />
          </svg>
          <div>
            <div className="au-eyebrow">{COPY.eyebrow}</div>
            <h2 className="au-h">{COPY.h}</h2>
            <p className="au-p">{COPY.p}</p>
          </div>
          <div className="au-meta" aria-hidden="true">
            <span>SquidCloud SSO</span>
            <span>Categories · keys · quota</span>
            <span>squidcloud</span>
          </div>
        </aside>

        <main className="au-main">
          <div className="au-card sa-in">
            <h1>Authenticate through SquidCloud</h1>
            <p className="sub">
              You will be sent to SquidCloud, confirm once, and land back here.
            </p>
            <div className="au-form">
              <button
                type="button"
                onClick={authenticate}
                disabled={isLoading}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold tracking-wide text-primary-foreground shadow-sm transition-all duration-150 hover:bg-primary/90 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none"
              >
                {isLoading ? <Spinner /> : <Fingerprint className="h-4 w-4" />}
                Continue with SquidCloud
              </button>
              {error && (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs leading-relaxed text-destructive-foreground">
                  {error}
                </p>
              )}
            </div>
            <p className="au-legal">

              a0 keys and quotas attach to your SquidCloud identity — one account, revocable anywhere.
            </p>
          </div>
        </main>
      </div>
    </AppShell>
  );
}
