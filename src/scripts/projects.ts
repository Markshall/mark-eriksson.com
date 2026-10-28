import { PROJECTS } from "../data/projects.js";

const FILTERS = ["All", "Energy", "Sustainability", "Careers", "Other", "Own product"];

export function initProjects(section) {
  const $ = (selector) => section.querySelector(selector);
  const state = { filter: "All", index: 0 };

  const visible = () => (state.filter === "All" ? PROJECTS : PROJECTS.filter((p) => p.cat === state.filter));

  const filterButtons = FILTERS.map((filter) => {
    const count = filter === "All" ? PROJECTS.length : PROJECTS.filter((p) => p.cat === filter).length;
    const button = document.createElement("button");
    button.type = "button";
    button.append(`${filter} `, Object.assign(document.createElement("span"), { textContent: count }));
    button.addEventListener("click", () => {
      state.filter = filter;
      state.index = 0;
      render();
    });
    $("[data-filters]").append(button);
    return [filter, button];
  });

  function renderList(projects) {
    const rows = projects.map((project, i) => {
      const button = document.createElement("button");
      button.type = "button";
      button.innerHTML = '<span class="num"></span><span class="name"></span><span class="arrow" aria-hidden="true"></span>';
      button.querySelector(".num").textContent = project.num;
      button.querySelector(".name").textContent = project.name;
      if (i === state.index) button.setAttribute("aria-current", "true");
      button.addEventListener("click", () => {
        state.index = i;
        render();
      });

      const li = document.createElement("li");
      li.append(button);
      return li;
    });
    $("[data-list]").replaceChildren(...rows);
  }

  function renderCurrent(project, total) {
    $("[data-url]").textContent = `https://${project.url}`;
    $("[data-num]").textContent = project.num;
    $("[data-cat]").textContent = project.cat;
    $("[data-name]").textContent = project.name;
    $("[data-role]").textContent = project.role;
    $("[data-href]").href = `https://${project.url}/`;
    $("[data-position]").textContent = `${state.index + 1} / ${total}`;

    for (const key of ["stack", "summary"]) {
      $(`[data-optional="${key}"]`).hidden = !project[key];
      $(`[data-${key}]`).textContent = project[key] ?? "";
    }
  }

  function render() {
    const projects = visible();
    for (const [filter, button] of filterButtons) {
      button.setAttribute("aria-pressed", String(filter === state.filter));
    }
    $("[data-count]").textContent = `showing ${projects.length} of ${PROJECTS.length}`;
    renderList(projects);
    renderCurrent(projects[state.index], projects.length);
  }

  const step = (delta) => {
    const total = visible().length;
    state.index = (state.index + delta + total) % total;
    render();
  };
  $("[data-prev]").addEventListener("click", () => step(-1));
  $("[data-next]").addEventListener("click", () => step(1));

  render();
}
