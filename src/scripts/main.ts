import { initConsent } from "./consent.ts";
import { initTheme } from "./theme.ts";
import { initProjects } from "./projects.ts";
import { refreshDatedStats } from "./stats.ts";
import { required } from "./dom.ts";

// First, so an error further down can't stop the consent banner appearing.
initConsent(required(document, "[data-consent-open]"));
initTheme(required<HTMLButtonElement>(document, "[data-theme-toggle]"));
initProjects(required(document, "#projects"));
refreshDatedStats();
