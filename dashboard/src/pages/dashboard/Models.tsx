import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CATEGORIES } from "@/lib/a0";
import { Activity } from "lucide-react";

const CHAIN_PREVIEW: Record<string, string> = {
  "a0/flagship": "xkiro@qwen3.8-max → llm7@glm-5.3 → openrouter/free",
  "a0/reasoning": "xkiro@deepseek-r-style → llm7 → openrouter",
  "a0/coder": "xkiro@qwen3-coder → llm7@deepseek-v4 → groq → openrouter",
  "a0/vision": "xkiro@(vision) → openrouter/free",
  "a0/fast": "xkiro@qwen3.7-flash → llm7 → openrouter",
  "a0/omni": "xkiro → openrouter (image-in chains)",
  "a0/long": "xkiro@1M-ctx → openrouter/free",
};

export default function Models() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Models</h1>
        <p className="text-sm text-muted-foreground">
          The public surface exposes categories only — chains resolve to the
          best free model at request time.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {CATEGORIES.map((c) => (
          <Card key={c.id}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4 text-primary" />
                <code className="text-sm">{c.id}</code>
              </CardTitle>
              <CardDescription>{c.desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="outline" className="w-fit font-mono text-[10px] leading-relaxed">
                {CHAIN_PREVIEW[c.id]}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
