import { initTheme } from "./theme.js";
import { initProjects } from "./projects.js";

initTheme(document.querySelector("[data-theme-toggle]"));
initProjects(document.querySelector("#projects"));

const CAREER_START = new Date(2018, 6); // Jul 2018

const years = Math.floor((Date.now() - CAREER_START) / (365.25 * 24 * 60 * 60 * 1000));
document.querySelector("[data-years]").textContent = years;
document.querySelector("[data-year]").textContent = new Date().getFullYear();
