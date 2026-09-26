import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Camalote · Invest part of every payment",
    short_name: "Camalote",
    description:
      "Every time USDC land, a part buys tokenized stocks on Solana, on its own. From 10 dollars, the fee is never more than half a dollar.",
    start_url: "/app",
    display: "standalone",
    background_color: "#fbfaf8",
    theme_color: "#7c3aed",
    lang: "en",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
