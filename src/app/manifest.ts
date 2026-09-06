import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Camalote · Cobrá en dólares",
    short_name: "Camalote",
    description:
      "Tu link para cobrar en USDC: te pagan desde Coinbase o Base y te llega a Solana. Nunca más de medio dólar por cobro.",
    start_url: "/app/cobrar",
    display: "standalone",
    background_color: "#fbfaf8",
    theme_color: "#7c3aed",
    lang: "es",
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
