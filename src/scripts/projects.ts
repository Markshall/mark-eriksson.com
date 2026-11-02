import { PROJECTS, siteHref } from "../data/projects.ts";
import { required } from "./dom.ts";
import { onThemeChange, showScreenshot, showSkeletonWhileLoading, timeHoverScroll, type View } from "./screenshots.ts";

type ListedProject = (typeof PROJECTS)[number];

const FILTERS = ["All", ...new Set(PROJECTS.map(project => project.cat))];

// How wide each screenshot is drawn (see .wrap, .explorer and .stage): the
// browser is 97% of the project column and the phone 25.5% of it, at least
// 96px. The column is 780px wide on wide screens, sits beside the list down
// to 940px, then takes the full width less the page gutters.
const SIZES: Record<View, string> = {
  desktop: "(min-width: 1200px) 757px, (min-width: 940px) calc(97vw - 408px), calc(97vw - 47px)",
  mobile: "(min-width: 1200px) 199px, (min-width: 940px) calc(25.5vw - 107px), max(96px, calc(25.5vw - 12px))",
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

/** How much of the element is on screen, relative to as much of it as could fit. */
function visibleFraction(el: HTMLElement): number {
  const { top, bottom, height } = el.getBoundingClientRect();
  const visible = Math.min(bottom, innerHeight) - Math.max(top, 0);
  return Math.max(0, visible) / Math.min(height, innerHeight);
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

  const stacked = () => $(".project").offsetTop >= $("[data-list]").offsetTop + $("[data-list]").offsetHeight;

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

  function renderList(projects: ListedProject[]) {
    const rows = projects.map((project, i) => {
      const button = document.createElement("button");
      button.type = "button";
      button.innerHTML =
        '<span class="num"></span><span class="name"></span><span class="arrow arrow-icon" aria-hidden="true"></span>';
      required(button, ".num").textContent = project.num;
      required(button, ".name").textContent = project.name;
      if (i === state.index) button.setAttribute("aria-current", "true");
      button.addEventListener("click", () => {
        if (i === state.index) return;
        // When the list stacks above the project, the project may be off
        // screen: if it's mostly out of view, skip the unseen transition and
        // bring it into view instead. If it's mostly visible, leave the
        // scroll position alone and animate as usual.
        if (stacked() && visibleFraction($(".project")) < 0.5) {
          state.index = i;
          render();
          $(".project").scrollIntoView({ behavior: reducedMotion.matches ? "instant" : "smooth", block: "start" });
          return;
        }
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

  // The project's screenshots in the current theme. Called again when the
  // theme changes, to swap between light and dark captures.
  function renderShots(project: ListedProject) {
    const shown = (["desktop", "mobile"] as const).map(view => {
      const img = $<HTMLImageElement>(`[data-shot="${view}"]`);
      img.alt = `${project.name} ${view === "desktop" ? "homepage" : "on mobile"}, full page`;
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
    for (const link of [$<HTMLAnchorElement>("[data-href]"), $<HTMLAnchorElement>("[data-visit]")]) {
      if (href) link.href = href;
      else link.removeAttribute("href");
    }
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
    // The list is rebuilt, so keep keyboard focus on it by moving it to the
    // new current row.
    const listFocused = $("[data-list]").contains(document.activeElement);
    renderList(projects);
    if (listFocused) $('[data-list] [aria-current="true"]').focus({ preventScroll: true });
    renderCurrent(projects[state.index], projects.length);
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

  $("[data-prev]").addEventListener("click", () => step(-1));
  $("[data-next]").addEventListener("click", () => step(1));

  // Left/right arrows step through projects from anywhere in the explorer;
  // up/down do the same within the list, where focus follows the selection.
  $(".explorer").addEventListener("keydown", event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const inList = $("[data-list]").contains(event.target as Node);
    const delta =
      event.key === "ArrowRight" || (inList && event.key === "ArrowDown")
        ? 1
        : event.key === "ArrowLeft" || (inList && event.key === "ArrowUp")
          ? -1
          : 0;
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
