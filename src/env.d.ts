/// <reference types="astro/client" />

interface ImportMetaEnv {
  /** The site's address, from .env.development (dev) or .env.production (build). */
  readonly VITE_SITE_URL: string;
}
