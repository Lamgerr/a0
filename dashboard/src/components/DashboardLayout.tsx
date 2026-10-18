import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Activity,
  BarChart3,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Server,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/dashboard/keys", label: "API Keys", icon: KeyRound },
  { to: "/dashboard/usage", label: "Usage", icon: BarChart3 },
  { to: "/dashboard/models", label: "Models", icon: Activity },
  { to: "/dashboard/nodes", label: "Nodes", icon: Server },
];

export default function DashboardLayout({ children }: { children?: never }) {
  const { user, signOut, controlPlaneConfigured } = useAuth();
  const navigate = useNavigate();
  const initial = (user?.email?.[0] ?? "d").toUpperCase();

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-card/50 p-4 md:flex">
        <div className="mb-8 flex items-center gap-2 px-2 pt-1">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-mono text-lg font-bold text-primary-foreground">
            a0
          </span>
          <div className="leading-tight">
            <div className="font-semibold">a0 control</div>
            <div className="text-[11px] text-muted-foreground">
              {controlPlaneConfigured ? "squidcloud" : "local mode"}
            </div>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                  isActive &&
                    "bg-accent font-medium text-foreground shadow-[inset_2px_0_0_var(--primary)]",
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="text-[11px] text-muted-foreground/60">
          wings: interchangeable · keys: revocable
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-end gap-3 border-b bg-background/80 px-4 backdrop-blur">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="bg-primary/20 text-[11px] text-primary">
                    {initial}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {user?.email ?? "demo@a0.local"}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="font-mono text-xs">
                {user?.email ?? "demo@a0.local"}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => signOut().then(() => navigate("/"))}
                className="gap-2"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex-1 p-4 md:p-8">{<Outlet />}</main>
        <footer className="px-8 py-4 text-center text-[11px] text-muted-foreground/50">
          a0 — a squidcloud product
        </footer>
      </div>
    </div>
  );
}
