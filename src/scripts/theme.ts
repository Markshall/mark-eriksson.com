const STORAGE_KEY = "theme";
const systemDark = matchMedia("(prefers-color-scheme: dark)");

function apply(button, theme) {
  const dark = theme === "dark";
  document.documentElement.dataset.theme = theme;
  button.setAttribute("aria-pressed", String(dark));
  button.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
}

function stored() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function initTheme(button) {
  apply(button, stored() ?? (systemDark.matches ? "dark" : "light"));

  button.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    apply(button, next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  });

  // Follow the system setting until the visitor picks a theme themselves.
  systemDark.addEventListener("change", (event) => {
    if (!stored()) apply(button, event.matches ? "dark" : "light");
  });
}
