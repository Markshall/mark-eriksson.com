// Entry script for the standalone pages (404, privacy): the theme toggle, plus
// the cookie banner and footer year on pages that have them.
import { initConsent } from "./consent.ts";
import { initTheme } from "./theme.ts";
import { refreshDatedStats } from "./stats.ts";
import { required } from "./dom.ts";

const consentOpener = document.querySelector<HTMLElement>("[data-consent-open]");
if (consentOpener) initConsent(consentOpener);
initTheme(required<HTMLButtonElement>(document, "[data-theme-toggle]"));
refreshDatedStats();
