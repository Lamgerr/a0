/**
 * a0 never exposes provider plumbing. Internal lane names surface as tiers.
 * Lane order is the SLA: traffic falls through tiers on failure.
 */
const LANE_LABEL: Record<string, string> = {
  xkiro: "Tier 1",
  llm7: "Tier 2",
  openrouter: "Tier 3",
  kilo: "Tier 4",
  kilo2: "Tier 4",
  ovh: "Tier 5",
  gonka: "Reserve",
};

export function laneLabel(lane: string): string {
  return LANE_LABEL[lane] ?? "Tier";
}
