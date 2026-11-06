import type { MetadataRoute } from "next";

// Needed for the static GitHub Pages export.
export const dynamic = "force-static";

/** Install manifest: the icon Android and other browsers use for "Add to home screen". */
export default function manifest(): MetadataRoute.Manifest {
  const base = process.env.PAGES_BASE_PATH ?? "";
  return {
    name: "The Butler",
    short_name: "Butler",
    description: "Your personal command center",
    start_url: `${base}/`,
    display: "standalone",
    background_color: "#111111",
    theme_color: "#101727",
    icons: [
      { src: `${base}/icons/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${base}/icons/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
