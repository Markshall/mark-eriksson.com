import { initTheme } from "./theme.ts";
import { initProjects } from "./projects.ts";
import { PROJECTS } from "../data/projects.ts";
import { required } from "./dom.ts";

initTheme(required<HTMLButtonElement>(document, "[data-theme-toggle]"));
initProjects(required(document, "#projects"));

const CAREER_START = new Date(2018, 6); // Jul 2018

const years = Math.floor((Date.now() - CAREER_START.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
required(document, "[data-years]").textContent = String(years);
required(document, "[data-project-total]").textContent = String(PROJECTS.length);
required(document, "[data-personal-total]").textContent = String(
  PROJECTS.filter(project => project.cat === "Personal").length,
);
required(document, "[data-year]").textContent = String(new Date().getFullYear());
