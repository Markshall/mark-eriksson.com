// Google Tag Manager, and so every tag it runs, only loads after the visitor
// accepts cookies (UK GDPR / PECR). Consent Mode is set to denied before
// anything else, so if consent is later withdrawn the tags stop too.
const GTM_ID = "GTM-PV3S2MV";
const STORAGE_KEY = "consent";

type Choice = "granted" | "denied";

declare global {
  interface Window {
    dataLayer: unknown[];
  }
}

window.dataLayer ??= [];

// Google's tags expect gtag() to push its `arguments` object, not an array.
function gtag(..._args: unknown[]) {
  window.dataLayer.push(arguments);
}

const signals = (choice: Choice) => ({
  ad_storage: choice,
  ad_user_data: choice,
  ad_personalization: choice,
  analytics_storage: choice,
});

gtag("consent", "default", signals("denied"));

let loaded = false;
function loadGtm() {
  if (loaded) return;
  loaded = true;
  window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
  document.head.append(script);
}

// Remove Google's analytics and ads cookies when consent is withdrawn. They
// can be set on the host or on the root domain, so try both.
function clearCookies() {
  const root = location.hostname.replace(/^www\./, "");
  for (const name of document.cookie.split(";").map(cookie => cookie.split("=")[0].trim())) {
    if (!/^(_ga|_gid|_gat|_gcl)/.test(name)) continue;
    for (const domain of ["", `; domain=${location.hostname}`, `; domain=.${root}`]) {
      document.cookie = `${name}=; max-age=0; path=/${domain}`;
    }
  }
}

function stored(): Choice | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

function apply(choice: Choice) {
  gtag("consent", "update", signals(choice));
  if (choice === "granted") loadGtm();
  else clearCookies();
}

// The banner markup. Its styles, and why both buttons look the same, are in src/styles/consent.css.
const BANNER = `
  <p class="consent-title" id="consent-h">Cookies</p>
  <p>
    Can I use analytics cookies to see how people find this site? Nothing is set unless you accept.
    <a href="/privacy/">Privacy and cookies</a>
  </p>
  <div class="consent-actions">
    <button type="button" class="btn btn-outline" data-consent="denied">Reject</button>
    <button type="button" class="btn btn-outline" data-consent="granted">Accept</button>
  </div>
`;

// Shows the banner until the visitor chooses. `opener` (the footer's "cookie
// settings" button) reopens it to change the choice.
export function initConsent(opener: HTMLElement) {
  const banner = Object.assign(document.createElement("section"), { className: "consent", innerHTML: BANNER });
  banner.setAttribute("aria-labelledby", "consent-h");
  document.body.append(banner);

  const choice = stored();
  banner.hidden = choice !== null;
  if (choice) apply(choice);

  for (const button of banner.querySelectorAll<HTMLButtonElement>("[data-consent]")) {
    button.addEventListener("click", () => {
      const choice: Choice = button.dataset.consent === "granted" ? "granted" : "denied";
      try {
        localStorage.setItem(STORAGE_KEY, choice);
      } catch {}
      apply(choice);
      banner.hidden = true;
    });
  }

  opener.addEventListener("click", () => {
    banner.hidden = false;
    banner.querySelector<HTMLButtonElement>("[data-consent]")?.focus();
  });
}
