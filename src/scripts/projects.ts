import { PROJECTS, siteHref } from "../data/projects.ts";
import { required } from "./dom.ts";
import {
  onThemeChange,
  showScreenshot,
  showSkeletonWhileLoading,
  showVideo,
  timeHoverScroll,
  type View,
} from "./screenshots.ts";

type ListedProject = (typeof PROJECTS)[number];

// Each project's favicon for its tab, saved by `npm run favicons`.
const FAVICONS = import.meta.glob<string>("../assets/favicons/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
});

const FILTERS = ["All", ...new Set(PROJECTS.map(project => project.cat))];

// How wide each screenshot is drawn (see .wrap, .explorer and .stage): the
// browser window is 97% of the section's width, which is 1152px on wide
// screens and the full width less the page gutters below that. The phone is
// 20% of it from 908px (an 860px section), and 25.5% (at least 96px) below.
const SIZES: Record<View, string> = {
  desktop: "(min-width: 1200px) 1117px, calc(97vw - 47px)",
  mobile: "(min-width: 1200px) 231px, (min-width: 908px) calc(20vw - 10px), max(96px, calc(25.5vw - 12px))",
};

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

// How long a project transition waits for its screenshots, in milliseconds.
const DECODE_WAIT = 400;

// Animate a DOM update as a view transition, typed so CSS can scope its
// animations with :active-view-transition-type(). Browsers without typed view
// transitions (or visitors who prefer reduced motion) just get the update.
function transition(update: () => void, ...types: string[]) {
  if (reducedMotion.matches || !("types" in (globalThis.ViewTransition?.prototype ?? {}))) {
    update();
    return;
  }
  document.startViewTransition({
    types: ["project", ...types],
    // Give new screenshots a moment to decode so they're in the "new"
    // snapshot, but don't hold the page frozen on a slow connection: if
    // they're still loading, the transition shows their skeletons instead.
    update: async () => {
      update();
      const decoded = Promise.all(
        [...document.querySelectorAll<HTMLImageElement>("[data-shot][srcset]")].map(img =>
          img.decode().catch(() => {}),
        ),
      );
      await Promise.race([decoded, new Promise(resolve => setTimeout(resolve, DECODE_WAIT))]);
    },
  });
}

// The project's details shown as JSON under its title, minus unfilled fields.
const metadata = (project: ListedProject) =>
  Object.fromEntries(
    Object.entries({
      role: project.role,
      year: project.year,
      retired: project.retired?.year,
      stack: project.stack,
    }).filter(([, value]) => value !== undefined),
  );

const token = (kind: string, text: string) =>
  Object.assign(document.createElement("span"), { className: `json-${kind}`, textContent: text });

// Pretty-print a flat object as syntax-highlighted JSON, with arrays on one line.
function renderJson(data: Record<string, unknown>): (Node | string)[] {
  const value = (v: unknown): (Node | string)[] =>
    Array.isArray(v)
      ? ["[", ...v.flatMap((item, i) => [...(i ? [", "] : []), ...value(item)]), "]"]
      : [token(typeof v === "string" ? "string" : "number", JSON.stringify(v))];

  const entries = Object.entries(data).flatMap(([key, v], i, all) => [
    "\n  ",
    token("key", JSON.stringify(key)),
    ": ",
    ...value(v),
    ...(i < all.length - 1 ? [","] : []),
  ]);
  return ["{", ...entries, "\n}"];
}

// Each project has its own link, #projects/<id>, kept in the address bar as
// the visitor browses so it can be copied and shared.
const HASH_PREFIX = "#projects/";

const linkedProject = () =>
  location.hash.startsWith(HASH_PREFIX)
    ? PROJECTS.find(project => project.id === decodeURIComponent(location.hash.slice(HASH_PREFIX.length)))
    : undefined;

export function initProjects(section: HTMLElement) {
  const $ = <T extends Element = HTMLElement>(selector: string) => required<T>(section, selector);
  const state = { filter: "All", index: 0 };

  // Show a linked project, switching back to "All" if the current filter hides it.
  const select = (project: ListedProject) => {
    if (!visible().includes(project)) state.filter = "All";
    state.index = visible().indexOf(project);
  };

  const visible = () => (state.filter === "All" ? PROJECTS : PROJECTS.filter(p => p.cat === state.filter));

  const filterButtons = FILTERS.map(filter => {
    const count = filter === "All" ? PROJECTS.length : PROJECTS.filter(p => p.cat === filter).length;
    const button = document.createElement("button");
    button.type = "button";
    button.append(`${filter} `, Object.assign(document.createElement("span"), { textContent: String(count) }));
    button.addEventListener("click", () => {
      if (filter === state.filter) return;
      transition(() => {
        state.filter = filter;
        state.index = 0;
        render();
      }, "filter");
    });
    $("[data-filters]").append(button);
    return [filter, button] as const;
  });

  // A tab for each project, in the browser window's tab strip. They're only
  // rebuilt when the filter changes: switching project just moves
  // aria-current (markTab), as Safari can leave freshly built tabs blank
  // through a view transition.
  let tabsFilter: string | undefined;

  function renderList(projects: ListedProject[]) {
    tabsFilter = state.filter;
    const rows = projects.map((project, i) => {
      const button = document.createElement("button");
      button.type = "button";
      button.title = project.name;
      button.classList.toggle("retired", Boolean(project.retired));
      // The site's favicon (or the one it shares), or its number if it hasn't got one.
      const favicon = FAVICONS[`../assets/favicons/${project.favicon ?? project.id}.webp`];
      const icon = favicon
        ? Object.assign(new Image(16, 16), { className: "favicon", src: favicon, alt: "", decoding: "async" })
        : Object.assign(document.createElement("span"), { className: "num", textContent: project.num });
      button.append(
        icon,
        Object.assign(document.createElement("span"), { className: "name", textContent: project.name }),
      );
      button.addEventListener("click", () => {
        if (i === state.index) return;
        transition(
          () => {
            state.index = i;
            render();
          },
          i > state.index ? "next" : "prev",
        );
      });

      const li = document.createElement("li");
      li.append(button);
      return li;
    });
    $("[data-list]").replaceChildren(...rows);
  }

  function markTab() {
    for (const [i, tab] of $("[data-list]").querySelectorAll("button").entries()) {
      if (i === state.index) tab.setAttribute("aria-current", "true");
      else tab.removeAttribute("aria-current");
    }
  }

  // If the current tab is out of view in the tab strip (after the pager or
  // arrow keys), scroll the strip to centre it. Only the strip scrolls, never
  // the page.
  function revealTab(behavior: ScrollBehavior) {
    const strip = $("[data-list]");
    const tab = $('[data-list] [aria-current="true"]');
    const left = tab.offsetLeft - strip.scrollLeft;
    if (left < 0 || left + tab.offsetWidth > strip.clientWidth) {
      strip.scrollTo({ left: tab.offsetLeft - (strip.clientWidth - tab.offsetWidth) / 2, behavior });
    }
    markOverflow();
  }

  // Mark which ends of the tab strip have tabs scrolled out of view, to fade them.
  function markOverflow() {
    const strip = $("[data-list]");
    const end = strip.scrollWidth - strip.clientWidth;
    strip.toggleAttribute("data-more-before", strip.scrollLeft > 1);
    strip.toggleAttribute("data-more-after", strip.scrollLeft < end - 1);
  }

  // The project's screenshots in the current theme, and its videos. Called
  // again when the theme changes, to swap between light and dark captures.
  function renderShots(project: ListedProject) {
    const shown = (["desktop", "mobile"] as const).map(view => {
      const img = $<HTMLImageElement>(`[data-shot="${view}"]`);
      img.alt = `${project.name} ${view === "desktop" ? "homepage" : "on mobile"}, full page`;
      showVideo(img.parentElement!, project.id, view);
      return showScreenshot(img, project.id, view);
    });
    $("[data-stage]").classList.toggle("has-shots", shown.every(Boolean));
  }

  function renderCurrent(project: ListedProject, total: number) {
    $("[data-url]").textContent = `https://${project.url}`;
    $("[data-num]").textContent = project.num;
    $("[data-cat]").textContent = project.cat;
    $("[data-name]").textContent = project.name;
    $("[data-json]").replaceChildren(...renderJson(metadata(project)));
    $("[data-retired]").hidden = !project.retired;
    $("[data-retired]").textContent = project.retired ? "retired" : "";

    // Retired projects link to their archived copy, if they have one.
    const href = siteHref(project);
    const visit = $<HTMLAnchorElement>("[data-visit]");
    if (href) visit.href = href;
    else visit.removeAttribute("href");
    $("[data-visit]").hidden = !href;
    $("[data-visit-label]").textContent = project.retired ? "View archived copy" : "Visit site";
    $("[data-position]").textContent = `${state.index + 1} / ${total}`;
    const details = $<HTMLAnchorElement>("[data-details]");
    details.href = `/projects/${project.id}/`;
    details.setAttribute("aria-label", `${project.name} details`);

    renderShots(project);

    $('[data-optional="summary"]').hidden = !project.summary;
    $("[data-summary]").textContent = project.summary ?? "";
  }

  // The first render isn't announced: it's the page loading, not a change.
  let announce = false;

  // syncHash is false only for the first render of an unlinked visit, so
  // opening the page at / doesn't rewrite the address to the first project.
  function render(syncHash = true) {
    const projects = visible();
    for (const [filter, button] of filterButtons) {
      button.setAttribute("aria-pressed", String(filter === state.filter));
    }
    $("[data-count]").textContent = `showing ${projects.length} of ${PROJECTS.length}`;
    if (state.filter !== tabsFilter) renderList(projects);
    markTab();
    // Keep keyboard focus in the tab strip on the new current tab.
    if ($("[data-list]").contains(document.activeElement))
      $('[data-list] [aria-current="true"]').focus({ preventScroll: true });
    renderCurrent(projects[state.index], projects.length);
    revealTab(announce && !reducedMotion.matches ? "smooth" : "instant");
    if (announce) {
      $("[data-announce]").textContent = `${projects[state.index].name}, ${state.index + 1} of ${projects.length}`;
    }
    announce = true;

    // replaceState rather than a hash assignment, so browsing doesn't fill the
    // history or jump the page to the section.
    const hash = HASH_PREFIX + encodeURIComponent(projects[state.index].id);
    if (syncHash && location.hash !== hash) history.replaceState(history.state, "", hash);
  }

  const step = (delta: number) => {
    const total = visible().length;
    transition(
      () => {
        state.index = (state.index + delta + total) % total;
        render();
      },
      delta > 0 ? "next" : "prev",
    );
  };
  for (const [view, sizes] of Object.entries(SIZES)) {
    const img = $<HTMLImageElement>(`[data-shot="${view}"]`);
    img.sizes = sizes;
    showSkeletonWhileLoading(img);
  }
  for (const frame of section.querySelectorAll<HTMLElement>(".browser, .phone")) timeHoverScroll(frame);
  onThemeChange(() => renderShots(visible()[state.index]));

  const strip = $("[data-list]");
  strip.addEventListener("scroll", markOverflow, { passive: true });
  new ResizeObserver(markOverflow).observe(strip);
  // A mouse wheel scrolls the tab strip sideways, as long as there's further
  // to go: at either end, it scrolls the page as usual.
  strip.addEventListener(
    "wheel",
    event => {
      if (event.ctrlKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      const end = strip.scrollWidth - strip.clientWidth;
      if ((event.deltaY < 0 && strip.scrollLeft <= 0) || (event.deltaY > 0 && strip.scrollLeft >= end - 1)) return;
      event.preventDefault();
      strip.scrollLeft += event.deltaY;
    },
    { passive: false },
  );

  $("[data-prev]").addEventListener("click", () => step(-1));
  $("[data-next]").addEventListener("click", () => step(1));

  // Left/right arrows step through projects from anywhere in the explorer.
  // In the tab strip, focus follows the selection.
  $(".explorer").addEventListener("keydown", event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    step(delta);
  });

  // There's no element with a project link's id, so the browser won't scroll
  // to it: bring the section into view instead.
  const reveal = () => section.scrollIntoView({ behavior: reducedMotion.matches ? "instant" : "smooth" });

  // Following a project link, or editing the hash by hand, selects that project.
  addEventListener("hashchange", () => {
    const project = linkedProject();
    if (!project) return;
    reveal();
    if (project === visible()[state.index]) return;
    transition(() => {
      select(project);
      render();
    });
  });

  const linked = linkedProject();
  if (linked) select(linked);
  render(Boolean(linked));
  if (linked) reveal();
}
