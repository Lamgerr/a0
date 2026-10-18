import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, KeyRound, ShieldCheck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CATEGORIES, A0_BASE_URL } from "@/lib/a0";
import { useAuth } from "@/contexts/AuthContext";

const curl = `curl ${/* forwarded */ A0_BASE_URL}/v1/chat/completions \\
  -H "Authorization: Bearer $A0_KEY" \\
  -d '{
    "model": "a0/coder",
    "stream": true,
    "messages": [{"role": "user", "content": "hi"}]
  }'`;

export default function Index() {
  const { user, controlPlaneConfigured } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-mono text-lg font-bold text-primary-foreground">
            a0
          </span>
          <span className="font-semibold">a0</span>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate(user ? "/dashboard" : "/auth")}
        >
          {user ? "Dashboard" : "Sign in"}
        </Button>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        <section className="flex flex-col items-center py-24 text-center">
          <Badge variant="secondary" className="mb-6 gap-2 font-mono">
            <Zap className="h-3 w-3" />
            pooled free inference · squidcloud
          </Badge>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
            One endpoint.{" "}
            <span className="text-primary">Zero model roulette.</span>
          </h1>
          <p className="mt-6 max-w-xl text-muted-foreground">
            a0 pools the usable free lanes of 2026 behind an OpenAI-compatible
            API. You ask for a category — flagships, coders, vision — and the
            wings route, rotate keys and fail over. Never speak to a provider
            again.
          </p>
          <div className="mt-8 flex items-center gap-3">
            <Button size="lg" onClick={() => navigate("/auth")}>
              Get a key <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/dashboard">Open control panel</Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-4 pb-16 md:grid-cols-3">
          {[
            {
              icon: Zap,
              title: "Failover built in",
              body: "429s and dead lanes roll over in-flight — chain order is the SLA.",
            },
            {
              icon: KeyRound,
              title: "Virtual keys",
              body: "Revoke in a second; wings cache for 60s and just reroute.",
            },
            {
              icon: ShieldCheck,
              title: "ToS-clean lanes only",
              body: "Free providers, no reverse-engineered bots, rot on drift.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <Card key={title}>
              <CardHeader>
                <Icon className="mb-2 h-5 w-5 text-primary" />
                <CardTitle className="text-lg">{title}</CardTitle>
                <CardDescription>{body}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </section>

        <section className="pb-16">
          <h2 className="mb-4 font-semibold text-muted-foreground">
            The categories are the product
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {CATEGORIES.map((c) => (
              <div
                key={c.id}
                className="rounded-lg border bg-card/60 p-4 transition-colors hover:border-primary/40"
              >
                <code className="text-sm text-primary">{c.id}</code>
                <p className="mt-1 text-sm text-muted-foreground">{c.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6 pb-24 md:grid-cols-2">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="text-lg">Any OpenAI SDK works</CardTitle>
              <CardDescription>
                Point base_url at a wing —{" "}
                <code className="text-primary">{A0_BASE_URL}</code> in dev
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="overflow-x-auto rounded-lg border bg-background p-4 text-xs leading-relaxed text-foreground/90">
                <code>{curl}</code>
              </pre>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {controlPlaneConfigured
                  ? "Signup is open"
                  : "Control plane offline (local mode)"}
              </CardTitle>
              <CardDescription>
                {controlPlaneConfigured
                  ? "Email magic signup via Supabase auth, free tier ~20 RPM / 2k req/day."
                  : "Build-time env now set → the panel runs and every page stays browsable with demo data."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="secondary" asChild>
                <Link to={controlPlaneConfigured ? "/auth" : "/dashboard"}>
                  {controlPlaneConfigured ? "Create an account" : "Browse panel"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="border-t py-8 text-center text-xs text-muted-foreground/50">
        a0 — a squidcloud product · categories, not model roulette
      </footer>
    </div>
  );
}
