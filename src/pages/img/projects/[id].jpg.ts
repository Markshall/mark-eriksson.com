// Each project's link preview image (/img/projects/<id>.jpg): a 1200×630 crop
// of the top of its desktop screenshot.
import type { APIRoute, GetStaticPaths } from "astro";
import sharp from "sharp";
import { PROJECTS } from "../../../data/projects.ts";
import { hasScreenshots, screenshotFile } from "../../../lib/site.ts";

export const getStaticPaths = (() =>
  PROJECTS.filter(project => hasScreenshots(project.id)).map(project => ({
    params: { id: project.id },
  }))) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ params }) => {
  // Desktop screenshots are 1440px wide, so this is the same shape as 1200×630.
  const top = await sharp(screenshotFile(params.id!, "desktop"))
    .extract({ left: 0, top: 0, width: 1440, height: 756 })
    .toBuffer();
  const image = await sharp(top).resize(1200, 630).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(image), { headers: { "Content-Type": "image/jpeg" } });
};
