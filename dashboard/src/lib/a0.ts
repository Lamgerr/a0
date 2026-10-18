export const CATEGORIES = [
  {
    id: "a0/flagship",
    desc: "best all-round free flagships, 1M-class context",
  },
  { id: "a0/reasoning", desc: "deep-thinking lanes for hard problems" },
  { id: "a0/coder", desc: "code-specialist lanes with tool calling" },
  { id: "a0/vision", desc: "image-in capable free vision models" },
  { id: "a0/fast", desc: "snappiest lanes for chat and drafts" },
  { id: "a0/omni", desc: "text + image mixed-input chains" },
  { id: "a0/long", desc: "longest-context lanes for big docs" },
] as const;

export const A0_BASE_URL: string =
  import.meta.env.VITE_A0_BASE_URL ?? "http://localhost:8082";
