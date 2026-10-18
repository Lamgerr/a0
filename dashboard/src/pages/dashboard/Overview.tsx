import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, Activity, KeyRound, Server, Zap } from "lucide-react";
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
import { listVirtualKeys } from "@/hooks/use-api-keys";
import { useAuth } from "@/contexts/AuthContext";

export default function Overview() {
  const { controlPlaneConfigured } = useAuth();
  const keys = useQuery({ queryKey: ["virtual_keys"], queryFn: listVirtualKeys });

  const stats = [
    {
      icon: KeyRound,
      label: "Active keys",
      value: (keys.data?.length ?? 0).toString(),
      hint: controlPlaneConfigured ? "virtual keys on the fly" : "demo store",
    },
    {
      icon: Server,
      label: "Wings",
      value: "local only",
      hint: "M4 attaches more via node flow",
    },
    {
      icon: Zap,
      label: "Free pool",
      value: "xkiro · llm7 · openrouter",
      hint: "builtin chain, probed hourly",
    },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Overview</h1>
        <p className="text-sm text-muted-foreground">
          Gateway posture at a glance.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map(({ icon: Icon, label, value, hint }) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary" /> {label}
              </CardDescription>
              <CardTitle className="truncate text-base">{value}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground/70">
              {hint}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick start</CardTitle>
          <CardDescription>
            The wing serves <code className="text-primary">{A0_BASE_URL}</code> in dev.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <pre className="overflow-x-auto rounded-lg border bg-background p-4 text-xs leading-relaxed">
            <code>{`base_url = "${A0_BASE_URL}"
api_key  = "<your virtual key>"
model    = "a0/coder"   # categories, never raw models`}</code>
          </pre>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <Badge key={c.id} variant="secondary" className="font-mono text-[11px]">
                {c.id}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button asChild variant="secondary" className="gap-2">
          <Link to="/dashboard/keys">
            Make a key <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="outline" className="gap-2">
          <Link to="/dashboard/nodes">
            <Activity className="h-4 w-4" /> Attach a wing
          </Link>
        </Button>
      </div>
    </div>
  );
}
