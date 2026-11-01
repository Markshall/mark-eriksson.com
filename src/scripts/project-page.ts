// Entry script for the project pages (/projects/<id>/, scripts/pages.ts): the
// shared page behaviour, plus the screenshots. Each <img data-shot> names its
// project and view; its srcset comes from the same resized files as the
// homepage gallery.
import "./page.ts";
import { screenshotSrcset, showSkeletonWhileLoading, timeHoverScroll, type View } from "./screenshots.ts";

for (const img of document.querySelectorAll<HTMLImageElement>("img[data-shot][data-project]")) {
  const srcset = screenshotSrcset(img.dataset.project!, img.dataset.shot as View);
  if (!srcset) continue;
  showSkeletonWhileLoading(img);
  img.srcset = srcset;
  img.parentElement?.toggleAttribute("data-loading", !img.complete);
}

for (const frame of document.querySelectorAll<HTMLElement>(".browser, .phone")) timeHoverScroll(frame);
