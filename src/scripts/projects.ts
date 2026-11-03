import { countLabel, FILTERS, filtered, positionLabel, projectDetails } from "../data/gallery.ts";
import { PROJECTS } from "../data/projects.ts";
import { required } from "./dom.ts";
import {
  onThemeChange,
  scrollPreview,
  showScreenshot,
  showSkeletonWhileLoading,
  showVideo,
  type View,
} from "./screenshots.ts";

type ListedProject = (typeof PROJECTS)[number];

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

// How far, in pixels, a mouse press moves before it drags the tab strip.
const DRAG_THRESHOLD = 5;

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

const token = (kind: string, text: string) =>
  Object.assign(document.createElement("span"), { className: `json-${kind}`, textContent: text });

// Each project has its own link, #projects/<id>, kept in the address bar as
// the visitor browses so it can be copied and shared.
const HASH_PREFIX = "#projects/";

const linkedProject = () =>
  location.hash.startsWith(HASH_PREFIX)
    ? PROJECTS.find(project => project.id === decodeURIComponent(location.hash.slice(HASH_PREFIX.length)))
    : undefined;

// The gallery's markup, showing the first project, is rendered at build time
// (src/components/ProjectGallery.astro). This keeps its filter buttons and
// tabs, and updates the rest as the visitor browses.
export function initProjects(section: HTMLElement) {
  const $ = <T extends Element = HTMLElement>(selector: string) => required<T>(section, selector);
  const state = { filter: "All", index: 0 };

  // Show a linked project, switching back to "All" if the current filter hides it.
  const select = (project: ListedProject) => {
    if (!visible().includes(project)) state.filter = "All";
    state.index = visible().indexOf(project);
  };

  const visible = () => filtered(state.filter);

  const filterButtons = FILTERS.map(filter => {
    const button = $<HTMLButtonElement>(`[data-filter="${CSS.escape(filter)}"]`);
    button.addEventListener("click", () => {
      if (filter === state.filter) return;
      transition(() => {
        state.filter = filter;
        state.index = 0;
        render();
      }, "filter");
    });
    return [filter, button] as const;
  });

  // A tab for each project, in the browser window's tab strip, each in an
  // <li data-project>. The tab strip is only refilled when the filter changes:
  // switching project just moves aria-current (markTab), as Safari can leave
  // freshly inserted tabs blank through a view transition. The page starts
  // with every project's tab, for the "All" filter.
  const tabs = new Map([...$("[data-list]").children].map(li => [(li as HTMLElement).dataset.project, li]));
  let tabsFilter = "All";

  function renderList(projects: ListedProject[]) {
    tabsFilter = state.filter;
    $("[data-list]").replaceChildren(...projects.map(project => tabs.get(project.id)!));
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
    const { alt } = projectDetails(project);
    const shown = (["desktop", "mobile"] as const).map(view => {
      const img = $<HTMLImageElement>(`[data-shot="${view}"]`);
      img.alt = alt[view];
      showVideo(img.parentElement!, project.id, view);
      return showScreenshot(img, project.id, view);
    });
    $("[data-stage]").classList.toggle("has-shots", shown.every(Boolean));
  }

  // The same fields as ProjectGallery.astro renders at build time.
  function renderCurrent(project: ListedProject, total: number) {
    const details = projectDetails(project);
    $("[data-url]").textContent = details.url;
    $("[data-num]").textContent = project.num;
    $("[data-cat]").textContent = project.cat;
    $("[data-name]").textContent = project.name;
    $("[data-json]").replaceChildren(...details.json.map(part => (typeof part === "string" ? part : token(...part))));
    $("[data-retired]").hidden = !project.retired;
    $("[data-retired]").textContent = project.retired ? "retired" : "";

    const visit = $<HTMLAnchorElement>("[data-visit]");
    if (details.href) visit.href = details.href;
    else visit.removeAttribute("href");
    visit.hidden = !details.href;
    $("[data-visit-label]").textContent = details.visitLabel;
    $("[data-position]").textContent = positionLabel(state.index, total);
    const link = $<HTMLAnchorElement>("[data-details]");
    link.href = details.detailsHref;
    link.setAttribute("aria-label", details.detailsLabel);

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
    $("[data-count]").textContent = countLabel(projects.length);
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
  for (const frame of section.querySelectorAll<HTMLElement>(".browser, .phone")) scrollPreview(frame);
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

  // Clicking a tab shows its project.
  strip.addEventListener("click", event => {
    const tab = (event.target as Element).closest("button");
    if (!tab) return;
    const i = [...strip.querySelectorAll("button")].indexOf(tab);
    if (i === state.index) return;
    transition(
      () => {
        state.index = i;
        render();
      },
      i > state.index ? "next" : "prev",
    );
  });

  // Dragging with a mouse scrolls the tab strip too, for mice without a
  // sideways wheel. Touch screens already swipe it natively. A press only
  // becomes a drag once it's moved a few pixels, so a click still picks a tab,
  // and a drag doesn't pick the tab it started on.
  let drag: { x: number; left: number; moved: boolean } | undefined;
  let dragged = false;
  strip.addEventListener("pointerdown", event => {
    dragged = false;
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    drag = { x: event.clientX, left: strip.scrollLeft, moved: false };
  });
  strip.addEventListener("pointermove", event => {
    if (!drag) return;
    const dx = event.clientX - drag.x;
    if (!drag.moved) {
      if (Math.abs(dx) < DRAG_THRESHOLD) return;
      drag.moved = true;
      strip.setPointerCapture(event.pointerId);
      strip.classList.add("dragging");
    }
    strip.scrollLeft = drag.left - dx;
  });
  const endDrag = () => {
    dragged = Boolean(drag?.moved);
    drag = undefined;
    strip.classList.remove("dragging");
  };
  strip.addEventListener("pointerup", endDrag);
  strip.addEventListener("pointercancel", endDrag);
  strip.addEventListener(
    "click",
    event => {
      if (!dragged) return;
      dragged = false;
      event.stopPropagation();
    },
    { capture: true },
  );
  // Stop the browser dragging a favicon away instead.
  strip.addEventListener("dragstart", event => event.preventDefault());

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
