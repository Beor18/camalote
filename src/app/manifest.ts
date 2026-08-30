import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Camalote · Traé tus USDC a Solana",
    short_name: "Camalote",
    description:
      "Traé tus USDC de Base a Solana con tu mail y nada más. Nunca más de medio dólar por cruce.",
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
