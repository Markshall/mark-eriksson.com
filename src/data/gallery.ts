// What the homepage project gallery shows, shared by the build, which renders
// the first project into the HTML (src/components/ProjectGallery.astro) so
// search engines and visitors see it without JavaScript, and the browser,
// which updates it as the visitor browses (src/scripts/projects.ts).
import { PROJECTS, siteHref } from "./projects.ts";

type ListedProject = (typeof PROJECTS)[number];

export const FILTERS = ["All", ...new Set(PROJECTS.map(project => project.cat))];

/** The projects a filter shows. */
export const filtered = (filter: string) =>
  filter === "All" ? PROJECTS : PROJECTS.filter(project => project.cat === filter);

export const countLabel = (shown: number) => `showing ${shown} of ${PROJECTS.length}`;

export const positionLabel = (index: number, total: number) => `${index + 1} / ${total}`;

/** A piece of syntax-highlighted JSON: plain text, or [kind, text] for a json-<kind> span. */
export type JsonToken = string | [kind: "key" | "string" | "number", text: string];

// Pretty-print a flat object as JSON, with arrays on one line.
function jsonTokens(data: Record<string, unknown>): JsonToken[] {
  const value = (v: unknown): JsonToken[] =>
    Array.isArray(v)
      ? ["[", ...v.flatMap((item, i) => [...(i ? [", "] : []), ...value(item)]), "]"]
      : [[typeof v === "string" ? "string" : "number", JSON.stringify(v)]];

  const entries = Object.entries(data).flatMap(([key, v], i, all): JsonToken[] => [
    "\n  ",
    ["key", JSON.stringify(key)],
    ": ",
    ...value(v),
    ...(i < all.length - 1 ? [","] : []),
  ]);
  return ["{", ...entries, "\n}"];
}

/** The text and links shown for the selected project. */
export function projectDetails(project: ListedProject) {
  return {
    url: `https://${project.url}`,
    // The project's details as JSON under its title, minus unfilled fields.
    json: jsonTokens(
      Object.fromEntries(
        Object.entries({
          role: project.role,
          year: project.year,
          retired: project.retired?.year,
          stack: project.stack,
        }).filter(([, value]) => value !== undefined),
      ),
    ),
    // Retired projects link to their archived copy, if they have one.
    href: siteHref(project),
    visitLabel: project.retired ? "View archived copy" : "Visit site",
    detailsHref: `/projects/${project.id}/`,
    detailsLabel: `${project.name} details`,
    alt: {
      desktop: `${project.name} homepage, full page`,
      mobile: `${project.name} on mobile, full page`,
    },
  };
}
