import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dawah Norge – Oppfølging",
    short_name: "Dawah Norge",
    description: "Intern registrering og oppfølging i Dawah Norge.",
    start_url: "/",
    display: "standalone",
    background_color: "#f2f6f4",
    theme_color: "#143f37",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
