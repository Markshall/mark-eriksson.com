type Theme = "light" | "dark";

const STORAGE_KEY = "theme";
const systemDark = matchMedia("(prefers-color-scheme: dark)");

function apply(button: HTMLButtonElement, theme: Theme) {
  const dark = theme === "dark";
  document.documentElement.dataset.theme = theme;
  button.setAttribute("aria-pressed", String(dark));
  button.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
}

function stored(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

export function initTheme(button: HTMLButtonElement) {
  apply(button, stored() ?? (systemDark.matches ? "dark" : "light"));

  button.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    apply(button, next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  });

  // Follow the system setting until the visitor picks a theme themselves.
  systemDark.addEventListener("change", event => {
    if (!stored()) apply(button, event.matches ? "dark" : "light");
  });
}
