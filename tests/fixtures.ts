import { test as base, expect } from "@playwright/test";

const GTM = /(^|\.)googletagmanager\.com$/;

// Every page in the tests is cut off from the internet:
// - Google Tag Manager requests get an empty script, so tests never send
//   analytics hits. `gtmRequests` lists the URLs asked for, for the consent tests.
// - Any other request off the site is blocked and fails the test, so a new
//   third-party request can't slip in unnoticed.
export const test = base.extend<{ gtmRequests: string[] }>({
  gtmRequests: async ({}, use) => {
    await use([]);
  },
  page: async ({ page, baseURL, gtmRequests }, use) => {
    const offSite: string[] = [];
    await page.route(
      url => !url.href.startsWith(baseURL!),
      route => {
        const url = route.request().url();
        if (GTM.test(new URL(url).hostname)) {
          gtmRequests.push(url);
          return route.fulfill({ contentType: "text/javascript", body: "" });
        }
        offSite.push(url);
        return route.abort();
      },
    );
    await use(page);
    expect(offSite, "requests off the site").toEqual([]);
  },
});

export { expect };
