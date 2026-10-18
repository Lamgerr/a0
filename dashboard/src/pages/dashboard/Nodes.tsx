import { useState } from "react";
import { toast } from "sonner";
import { Copy, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { hasSupabaseEnv } from "@/integrations/supabase/client";

interface Pair {
  nodeId: string;
  token: string;
}

function mint(): Pair {
  return {
    nodeId: `nd-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`,
    token: `ct-${crypto.randomUUID().replace(/-/g, "")}${crypto.randomUUID().replace(/-/g, "")}`,
  };
}

export default function Nodes() {
  const [name, setName] = useState("");
  const [pair, setPair] = useState<Pair | null>(null);

  const envLine = pair
    ? `A0_NODE_ID=${pair.nodeId}\nA0_CONTROL_TOKEN=${pair.token}\nA0_MODE=public`
    : "";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Nodes</h1>
        <p className="text-sm text-muted-foreground">
          Attach a wing: mint a one-time pair, run the binary anywhere — it
          self-registers and heartbeats every 30s. (M4: registry wiring.)
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Add node</CardTitle>
          <CardDescription>
            {hasSupabaseEnv
              ? "The pair is registered server-side on first boot."
              : "Minting is local-only until the control plane is wired."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex max-w-md flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="node-name">Wing name / region</Label>
            <div className="flex gap-2">
              <Input
                id="node-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="termux-home, fly-iad…"
              />
              <Button
                variant="secondary"
                className="shrink-0"
                onClick={() => {
                  setPair(mint());
                  toast.success("One-time pair minted — env shown below.");
                }}
              >
                <Server className="h-4 w-4" /> Mint
              </Button>
            </div>
          </div>
          {pair && (
            <div className="space-y-2">
              <div className="flex gap-1">
                <Badge className="font-mono text-[10px]">{pair.nodeId}</Badge>
                <Badge variant="secondary" className="font-mono text-[10px]">
                  {pair.token.slice(0, 18)}…
                </Badge>
              </div>
              <pre className="overflow-x-auto rounded-lg border bg-background p-3 text-xs leading-relaxed">
                <code>{envLine}</code>
              </pre>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(envLine);
                  toast.success("Env copied — add to models.json secrets, never git.");
                }}
              >
                <Copy className="h-4 w-4" /> Copy env
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-muted-foreground">
            Attached wings
          </CardTitle>
          <CardDescription>
            none attached — the dev wing is the panel host for now
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
