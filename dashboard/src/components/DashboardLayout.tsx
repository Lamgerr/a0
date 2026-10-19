import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AppShell, TopBar, Ico, btn } from "@/components/custom/squid-app";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NAV = [
  { to: "/dashboard", label: "Overview", end: true },
  { to: "/dashboard/usage", label: "Usage" },
  { to: "/dashboard/keys", label: "API Keys" },
  { to: "/dashboard/models", label: "Models" },
  { to: "/dashboard/nodes", label: "Nodes" },
  { to: "/dashboard/guide", label: "Guide" },
];

/* One underline-nav row under the top bar; overrides keep sa-tab visuals
   for router Links. Active state is stamped on via !important so nothing
   later in the cascade (assembly CSS, shell resets) can mute it. */
const SHELL_CSS = `
 .sa-tabs-wrap { max-width: 1120px; margin: 0 auto; padding: 0 var(--sa-gut); }
 a.sa-tab { -webkit-tap-highlight-color: transparent; }
 a.sa-tab.is-active { color: var(--sa-text) !important; border-bottom-color: var(--sa-text) !important; }
 .sa-tabs::-webkit-scrollbar { display: none; }
 .sa-tabs { scrollbar-width: none; }
.sa-avatar { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 4px; background: var(--sa-bg-4); color: var(--sa-text); font: 500 10px/1 var(--sa-mono); }
.sa-demo-note { display: flex; align-items: center; gap: 8px; padding: 8px var(--sa-gut); color: var(--sa-warn); font-size: 12px; background: color-mix(in srgb, var(--sa-warn) 7%, transparent); border-bottom: 1px solid color-mix(in srgb, var(--sa-warn) 25%, var(--sa-line)); }
`;

/* Deterministic active-tab match: exact hit for `end` entries, prefix hit
   elsewhere. Never relies on runtime router internals. */
function tabActive(pathname: string, to: string, end?: boolean): boolean {
  if (pathname === to) return true;
  return !end && pathname.startsWith(to + "/");
}

export default function DashboardLayout() {
  const { user, signOut, controlPlaneConfigured } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const initial = (user?.email?.[0] ?? "d").toUpperCase();

  return (
    <AppShell>
      <style>{SHELL_CSS}</style>
      <TopBar
        home="/"
        crumbs={[{ label: "a0", to: "/dashboard" }, { label: "Console" }]}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={`${btn("ghost", "sm")} gap-2`}>
              <span className="sa-avatar" aria-hidden="true">{initial}</span>
              <span className="hide-sm">{user?.email ?? "demo@a0.local"}</span>
              <Ico.Chevron size={12} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-mono text-xs">
              {user?.email ?? "demo@a0.local"}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut().then(() => navigate("/"))}
              className="gap-2"
            >
              <Ico.ArrowLeft size={13} />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TopBar>
      {controlPlaneConfigured ? null : (
        <div className="sa-demo-note" role="status">
          <Ico.Info size={13} />
          Control plane offline — browsing with a demo identity.
        </div>
      )}
      <nav className="sa-tabs-wrap">
        <div className="sa-tabs" aria-label="Console sections">
          {NAV.map(({ to, label, end }) => (
            <Link
              key={to}
              to={to}
              aria-current={tabActive(pathname, to, end) ? "page" : undefined}
              className={`sa-tab${tabActive(pathname, to, end) ? " is-active" : ""}`}
            >
              {label}
            </Link>
          ))}
        </div>
      </nav>
      <main className="sa-wrap">
        <Outlet />
      </main>
      <footer
        style={{
          padding: "0 var(--sa-gut) 40px",
          textAlign: "center",
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--sa-dim)",
          fontFamily: "var(--sa-mono)",
        }}
      >
        a0 — a squidcloud product
      </footer>
    </AppShell>
  );
}
