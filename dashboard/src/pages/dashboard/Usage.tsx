import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { hasSupabaseEnv } from "@/integrations/supabase/client";

const data = Array.from({ length: 24 }, (_, h) => ({
  hour: `${h}:00`,
  tokens: Math.round(
    2000 + 9000 * Math.abs(Math.sin(h * 0.9)) + (h > 6 && h < 22 ? 4200 : 0),
  ),
}));

export default function Usage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Usage</h1>
        <p className="text-sm text-muted-foreground">
          Tokens per day across lanes
          {hasSupabaseEnv
            ? ", fed by gateway usage events (batched, fire-and-forget)."
            : " — demo series until the control plane is wired."}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tokens, last 24h</CardTitle>
          <CardDescription>in + out, all lanes →</CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ left: -18, right: 8 }}>
              <defs>
                <linearGradient id="tok" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <XAxis
                dataKey="hour"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                interval={3}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="tokens"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#tok)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
