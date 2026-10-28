// The portfolio's projects. Shared by the site and scripts/screenshots.js:
// add a project here, then run `npm run screenshots` to capture it.
// `stack` and `summary` are optional; their rows are hidden until filled in.
export const PROJECTS = [
  { id: "careers", name: "Crown Careers", role: "Lead developer", url: "www.crownoilcareers.co.uk", cat: "Careers" },
  { id: "sf-sus", name: "Speedy Fuels Sustainability", role: "Lead developer", url: "sustainability.speedyfuels.co.uk", cat: "Sustainability" },
  { id: "co-sus", name: "Crown Oil Sustainability", role: "Lead developer", url: "sustainability.crownoil.co.uk", cat: "Sustainability" },
  { id: "co-env", name: "Crown Oil Environmental", role: "Lead developer", url: "www.crownoilenvironmental.co.uk", cat: "Energy" },
  { id: "speedy", name: "Speedy Fuels", role: "Lead developer", url: "www.speedyfuels.co.uk", cat: "Energy" },
  { id: "rockdoor", name: "Rockdoor", role: "Lead developer", url: "www.rockdoor.com", cat: "Other" },
  { id: "nationwide", name: "Nationwide Fuels", role: "Lead developer", url: "www.nationwidefuels.co.uk", cat: "Energy" },
  { id: "energy", name: "Crown Energy", role: "Lead developer", url: "www.crownenergy.co.uk", cat: "Energy" },
  { id: "crownoil", name: "Crown Oil", role: "Lead developer", url: "www.crownoil.co.uk", cat: "Energy" },
  { id: "birlem", name: "Birlem Oil", role: "Lead developer", url: "www.birlemoil.co.uk", cat: "Energy" },
  { id: "inworkat", name: "InWorkAt", role: "Project creator & developer", url: "www.inwork.at", cat: "Own product" },
].map((project, i) => ({ ...project, num: String(i + 1).padStart(2, "0") }));
