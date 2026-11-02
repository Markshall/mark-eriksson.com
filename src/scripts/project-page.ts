// Entry script for the project pages (/projects/<id>/, scripts/pages.ts): the
// shared page behaviour, plus the screenshots. Each <img data-shot> names its
// project and view; its srcset comes from the same resized files as the
// homepage gallery, in the page's current theme. Projects with a video play
// it over the screenshot.
import "./page.ts";
import {
  onThemeChange,
  scrollPreview,
  showScreenshot,
  showSkeletonWhileLoading,
  showVideo,
  type View,
} from "./screenshots.ts";

const shots = document.querySelectorAll<HTMLImageElement>("img[data-shot][data-project]");
const showShots = () => {
  for (const img of shots) {
    showScreenshot(img, img.dataset.project!, img.dataset.shot as View);
    showVideo(img.parentElement!, img.dataset.project!, img.dataset.shot as View);
  }
};

for (const img of shots) showSkeletonWhileLoading(img);
showShots();
onThemeChange(showShots);

for (const frame of document.querySelectorAll<HTMLElement>(".browser, .phone")) scrollPreview(frame);
