import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Camalote · Invertí una parte de cada cobro",
    short_name: "Camalote",
    description:
      "Cada vez que te llegan USDC, una parte compra acciones tokenizadas en Solana, sola. Desde 10 dólares, comisión nunca más de medio dólar.",
    start_url: "/app",
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
