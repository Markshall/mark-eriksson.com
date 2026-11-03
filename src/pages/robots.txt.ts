import type { APIRoute } from "astro";
import { SITE } from "../lib/site.ts";

export const GET: APIRoute = () =>
  new Response(`User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`, {
    headers: { "Content-Type": "text/plain" },
  });
