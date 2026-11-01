// The portfolio's projects. Shared by the site and scripts/screenshots.ts:
// add a project here, then run `npm run screenshots` to capture it.
// `year`, `stack`, `summary` and `body` are optional and hidden until filled in.
// Each project also gets its own page at /projects/<id>/ (scripts/pages.ts).
export interface Project {
  /** Used for screenshot file names: src/assets/screenshots/<id>-<view>.webp */
  id: string;
  name: string;
  role: string;
  /** Hostname and optional path, without https:// */
  url: string;
  /** Category, also used for the filter buttons. */
  cat: string;
  /** Year the site went live. */
  year?: number;
  stack?: string[];
  /** One or two sentences, shown in the gallery and as the project page's intro. */
  summary?: string;
  /** Longer write-up for the project page (/projects/<id>/), one string per paragraph. */
  body?: string[];
}

// How every Crown Oil group site is built. Each work project's page ends with
// this, after the parts specific to that site.
const GROUP_PLATFORM =
  "Like every site in the group, it’s a custom WordPress theme, front end and back end, built from scratch. It runs on a back-end library I wrote and share across all of the sites, which handles form submissions, phone and email verification and common utilities. Front-end assets are bundled with Vite, and the sites are hosted on AWS behind Cloudflare.";

// The embeddable tools, mentioned on the sites that use them.
const EMBEDDED_TOOLS =
  "The calculators across the group’s sites, including a carbon calculator, a tank size calculator and volume converters, are HTML custom elements I built once and embed wherever they’re needed. Each one takes its colours from the theme of the site it’s on.";

// Quote requests on the fuel sites.
const QUOTES_TO_CRM =
  "Quote requests are verified, then saved to a database that the company’s internal CRM picks up, so they reach the sales team without anyone re-keying them.";

const WP_STACK = ["WordPress", "PHP", "TypeScript", "Vite", "AWS", "Cloudflare"];
const WP_STACK_WITH_TOOLS = ["WordPress", "PHP", "TypeScript", "Web Components", "Vite", "AWS", "Cloudflare"];

export const PROJECTS = (
  [
    {
      id: "crown-oil",
      name: "Crown Oil",
      role: "Lead developer",
      url: "www.crownoil.co.uk",
      cat: "Work",
      year: 2019,
      stack: WP_STACK_WITH_TOOLS,
      summary:
        "The group’s flagship site, for a UK fuel and lubricants supplier trading since 1947. A custom WordPress theme with product pages for HVO, DERV, red diesel and lubricants, a tank size calculator, and quote forms that feed the company’s CRM.",
      body: [QUOTES_TO_CRM, EMBEDDED_TOOLS, GROUP_PLATFORM],
    },
    {
      id: "speedy-fuels",
      name: "Speedy Fuels",
      role: "Lead developer",
      url: "www.speedyfuels.co.uk",
      cat: "Work",
      year: 2021,
      stack: WP_STACK,
      summary:
        "A nationwide fuel delivery brand in the Crown Oil group. A custom WordPress theme built around its top products, with a quick quote form that goes straight into the group’s CRM.",
      body: [QUOTES_TO_CRM, GROUP_PLATFORM],
    },
    {
      id: "sf-sus",
      name: "Speedy Fuels Sustainability",
      role: "Lead developer",
      url: "sustainability.speedyfuels.co.uk",
      cat: "Work",
      year: 2023,
      stack: WP_STACK_WITH_TOOLS,
      summary:
        "A standalone site setting out Speedy Fuels’ carbon-neutral certification and its path to Net Zero, with a carbon calculator showing the carbon saved by switching from diesel to HVO.",
      body: [EMBEDDED_TOOLS, GROUP_PLATFORM],
    },
    {
      id: "co-sus",
      name: "Crown Oil Sustainability",
      role: "Lead developer",
      url: "sustainability.crownoil.co.uk",
      cat: "Work",
      year: 2022,
      stack: WP_STACK_WITH_TOOLS,
      summary:
        "The sustainability hub for the UK’s first carbon-neutral fuel supplier, covering its Net Zero pledge and ESG framework, with a carbon calculator showing the carbon saved by switching from diesel to HVO.",
      body: [EMBEDDED_TOOLS, GROUP_PLATFORM],
    },
    {
      id: "co-env",
      name: "Crown Oil Environmental",
      role: "Lead developer",
      url: "www.crownoilenvironmental.co.uk",
      cat: "Work",
      year: 2022,
      stack: WP_STACK,
      summary:
        "The site for Crown Oil’s industrial services arm: tank cleaning and lining, integrity testing and fuel buyback for commercial customers. A custom WordPress theme with service, sector and case study pages.",
      body: [QUOTES_TO_CRM, GROUP_PLATFORM],
    },
    {
      id: "nationwide-fuels",
      name: "Nationwide Fuels",
      role: "Lead developer",
      url: "www.nationwidefuels.co.uk",
      cat: "Work",
      year: 2020,
      stack: WP_STACK,
      summary:
        "A fuel and lubricants brand serving the construction, agricultural and industrial sectors. A custom WordPress theme with a page for each fuel type, including heating oil, and quote forms that feed the group’s CRM.",
      body: [QUOTES_TO_CRM, GROUP_PLATFORM],
    },
    {
      id: "crown-energy",
      name: "Crown Energy",
      role: "Lead developer",
      url: "www.crownenergy.co.uk",
      cat: "Work",
      year: 2026,
      stack: WP_STACK,
      summary:
        "A gas, electricity and water connections business for homeowners and businesses, including options to spread the cost of domestic projects. The group’s newest custom WordPress theme.",
      body: [GROUP_PLATFORM],
    },
    {
      id: "birlem-oil",
      name: "Birlem Oil",
      role: "Lead developer",
      url: "www.birlemoil.co.uk",
      cat: "Work",
      year: 2018,
      stack: WP_STACK,
      summary:
        "A nationwide fuel and lubricants brand in the group. A custom WordPress theme focused on its most popular products and delivery coverage, with quote forms that feed the group’s CRM.",
      body: [QUOTES_TO_CRM, GROUP_PLATFORM],
    },
    {
      id: "inworkat",
      name: "InWorkAt",
      role: "Project creator & developer",
      url: "www.inwork.at",
      cat: "Personal",
      year: 2015,
      stack: ["Laravel / PHP", "Vite"],
      summary:
        "A free web app for UK shift workers: enter the shifts on your rota and it adds up hours, overtime and holiday, then estimates take-home pay so you can check it against your payslip. Works offline.",
    },
    {
      id: "checkcheck",
      name: "CheckCheck",
      role: "Creator",
      url: "www.mark-eriksson.com/check/",
      cat: "Personal",
      year: 2015,
      stack: ["Vanilla JS"],
      summary:
        "A small tool that finds the check character for a warehouse shelf location, or reverse-looks-up every location sharing a given check character.",
    },
  ] satisfies Project[]
).map((project: Project, i) => ({ ...project, num: String(i + 1).padStart(2, "0") }));
