import type { NextConfig } from "next";

/**
 * GitHub Pages build: the workflow sets PAGES_BASE_PATH (e.g. "/the-butler") so the site works
 * from https://<user>.github.io/<repo>/. Locally nothing is set, so dev and `next start` behave
 * as before. The app runs entirely in the browser, so a static export loses nothing.
 */
const pagesBasePath = process.env.PAGES_BASE_PATH;

const nextConfig: NextConfig = {
  ...(pagesBasePath ? { output: "export" as const, basePath: pagesBasePath, trailingSlash: true } : {}),
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
