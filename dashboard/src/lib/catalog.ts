/**
 * a0 model catalog — free-tier snapshot (generated from upstream // 2026-10-19).
 * Everything a0 serves at zero cost. Paid upstreams are never listed.
 * Regenerate with the catalog script when upstream rotates.
 */
export interface CatalogModel {
  id: string;
  name: string;
  lab: string;
  modality: string;
  ctx: number;
  max_out: number;
  vision: boolean;
  tools: boolean;
  reasoning: boolean;
  efforts: string[];
}

export const MODELS: CatalogModel[] = [
  {
    "id": "cohere/command-a-plus",
    "name": "Command A+",
    "lab": "api",
    "modality": "chat",
    "ctx": 436000,
    "max_out": 64000,
    "vision": true,
    "tools": true,
    "reasoning": true,
    "efforts": [
      "high"
    ]
  },
  {
    "id": "cohere/command-a-reasoning",
    "name": "Command A Reasoning",
    "lab": "api",
    "modality": "chat",
    "ctx": 288768,
    "max_out": 32768,
    "vision": false,
    "tools": true,
    "reasoning": true,
    "efforts": [
      "none",
      "high"
    ]
  },
  {
    "id": "cohere/command-a",
    "name": "Command A",
    "lab": "api",
    "modality": "chat",
    "ctx": 288000,
    "max_out": 8192,
    "vision": false,
    "tools": true,
    "reasoning": false,
    "efforts": []
  },
  {
    "id": "sensenova/sensenova-6.8-flash-lite",
    "name": "SenseNova 6.8 Flash-Lite",
    "lab": "api",
    "modality": "chat",
    "ctx": 262144,
    "max_out": 65536,
    "vision": true,
    "tools": true,
    "reasoning": true,
    "efforts": [
      "none",
      "low",
      "medium",
      "high"
    ]
  },
  {
    "id": "cohere/north-mini-code",
    "name": "North Mini Code",
    "lab": "api",
    "modality": "chat",
    "ctx": 256000,
    "max_out": 64000,
    "vision": false,
    "tools": true,
    "reasoning": true,
    "efforts": [
      "none",
      "high"
    ]
  },
  {
    "id": "cohere/command-r7b-12-2024",
    "name": "Command R7B (12-2024)",
    "lab": "api",
    "modality": "chat",
    "ctx": 132000,
    "max_out": 4096,
    "vision": false,
    "tools": true,
    "reasoning": false,
    "efforts": []
  },
  {
    "id": "cohere/command-r-08-2024",
    "name": "Command R (08-2024)",
    "lab": "api",
    "modality": "chat",
    "ctx": 128000,
    "max_out": 4096,
    "vision": false,
    "tools": true,
    "reasoning": false,
    "efforts": []
  },
  {
    "id": "cohere/command-r-plus-08-2024",
    "name": "Command R+ (08-2024)",
    "lab": "api",
    "modality": "chat",
    "ctx": 128000,
    "max_out": 4096,
    "vision": false,
    "tools": true,
    "reasoning": false,
    "efforts": []
  },
  {
    "id": "cohere/aya-expanse-32b",
    "name": "Aya Expanse 32B",
    "lab": "api",
    "modality": "chat",
    "ctx": 128000,
    "max_out": 4096,
    "vision": false,
    "tools": false,
    "reasoning": false,
    "efforts": []
  },
  {
    "id": "cohere/command-a-vision",
    "name": "Command A Vision",
    "lab": "api",
    "modality": "chat",
    "ctx": 128000,
    "max_out": 8192,
    "vision": true,
    "tools": false,
    "reasoning": false,
    "efforts": []
  },
  {
    "id": "cohere/north-small-translate",
    "name": "North Small Translate",
    "lab": "api",
    "modality": "chat",
    "ctx": 32768,
    "max_out": 16384,
    "vision": false,
    "tools": false,
    "reasoning": false,
    "efforts": []
  },
  {
    "id": "cohere/aya-vision-32b",
    "name": "Aya Vision 32B",
    "lab": "api",
    "modality": "chat",
    "ctx": 16384,
    "max_out": 4096,
    "vision": false,
    "tools": false,
    "reasoning": false,
    "efforts": []
  },
  {
    "id": "cohere/command-a-translate",
    "name": "Command A Translate",
    "lab": "api",
    "modality": "chat",
    "ctx": 8992,
    "max_out": 8000,
    "vision": false,
    "tools": true,
    "reasoning": false,
    "efforts": []
  },
  {
    "id": "cohere/tiny-aya-global",
    "name": "Tiny Aya Global",
    "lab": "api",
    "modality": "chat",
    "ctx": 8192,
    "max_out": 8192,
    "vision": false,
    "tools": true,
    "reasoning": false,
    "efforts": []
  },
  {
    "id": "cohere/tiny-aya-earth",
    "name": "Tiny Aya Earth",
    "lab": "api",
    "modality": "chat",
    "ctx": 8192,
    "max_out": 8192,
    "vision": false,
    "tools": true,
    "reasoning": false,
    "efforts": []
  },
  {
    "id": "cohere/tiny-aya-fire",
    "name": "Tiny Aya Fire",
    "lab": "api",
    "modality": "chat",
    "ctx": 8192,
    "max_out": 8192,
    "vision": false,
    "tools": true,
    "reasoning": false,
    "efforts": []
  },
  {
    "id": "cohere/tiny-aya-water",
    "name": "Tiny Aya Water",
    "lab": "api",
    "modality": "chat",
    "ctx": 8192,
    "max_out": 8192,
    "vision": false,
    "tools": true,
    "reasoning": false,
    "efforts": []
  },
  {
    "id": "mistralai/mistral-large-4-0",
    "name": "Mistral Large 4",
    "lab": "mistral",
    "modality": "chat",
    "ctx": 524288,
    "max_out": 65536,
    "vision": true,
    "tools": true,
    "reasoning": true,
    "efforts": [
      "none",
      "high"
    ]
  },
  {
    "id": "mistralai/ministral-14b",
    "name": "Ministral 3 14B",
    "lab": "mistral",
    "modality": "chat",
    "ctx": 256000,
    "max_out": 8192,
    "vision": true,
    "tools": true,
    "reasoning": false,
    "efforts": []
  },
  {
    "id": "mistralai/mistral-large-2512",
    "name": "Mistral Large 3",
    "lab": "mistral",
    "modality": "chat",
    "ctx": 256000,
    "max_out": 16384,
    "vision": true,
    "tools": true,
    "reasoning": false,
    "efforts": []
  },
  {
    "id": "mistralai/mistral-medium-3.5",
    "name": "Mistral Medium 3.5",
    "lab": "mistral",
    "modality": "chat",
    "ctx": 256000,
    "max_out": 65536,
    "vision": true,
    "tools": true,
    "reasoning": true,
    "efforts": [
      "none",
      "high"
    ]
  },
  {
    "id": "mistralai/mistral-small-2603",
    "name": "Mistral Small 4",
    "lab": "mistral",
    "modality": "chat",
    "ctx": 256000,
    "max_out": 65536,
    "vision": true,
    "tools": true,
    "reasoning": true,
    "efforts": [
      "none",
      "high"
    ]
  },
  {
    "id": "mistralai/devstral-medium",
    "name": "Devstral 2",
    "lab": "mistral",
    "modality": "chat",
    "ctx": 256000,
    "max_out": 16384,
    "vision": false,
    "tools": true,
    "reasoning": false,
    "efforts": []
  },
  {
    "id": "mistralai/codestral-2508",
    "name": "Codestral",
    "lab": "mistral",
    "modality": "chat",
    "ctx": 256000,
    "max_out": 16384,
    "vision": false,
    "tools": true,
    "reasoning": false,
    "efforts": []
  },
  {
    "id": "mistralai/ministral-8b",
    "name": "Ministral 3 8B",
    "lab": "mistral",
    "modality": "chat",
    "ctx": 256000,
    "max_out": 8192,
    "vision": true,
    "tools": true,
    "reasoning": false,
    "efforts": []
  },
  {
    "id": "mistralai/ministral-3b",
    "name": "Ministral 3 3B",
    "lab": "mistral",
    "modality": "chat",
    "ctx": 128000,
    "max_out": 8192,
    "vision": true,
    "tools": true,
    "reasoning": false,
    "efforts": []
  },
  {
    "id": "meituan/longcat-2.0",
    "name": "LongCat 2.0",
    "lab": "opencode-zen",
    "modality": "chat",
    "ctx": 1048576,
    "max_out": 65536,
    "vision": false,
    "tools": true,
    "reasoning": true,
    "efforts": []
  },
  {
    "id": "meituan/longcat-2.5-preview:free",
    "name": "LongCat 2.5 Preview (Free)",
    "lab": "opencode-zen",
    "modality": "chat",
    "ctx": 1000000,
    "max_out": 65536,
    "vision": false,
    "tools": true,
    "reasoning": true,
    "efforts": []
  },
  {
    "id": "qwen/qwen3-coder-plus:free",
    "name": "Qwen3 Coder Plus (Free)",
    "lab": "qwen",
    "modality": "chat",
    "ctx": 1048576,
    "max_out": 65536,
    "vision": true,
    "tools": true,
    "reasoning": true,
    "efforts": []
  },
  {
    "id": "qwen/qwen3.6-plus:free",
    "name": "Qwen3.6 Plus (Free)",
    "lab": "qwen",
    "modality": "chat",
    "ctx": 1000000,
    "max_out": 65536,
    "vision": true,
    "tools": true,
    "reasoning": true,
    "efforts": []
  },
  {
    "id": "qwen/qwen3.7-max:free",
    "name": "Qwen3.7 Max (Free)",
    "lab": "qwen",
    "modality": "chat",
    "ctx": 1000000,
    "max_out": 65536,
    "vision": false,
    "tools": true,
    "reasoning": true,
    "efforts": []
  },
  {
    "id": "qwen/qwen3.7-plus:free",
    "name": "Qwen3.7 Plus (Free)",
    "lab": "qwen",
    "modality": "chat",
    "ctx": 1000000,
    "max_out": 65536,
    "vision": true,
    "tools": true,
    "reasoning": true,
    "efforts": []
  },
  {
    "id": "qwen/qwen3.8-max:free",
    "name": "Qwen3.8 Max (Free)",
    "lab": "qwen",
    "modality": "chat",
    "ctx": 1000000,
    "max_out": 65536,
    "vision": true,
    "tools": true,
    "reasoning": true,
    "efforts": []
  },
  {
    "id": "qwen/qwen3.8-omni-flash:free",
    "name": "Qwen3.8 Omni Flash (Free)",
    "lab": "qwen",
    "modality": "chat",
    "ctx": 1000000,
    "max_out": 65536,
    "vision": true,
    "tools": true,
    "reasoning": true,
    "efforts": []
  },
  {
    "id": "qwen/qwen3.7-flash:free",
    "name": "Qwen3.7 Flash (Free)",
    "lab": "qwen",
    "modality": "chat",
    "ctx": 1000000,
    "max_out": 65536,
    "vision": true,
    "tools": true,
    "reasoning": true,
    "efforts": []
  },
  {
    "id": "qwen/qwen3.5-plus:free",
    "name": "Qwen3.5 Plus (Free)",
    "lab": "qwen",
    "modality": "chat",
    "ctx": 1000000,
    "max_out": 65536,
    "vision": true,
    "tools": true,
    "reasoning": true,
    "efforts": []
  },
  {
    "id": "qwen/qwen3.5-flash:free",
    "name": "Qwen3.5 Flash (Free)",
    "lab": "qwen",
    "modality": "chat",
    "ctx": 1000000,
    "max_out": 65536,
    "vision": true,
    "tools": true,
    "reasoning": true,
    "efforts": []
  },
  {
    "id": "qwen/qwen3-vl-plus:free",
    "name": "Qwen3 VL Plus (Free)",
    "lab": "qwen",
    "modality": "chat",
    "ctx": 262144,
    "max_out": 65536,
    "vision": true,
    "tools": true,
    "reasoning": true,
    "efforts": []
  },
  {
    "id": "qwen/qwen3-omni-flash:free",
    "name": "Qwen3 Omni Flash (Free)",
    "lab": "qwen",
    "modality": "chat",
    "ctx": 262144,
    "max_out": 65536,
    "vision": true,
    "tools": true,
    "reasoning": false,
    "efforts": []
  },
  {
    "id": "qwen/qwen3.5-omni-flash:free",
    "name": "Qwen3.5 Omni Flash (Free)",
    "lab": "qwen",
    "modality": "chat",
    "ctx": 262144,
    "max_out": 65536,
    "vision": true,
    "tools": true,
    "reasoning": false,
    "efforts": []
  },
  {
    "id": "qwen/qwen3.6-max-preview:free",
    "name": "Qwen3.6 Max Preview (Free)",
    "lab": "qwen",
    "modality": "chat",
    "ctx": 262144,
    "max_out": 65536,
    "vision": false,
    "tools": true,
    "reasoning": true,
    "efforts": []
  },
  {
    "id": "qwen/qwen3.6-27b:free",
    "name": "Qwen3.6 27B (Free)",
    "lab": "qwen",
    "modality": "chat",
    "ctx": 262144,
    "max_out": 65536,
    "vision": true,
    "tools": true,
    "reasoning": true,
    "efforts": []
  },
  {
    "id": "qwen/qwen3.5-omni-plus:free",
    "name": "Qwen3.5 Omni Plus (Free)",
    "lab": "qwen",
    "modality": "chat",
    "ctx": 262144,
    "max_out": 65536,
    "vision": true,
    "tools": true,
    "reasoning": false,
    "efforts": []
  },
  {
    "id": "qwen/qwen3.6-35b-a3b:free",
    "name": "Qwen3.6 35B A3B (Free)",
    "lab": "qwen",
    "modality": "chat",
    "ctx": 262144,
    "max_out": 65536,
    "vision": true,
    "tools": true,
    "reasoning": true,
    "efforts": []
  },
  {
    "id": "qwen/qwen3.5-397b-a17b:free",
    "name": "Qwen3.5 397B A17B (Free)",
    "lab": "qwen",
    "modality": "chat",
    "ctx": 262144,
    "max_out": 65536,
    "vision": true,
    "tools": true,
    "reasoning": true,
    "efforts": []
  },
  {
    "id": "qwen/qwen3-max:free",
    "name": "Qwen3 Max (Free)",
    "lab": "qwen",
    "modality": "chat",
    "ctx": 262144,
    "max_out": 65536,
    "vision": true,
    "tools": true,
    "reasoning": true,
    "efforts": []
  },
  {
    "id": "qwen/qwen-plus-2025-07-28:free",
    "name": "Qwen Plus 0728 (Free)",
    "lab": "qwen",
    "modality": "chat",
    "ctx": 131072,
    "max_out": 65536,
    "vision": true,
    "tools": true,
    "reasoning": true,
    "efforts": []
  },
  {
    "id": "stealth/space-bunny-alpha:free",
    "name": "Space Bunny Alpha (Free)",
    "lab": "stealth",
    "modality": "chat",
    "ctx": 1000000,
    "max_out": 65536,
    "vision": true,
    "tools": true,
    "reasoning": true,
    "efforts": [
      "high"
    ]
  },
  {
    "id": "stealth/big-pickle",
    "name": "Big Pickle (Free)",
    "lab": "stealth",
    "modality": "chat",
    "ctx": 200000,
    "max_out": 65536,
    "vision": false,
    "tools": true,
    "reasoning": true,
    "efforts": []
  }
];

export const LABS = ["api","mistral","opencode-zen","qwen","stealth"];

export const FREE_COUNT = 49;

export function fmtCtx(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".0", "")}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}K`;
  return String(n);
}
