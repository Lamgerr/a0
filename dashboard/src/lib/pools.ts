import type { CatalogModel } from "@/lib/catalog";
import { MODELS } from "@/lib/catalog";

/**
 * Pool hosts — best-first, curated. The resolver walks this order per request
 * and falls through on anything degraded; UI reflects the top of each list.
 * Order: capability coverage (think/tools/vision) > generation > size > context.
 */
export const POOL_HOSTS: Record<string, string[]> = {
  "a0/flagship": [
    "qwen/qwen3.8-max:free",
    "qwen/qwen3.7-plus:free",
    "mistralai/mistral-large-4-0",
    "cohere/command-a-plus",
    "stealth/space-bunny-alpha:free",
  ],
  "a0/reasoning": [
    "qwen/qwen3.8-max:free",
    "cohere/command-a-reasoning",
    "mistralai/mistral-large-4-0",
    "qwen/qwen3.6-max-preview:free",
    "stealth/big-pickle",
  ],
  "a0/coder": [
    "qwen/qwen3-coder-plus:free",
    "mistralai/devstral-medium",
    "mistralai/codestral-2508",
    "cohere/north-mini-code",
    "qwen/qwen3.8-max:free",
  ],
  "a0/vision": [
    "qwen/qwen3-vl-plus:free",
    "mistralai/mistral-large-4-0",
    "cohere/command-a-vision",
    "qwen/qwen3.5-omni-plus:free",
    "qwen/qwen3-omni-flash:free",
  ],
  "a0/fast": [
    "qwen/qwen3.7-flash:free",
    "qwen/qwen3.5-flash:free",
    "qwen/qwen3.8-omni-flash:free",
    "mistralai/ministral-8b",
    "mistralai/mistral-small-2603",
  ],
  "a0/omni": [
    "qwen/qwen3.8-omni-flash:free",
    "qwen/qwen3.5-omni-plus:free",
    "qwen/qwen3-omni-flash:free",
    "cohere/command-a-vision",
    "qwen/qwen3-vl-plus:free",
  ],
  "a0/long": [
    "qwen/qwen3-coder-plus:free",
    "qwen/qwen3.5-plus:free",
    "stealth/space-bunny-alpha:free",
    "meituan/longcat-2.5-preview:free",
    "qwen/qwen3.7-flash:free",
  ],
};

/** resolved hosts for a pool: curated ids that still exist in the snapshot */
export function poolModels(id: string): CatalogModel[] {
  const hosts = POOL_HOSTS[id] ?? [];
  const live = hosts
    .map((h) => MODELS.find((m) => m.id === h))
    .filter((m): m is CatalogModel => Boolean(m));
  return live;
}
