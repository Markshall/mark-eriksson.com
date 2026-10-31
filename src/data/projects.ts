// The portfolio's projects. Shared by the site and scripts/screenshots.ts:
// add a project here, then run `npm run screenshots` to capture it.
// `year`, `stack` and `summary` are optional and hidden until filled in.
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
  summary?: string;
}

export const PROJECTS = (
  [
    {
      id: "crown-oil",
      name: "Crown Oil",
      role: "Lead developer",
      url: "www.crownoil.co.uk",
      cat: "Work",
      year: 2019,
      stack: ["WordPress / PHP", "TypeScript", "Node"],
      summary:
        "The flagship site for a UK fuel and lubricants supplier trading since 1947: product pages for HVO, DERV, red diesel and lubricants, with quote requests feeding the sales team.",
    },
    {
      id: "speedy-fuels",
      name: "Speedy Fuels",
      role: "Lead developer",
      url: "www.speedyfuels.co.uk",
      cat: "Work",
      year: 2021,
      stack: ["WordPress / PHP", "TypeScript", "Node"],
      summary:
        "A nationwide fuel delivery brand in the Crown Oil group, built around its top products and a quick quote form.",
    },
    {
      id: "sf-sus",
      name: "Speedy Fuels Sustainability",
      role: "Lead developer",
      url: "sustainability.speedyfuels.co.uk",
      cat: "Work",
      year: 2023,
      stack: ["WordPress / PHP", "TypeScript", "Node"],
      summary:
        "A standalone sustainability site setting out Speedy Fuels’ carbon-neutral certification and its path to Net Zero.",
    },
    {
      id: "co-sus",
      name: "Crown Oil Sustainability",
      role: "Lead developer",
      url: "sustainability.crownoil.co.uk",
      cat: "Work",
      year: 2022,
      stack: ["WordPress / PHP", "TypeScript", "Node"],
      summary:
        "The sustainability hub for the UK’s first carbon-neutral fuel supplier, covering its Net Zero pledge and ESG framework, with a calculator showing the carbon saved by switching from diesel to HVO.",
    },
    {
      id: "co-env",
      name: "Crown Oil Environmental",
      role: "Lead developer",
      url: "www.crownoilenvironmental.co.uk",
      cat: "Work",
      year: 2022,
      stack: ["WordPress / PHP", "TypeScript", "Node"],
      summary:
        "The site for Crown Oil’s industrial services arm, presenting tank cleaning and lining, integrity testing and fuel buyback services to commercial customers.",
    },
    {
      id: "nationwide-fuels",
      name: "Nationwide Fuels",
      role: "Lead developer",
      url: "www.nationwidefuels.co.uk",
      cat: "Work",
      year: 2020,
      stack: ["WordPress / PHP", "TypeScript", "Node"],
      summary:
        "A fuel and lubricants brand serving the construction, agricultural and industrial sectors, with pages for each fuel type, including heating oil.",
    },
    {
      id: "crown-energy",
      name: "Crown Energy",
      role: "Lead developer",
      url: "www.crownenergy.co.uk",
      cat: "Work",
      year: 2026,
      stack: ["WordPress / PHP", "TypeScript", "Node"],
      summary:
        "A site for a gas, electricity and water connections business, aimed at both homeowners and businesses, including options to spread the cost of domestic projects.",
    },
    {
      id: "birlem-oil",
      name: "Birlem Oil",
      role: "Lead developer",
      url: "www.birlemoil.co.uk",
      cat: "Work",
      year: 2018,
      stack: ["WordPress / PHP", "TypeScript", "Node"],
      summary:
        "A nationwide fuel and lubricants brand in the group, focused on its most popular products and delivery coverage.",
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
