import { defineConfig } from "@playwright/test";

// Smoke tests for the built site (tests/*.spec.ts). They run against
// `astro preview`, so build first: `npm test` does both. They drive the
// installed Google Chrome, like the screenshot script, so there's no browser
// download; GitHub's Ubuntu runners have Chrome preinstalled.
const PORT = 4173;

export default defineConfig({
  testDir: "tests",
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: "chrome",
    // Skip view transitions and smooth scrolling, so each change is immediate.
    reducedMotion: "reduce",
  },
  webServer: {
    // --ignore-lock keeps the server in the foreground, where Playwright can
    // manage it: Astro otherwise starts it in the background when it detects
    // a coding agent running the command.
    command: `npx astro preview --port ${PORT} --ignore-lock`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
  },
});
