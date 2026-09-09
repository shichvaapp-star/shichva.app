import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "אתר כיתה — בן גוריון הרצליה",
    short_name: "אתר כיתה",
    description: "אתר כיתה — לוח מודעות, מערכת שעות, אירועים ומורים",
    start_url: "/",
    display: "standalone",
    background_color: "#0f172a",
    theme_color: "#0f172a",
    orientation: "portrait",
    dir: "rtl",
    lang: "he",
    icons: [
      {
        src: "/school-logo.png",
        sizes: "192x192 512x512",
        type: "image/png",
      },
    ],
  };
}
