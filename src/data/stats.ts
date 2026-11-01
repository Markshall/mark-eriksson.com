// The hero stats and footer year. The build writes them into the HTML (the
// `page-stats` plugin in vite.config.ts), so they're right without
// JavaScript. The two that change with the date are refreshed in the browser
// too, in case the site goes a while without a rebuild.
import { PROJECTS } from "./projects.ts";

const CAREER_START = new Date(2018, 6); // Jul 2018

const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

/** Each value is keyed by the data attribute of the element that shows it. */
export function pageStats(now = new Date()) {
  return {
    "data-years": Math.floor((now.getTime() - CAREER_START.getTime()) / YEAR_MS),
    "data-year": now.getFullYear(),
    "data-project-total": PROJECTS.length,
    "data-personal-total": PROJECTS.filter(project => project.cat === "Personal").length,
  };
}

/** The stats that change with the date rather than with a rebuild. */
export const DATED_STATS = ["data-years", "data-year"] as const;
