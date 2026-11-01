// Generates the pages that come from data rather than being written by hand:
// a page per project (/projects/<id>/, from src/data/projects.ts) and the
// notes (/notes/ and /notes/<slug>/, from content/notes/*.md). Each page is
// templates/layout.html with its own <main>.
//
// The pages are written into src/ (git-ignored) so Vite builds and serves them
// like the hand-written ones: same CSS, scripts, asset hashing, CSP hashes and
// build-time stats. vite.config.ts runs this before every build and dev server
// start, and again in dev whenever a source file changes.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { marked } from "marked";
import { PROJECTS } from "../src/data/projects.ts";

const ROOT = join(import.meta.dirname, "..");
const SRC = join(ROOT, "src");
const NOTES_DIR = join(ROOT, "content", "notes");
const SCREENSHOTS = join(SRC, "assets", "screenshots");

/** Files whose changes mean the pages should be generated again. */
export const PAGE_SOURCES = ["src/data/projects.ts", "templates", "content/notes", "src/assets/screenshots"];

/** Folders under src/ that this script owns and rewrites. */
const GENERATED = ["projects", "notes"];

export interface GeneratedPage {
  /** URL path, e.g. /projects/crown-oil/ */
  path: string;
  /** The generated HTML file, relative to the project folder. */
  file: string;
  /** Files whose last commit dates the page, for the sitemap. */
  sources: string[];
}

// ---------------------------------------------------------------------------
// HTML helpers. Interpolated values are escaped unless wrapped in raw().

class Raw {
  html: string;
  constructor(html: string) {
    this.html = html;
  }
}

const raw = (html: string) => new Raw(html);

const escape = (text: string) =>
  text.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

type Value = Raw | string | number | false | null | undefined | Value[];

const render = (value: Value): string =>
  value instanceof Raw
    ? value.html
    : Array.isArray(value)
      ? value.map(render).join("")
      : value === false || value == null
        ? ""
        : escape(String(value));

function html(strings: TemplateStringsArray, ...values: Value[]): Raw {
  return raw(strings.reduce((out, string, i) => out + string + (i < values.length ? render(values[i]) : ""), ""));
}

// JSON inside <script> can't contain "</script>", so escape every "<".
const jsonLd = (data: unknown) => raw(JSON.stringify(data, null, 2).replace(/</g, "\\u003c"));

const arrow = (direction: string) => html`<span class="arrow-icon ${direction}" aria-hidden="true"></span>`;

// ---------------------------------------------------------------------------
// Layout

interface PageMeta {
  title: string;
  description: string;
  path: string;
  ogType: "website" | "article";
  /** A site path, e.g. /img/og-image.png, written as an absolute URL. */
  ogImage: string;
  jsonLd: unknown;
  /** The page's entry script, from src/. */
  script: "/scripts/page.ts" | "/scripts/project-page.ts";
  main: Raw;
}

const LAYOUT = () => readFileSync(join(ROOT, "templates", "layout.html"), "utf8");

function page(meta: PageMeta): string {
  const fields: Record<string, string> = {
    title: escape(meta.title),
    ogTitle: escape(meta.title.replace(/ — Mark Eriksson$/, "")),
    description: escape(meta.description),
    path: escape(meta.path),
    ogType: meta.ogType,
    ogImage: escape(meta.ogImage),
    jsonLd: jsonLd(meta.jsonLd).html,
    script: meta.script,
    main: meta.main.html,
  };
  return LAYOUT().replace(/\{\{\{?(\w+)\}?\}\}/g, (match, key: string) => {
    if (!(key in fields)) throw new Error(`templates/layout.html: unknown field ${match}`);
    return fields[key];
  });
}

const SITE = "%VITE_SITE_URL%";
const PERSON = { "@type": "Person", name: "Mark Eriksson", url: `${SITE}/` };

const breadcrumbs = (...items: [name: string, path: string][]) => ({
  "@type": "BreadcrumbList",
  itemListElement: [["Home", "/"] as const, ...items].map(([name, path], i) => ({
    "@type": "ListItem",
    position: i + 1,
    name,
    item: `${SITE}${path}`,
  })),
});

// ---------------------------------------------------------------------------
// Project pages

type Project = (typeof PROJECTS)[number];

/** Social preview images, made from each desktop screenshot by vite.config.ts. */
export const projectOgImage = (id: string) => `/img/projects/${id}.jpg`;

export const screenshotFile = (id: string, view: "desktop" | "mobile") => join(SCREENSHOTS, `${id}-${view}.webp`);

const hasScreenshots = (project: Project) =>
  existsSync(screenshotFile(project.id, "desktop")) && existsSync(screenshotFile(project.id, "mobile"));

// The srcset is filled in by src/scripts/project-page.ts, from the same
// resized files as the homepage gallery (Vite doesn't resize images linked
// from HTML). The stage is at most 960px wide (.case-stage): the browser is
// 97% of it and the phone 25.5%, at least 96px.
const SIZES = {
  desktop: "(min-width: 1008px) 931px, calc(97vw - 47px)",
  mobile: "(min-width: 1008px) 245px, max(96px, calc(25.5vw - 12px))",
};

const shot = (project: Project, view: "desktop" | "mobile", alt: string) =>
  html`<img
    class="shot-track"
    data-shot="${view}"
    data-project="${project.id}"
    sizes="${SIZES[view]}"
    alt="${alt}"
    decoding="async"
  />`;

function projectMain(project: Project, i: number): Raw {
  const href = `https://${project.url}/`;
  const prev = PROJECTS[(i - 1 + PROJECTS.length) % PROJECTS.length];
  const next = PROJECTS[(i + 1) % PROJECTS.length];
  const shots = hasScreenshots(project);
  const facts: [string, Value][] = [
    ["role", project.role],
    ["year", project.year],
    ["stack", project.stack?.join(" · ")],
    ["category", project.cat],
  ];

  return html`<main>
    <article class="case">
      <div class="wrap case-head">
        <a class="case-back mono" href="/#projects/${project.id}">${arrow("left")} ~/projects</a>
        <div class="section-title">
          <p class="eyebrow mono">// ${project.num} · ${project.cat.toLowerCase()}</p>
          <h1>${project.name}<span class="accent">_</span></h1>
        </div>
        ${project.summary ? html`<p class="lede">${project.summary}</p>` : false}
        <div class="actions">
          <a class="btn btn-solid" href="${href}" target="_blank" rel="noopener noreferrer">
            Visit ${project.url.replace(/^www\./, "").replace(/\/$/, "")} ${arrow("up-right")}
          </a>
        </div>
        <dl class="case-facts">
          ${facts
            .filter(([, value]) => value !== undefined)
            .map(
              ([term, value]) =>
                html`<div>
                  <dt class="eyebrow mono">${term}</dt>
                  <dd>${value}</dd>
                </div>`,
            )}
        </dl>
      </div>

      <section class="band" aria-label="Screenshots">
        <div class="wrap">
          <div class="stage case-stage${shots ? " has-shots" : ""}">
            <a class="browser" href="${href}" target="_blank" rel="noopener noreferrer">
              <div class="browser-bar">
                <span class="dots" aria-hidden="true"><span></span><span></span><span></span></span>
                <span class="url mono">https://${project.url}</span>
              </div>
              ${
                shots
                  ? html`<div class="shot">${shot(project, "desktop", `${project.name} homepage, full page`)}</div>`
                  : html`<div class="canvas" aria-hidden="true"><span class="big-num">${project.num}</span></div>`
              }
            </a>
            ${
              shots
                ? html`<div class="phone">
                    <div class="shot">${shot(project, "mobile", `${project.name} on mobile, full page`)}</div>
                  </div>`
                : false
            }
          </div>
        </div>
      </section>

      ${
        project.body?.length
          ? html`<div class="wrap"><div class="prose case-body">${project.body.map(p => html`<p>${p}</p>`)}</div></div>`
          : false
      }
    </article>

    <nav class="wrap case-pager mono" aria-label="More projects">
      <a href="/projects/${prev.id}/" rel="prev">${arrow("left")} ${prev.name}</a>
      <a href="/projects/${next.id}/" rel="next">${next.name} ${arrow("")}</a>
    </nav>
  </main>`;
}

function projectPage(project: Project, i: number): string {
  const path = `/projects/${project.id}/`;
  const description = project.summary ?? `${project.name}, a ${project.cat.toLowerCase()} project by Mark Eriksson.`;
  return page({
    title: `${project.name} — Mark Eriksson`,
    description,
    path,
    ogType: "article",
    ogImage: hasScreenshots(project) ? projectOgImage(project.id) : "/img/og-image.png",
    script: "/scripts/project-page.ts",
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "CreativeWork",
          name: project.name,
          description,
          url: `${SITE}${path}`,
          about: { "@type": "WebSite", name: project.name, url: `https://${project.url}/` },
          creator: PERSON,
          ...(project.year && { dateCreated: String(project.year) }),
          ...(project.stack && { keywords: project.stack.join(", ") }),
        },
        breadcrumbs(["Projects", "/#projects"], [project.name, path]),
      ],
    },
    main: projectMain(project, i),
  });
}

// ---------------------------------------------------------------------------
// Notes

export interface Note {
  slug: string;
  title: string;
  description: string;
  /** YYYY-MM-DD */
  date: string;
  draft: boolean;
  html: string;
}

// A note is Markdown with a front matter block of `key: value` lines:
//
//   ---
//   title: Hashing inline scripts into a CSP
//   description: One line for search results and link previews.
//   date: 2026-11-01
//   draft: true
//   ---
function readNote(file: string): Note {
  const source = readFileSync(join(NOTES_DIR, file), "utf8");
  const match = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error(`content/notes/${file}: missing front matter`);
  const meta = Object.fromEntries(
    match[1].split("\n").map(line => {
      const [, key, value] = line.match(/^(\w+):\s*(.*)$/) ?? [];
      if (!key) throw new Error(`content/notes/${file}: bad front matter line "${line}"`);
      return [key, value.trim()];
    }),
  );
  for (const key of ["title", "description", "date"]) {
    if (!meta[key]) throw new Error(`content/notes/${file}: front matter needs "${key}"`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.date)) throw new Error(`content/notes/${file}: date must be YYYY-MM-DD`);
  return {
    slug: file.replace(/\.md$/, ""),
    title: meta.title,
    description: meta.description,
    date: meta.date,
    draft: meta.draft === "true",
    html: marked.parse(match[2], { async: false }),
  };
}

/** Every note, newest first. Drafts are left out unless `drafts` is set. */
export function readNotes({ drafts = false } = {}): Note[] {
  if (!existsSync(NOTES_DIR)) return [];
  return readdirSync(NOTES_DIR)
    .filter(file => file.endsWith(".md"))
    .map(readNote)
    .filter(note => drafts || !note.draft)
    .sort((a, b) => b.date.localeCompare(a.date));
}

const longDate = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

const draftBadge = (note: Note) => (note.draft ? html` <span class="pill mono">draft</span>` : false);

function notePage(note: Note): string {
  const path = `/notes/${note.slug}/`;
  return page({
    title: `${note.title} — Mark Eriksson`,
    description: note.description,
    path,
    ogType: "article",
    ogImage: "/img/og-image.png",
    script: "/scripts/page.ts",
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "BlogPosting",
          headline: note.title,
          description: note.description,
          datePublished: note.date,
          url: `${SITE}${path}`,
          author: PERSON,
        },
        breadcrumbs(["Notes", "/notes/"], [note.title, path]),
      ],
    },
    main: html`<main class="wrap">
      <article class="prose note">
        <a class="case-back mono" href="/notes/">${arrow("left")} ~/notes</a>
        <div class="section-title">
          <p class="eyebrow mono"><time datetime="${note.date}">${longDate(note.date)}</time>${draftBadge(note)}</p>
          <h1>${note.title}</h1>
        </div>
        ${raw(note.html)}
      </article>
    </main>`,
  });
}

function notesIndex(notes: Note[]): string {
  return page({
    title: "Notes — Mark Eriksson",
    description: "Notes from Mark Eriksson on building and running websites: problems solved and things learned.",
    path: "/notes/",
    ogType: "website",
    ogImage: "/img/og-image.png",
    script: "/scripts/page.ts",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Blog",
      name: "Notes — Mark Eriksson",
      url: `${SITE}/notes/`,
      author: PERSON,
    },
    main: html`<main class="wrap">
      <div class="prose">
        <div class="section-title">
          <p class="eyebrow mono">~/notes</p>
          <h1>Notes</h1>
        </div>
        <ol class="note-list">
          ${notes.map(
            note =>
              html`<li>
                <a href="/notes/${note.slug}/">${note.title}</a>${draftBadge(note)}
                <p>${note.description}</p>
                <time class="eyebrow mono" datetime="${note.date}">${longDate(note.date)}</time>
              </li>`,
          )}
        </ol>
      </div>
    </main>`,
  });
}

// ---------------------------------------------------------------------------

function write(pages: GeneratedPage[], path: string, file: string, content: string, sources: string[]) {
  mkdirSync(join(ROOT, file, ".."), { recursive: true });
  writeFileSync(join(ROOT, file), content);
  pages.push({ path, file, sources });
}

/** Rewrite every generated page. Drafts are included only when `drafts` is set (the dev server). */
export function generatePages({ drafts = false } = {}): GeneratedPage[] {
  for (const dir of GENERATED) rmSync(join(SRC, dir), { recursive: true, force: true });
  const pages: GeneratedPage[] = [];
  const shared = ["templates", "src/data/projects.ts"];

  PROJECTS.forEach((project, i) => {
    write(pages, `/projects/${project.id}/`, `src/projects/${project.id}/index.html`, projectPage(project, i), [
      ...shared,
      `src/assets/screenshots/${project.id}-desktop.webp`,
      `src/assets/screenshots/${project.id}-mobile.webp`,
    ]);
  });

  const notes = readNotes({ drafts });
  if (notes.length) {
    write(pages, "/notes/", "src/notes/index.html", notesIndex(notes), ["templates", "content/notes"]);
    for (const note of notes) {
      write(pages, `/notes/${note.slug}/`, `src/notes/${note.slug}/index.html`, notePage(note), [
        "templates",
        `content/notes/${note.slug}.md`,
      ]);
    }
  }
  return pages;
}
