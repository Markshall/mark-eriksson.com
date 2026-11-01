import { DATED_STATS, pageStats } from "../data/stats.ts";

// The build already wrote every stat into the HTML; this only catches the
// date moving on (a new year, a work anniversary) since the last build.
export function refreshDatedStats() {
  const stats = pageStats();
  for (const attr of DATED_STATS) {
    for (const element of document.querySelectorAll(`[${attr}]`)) {
      element.textContent = String(stats[attr]);
    }
  }
}
