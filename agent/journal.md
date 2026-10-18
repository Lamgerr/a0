## 2026-10-18
- Cold start on a0 (new project). User: OpenAI-compatible inference provider over free providers.
- Requested deep recon: verified vs cheahjs list, OmniRoute FREE_TIERS, gravity.fast, freellm.net. Graveyard noted (GitHub Models retired 2026-07, chutes free ended, glhf/kluster/phind dead, cerebras now trial-only).
- User set up xKiro (api.xkiro.com, key in ~/dex). Probed live: 49 free chat models, 1M ctx, vision+tools+reasoning. dex config.py already runs a 4-lane chain (xkiro->llm7->openrouter->gonka) — a0 generalizes it.
- Curated catalog per role (flagship/reasoning/coder/vision/fast/omni) with fallback chains; exclusions logged (soon-retiring models; llm7 closed models default-off is my call).
- User picked: Python gateway + Vite React TSX Tailwind shadcn Supabase dashboard; "no docs, only a single concept.md".
- Wrote concept.md. Next: builder-check subagent, then approval gate.
