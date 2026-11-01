import { initTheme } from "./theme.ts";
import { required } from "./dom.ts";

initTheme(required<HTMLButtonElement>(document, "[data-theme-toggle]"));
