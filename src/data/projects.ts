// The portfolio's projects. Shared by the site and scripts/screenshots.ts:
// add a project here, then run `npm run screenshots` to capture it.
// `year`, `stack`, `summary` and `body` are optional and hidden until filled in.
// Each project also gets its own page at /projects/<id>/ (scripts/pages.ts).
// Sites that are no longer live stay listed, with `retired` set.
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
  /** GTmetrix results for the live site, shown on the project page. */
  scores?: {
    /** GTmetrix Performance and Structure grades, as percentages. */
    performance: number;
    structure: number;
    /** Largest Contentful Paint and Total Blocking Time, in milliseconds. */
    lcp: number;
    tbt: number;
    /** Cumulative Layout Shift. */
    cls: number;
  };
  /**
   * Set when the site has been replaced or taken down. Its links then go to
   * an archived copy instead of the live site, and it's listed after the
   * live projects. Leave `scores` out: there's no live site to measure.
   */
  retired?: {
    /** Year it stopped being live. */
    year: number;
    /**
     * Wayback Machine snapshot timestamp (e.g. "20250613155358") to link to
     * and capture screenshots from. Without one, the project has no link.
     */
    snapshot?: string;
    /** Id of the project that replaced it, linked from both project pages. */
    replacedBy?: string;
  };
}

/** Where a project links to: the live site, or its archived copy once retired (none if there isn't one). */
export function siteHref(project: Project): string | undefined {
  if (!project.retired) return `https://${project.url}/`;
  const { snapshot } = project.retired;
  return snapshot && `https://web.archive.org/web/${snapshot}/https://${project.url}/`;
}

/** The years the site was live, e.g. "2020–2026", or its launch year while it's still live. */
export function liveYears(project: Project): string | undefined {
  if (!project.retired) return project.year === undefined ? undefined : String(project.year);
  return project.year === undefined ? `until ${project.retired.year}` : `${project.year}–${project.retired.year}`;
}

// When the GTmetrix scores below were measured, shown with them on each
// project page. Update it when the scores are re-measured.
export const SCORES_MEASURED = "Nov 2026";

// How every Crown Oil group site is built. Each work project's page ends with
// this, after the parts specific to that site.
const GROUP_PLATFORM =
  "Like every site in the group, it’s a custom WordPress theme, front end and back end, built from scratch. It runs on a back-end library I wrote and share across all of the sites, which handles form submissions, phone and email verification and common utilities. Front-end assets are bundled with Vite, and the sites are hosted on AWS behind Cloudflare: I moved the whole group onto Cloudflare and tuned its caching, which made the sites far more reliable.";

// The embeddable tools, mentioned on the sites that use them. Not every site
// has every tool.
const EMBEDDED_TOOLS =
  "Its calculators come from a set I built for the group, including a carbon calculator, a tank size calculator and volume converters. Each one is an HTML custom element, built once and embedded on whichever sites need it, and takes its colours from the theme of the site it’s on.";

// Quote requests on the fuel sites.
const QUOTES_TO_CRM =
  "Quote requests are verified, then saved to a database that the company’s internal CRM picks up, so they reach the sales team without anyone re-keying them.";

// Crown Energy's enquiries go to a different CRM from the fuel sites'.
const QUOTES_TO_SEPARATE_CRM =
  "Quote requests go through the same verified form handling as the fuel sites, then into a separate CRM for the connections business.";

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
      scores: { performance: 96, structure: 90, lcp: 626, tbt: 126, cls: 0.04 },
    },
    {
      id: "speedy-fuels",
      name: "Speedy Fuels",
      role: "Lead developer",
      url: "www.speedyfuels.co.uk",
      cat: "Work",
      year: 2021,
      stack: WP_STACK_WITH_TOOLS,
      summary:
        "A nationwide fuel delivery brand in the Crown Oil group. A custom WordPress theme built around its top products, with a quick quote form that goes straight into the group’s CRM.",
      body: [QUOTES_TO_CRM, EMBEDDED_TOOLS, GROUP_PLATFORM],
      scores: { performance: 92, structure: 94, lcp: 609, tbt: 295, cls: 0.01 },
    },
    {
      id: "speedy-fuels-sustainability",
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
      id: "crown-oil-sustainability",
      name: "Crown Oil Sustainability",
      role: "Lead developer",
      url: "sustainability.crownoil.co.uk",
      cat: "Work",
      year: 2022,
      stack: WP_STACK_WITH_TOOLS,
      summary:
        "The sustainability hub for the UK’s first carbon-neutral fuel supplier, covering its Net Zero pledge and ESG framework, with a carbon calculator showing the carbon saved by switching from diesel to HVO.",
      body: [EMBEDDED_TOOLS, GROUP_PLATFORM],
      scores: { performance: 93, structure: 98, lcp: 512, tbt: 209, cls: 0 },
    },
    {
      id: "crown-oil-environmental",
      name: "Crown Oil Environmental",
      role: "Lead developer",
      url: "www.crownoilenvironmental.co.uk",
      cat: "Work",
      year: 2022,
      stack: WP_STACK_WITH_TOOLS,
      summary:
        "The site for Crown Oil’s industrial services arm: tank cleaning and lining, integrity testing and fuel buyback for commercial customers. A custom WordPress theme with service, sector and case study pages.",
      body: [QUOTES_TO_CRM, EMBEDDED_TOOLS, GROUP_PLATFORM],
      scores: { performance: 100, structure: 99, lcp: 398, tbt: 72, cls: 0 },
    },
    {
      id: "nationwide-fuels",
      name: "Nationwide Fuels",
      role: "Lead developer",
      url: "www.nationwidefuels.co.uk",
      cat: "Work",
      year: 2020,
      stack: WP_STACK_WITH_TOOLS,
      summary:
        "A fuel and lubricants brand serving the construction, agricultural and industrial sectors. A custom WordPress theme with a page for each fuel type, including heating oil, and quote forms that feed the group’s CRM.",
      body: [QUOTES_TO_CRM, EMBEDDED_TOOLS, GROUP_PLATFORM],
      scores: { performance: 98, structure: 98, lcp: 718, tbt: 96, cls: 0 },
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
      body: [QUOTES_TO_SEPARATE_CRM, GROUP_PLATFORM],
      scores: { performance: 92, structure: 97, lcp: 501, tbt: 122, cls: 0.15 },
    },
    {
      id: "crown-energy-2020",
      name: "Crown Energy (2020)",
      role: "Lead developer",
      url: "www.crownenergy.co.uk",
      cat: "Work",
      year: 2020,
      stack: WP_STACK,
      summary:
        "The previous Crown Energy site, for its gas, electricity and water connections business serving homes, businesses, the public sector and construction. A custom WordPress theme, live until the 2026 rebuild replaced it.",
      body: [GROUP_PLATFORM],
      retired: { year: 2026, snapshot: "20250613155358", replacedBy: "crown-energy" },
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
      scores: { performance: 98, structure: 99, lcp: 938, tbt: 12, cls: 0 },
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
      scores: { performance: 99, structure: 98, lcp: 783, tbt: 22, cls: 0 },
      body: [
        "I started InWorkAt while I was working at Argos. I often started earlier and finished later than my rota said, but the online rota tool only showed the scheduled start and finish times, with no way to change them. I wanted somewhere to record the hours I actually worked.",
        "It’s a Laravel app with a Vite front end, and it installs like an app and works offline, so it’s there when you need it on shift.",
      ],
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
      body: [
        "The hard part was the formula that produces a location’s check character. Once I had that, the rest was the interface: I deliberately designed it to look like the labels in the stockroom, so it felt familiar to the people using it.",
      ],
    },
  ] satisfies Project[]
)
  // Retired projects go after the live ones, otherwise in the order above.
  .toSorted((a: Project, b: Project) => Number(Boolean(a.retired)) - Number(Boolean(b.retired)))
  .map((project: Project, i) => ({ ...project, num: String(i + 1).padStart(2, "0") }));

/** The retired projects that the given one replaced. */
export const previousVersions = (project: Project) => PROJECTS.filter(p => p.retired?.replacedBy === project.id);

for (const project of PROJECTS) {
  const replacedBy = project.retired?.replacedBy;
  if (replacedBy && !PROJECTS.some(p => p.id === replacedBy)) {
    throw new Error(`${project.id}: retired.replacedBy names an unknown project, "${replacedBy}"`);
  }
}
