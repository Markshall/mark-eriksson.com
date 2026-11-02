// Entry script for the project pages (/projects/<id>/, scripts/pages.ts): the
// shared page behaviour, plus the screenshots. Each <img data-shot> names its
// project and view; its srcset comes from the same resized files as the
// homepage gallery, in the page's current theme.
import "./page.ts";
import { onThemeChange, showScreenshot, showSkeletonWhileLoading, timeHoverScroll, type View } from "./screenshots.ts";

const shots = document.querySelectorAll<HTMLImageElement>("img[data-shot][data-project]");
const showShots = () => {
  for (const img of shots) showScreenshot(img, img.dataset.project!, img.dataset.shot as View);
};

for (const img of shots) showSkeletonWhileLoading(img);
showShots();
onThemeChange(showShots);

for (const frame of document.querySelectorAll<HTMLElement>(".browser, .phone")) timeHoverScroll(frame);
