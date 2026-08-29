import type { NextConfig } from "next";

/**
 * Headers de seguridad (checklist de producción de Privy):
 * - frame-ancestors 'none' + X-Frame-Options DENY: nadie puede embeber
 *   a Camalote en un iframe (anti-clickjacking).
 * - frame-src: los únicos iframes que Camalote puede abrir son los de la
 *   billetera embebida de Privy y el captcha de Cloudflare.
 * Solo definimos esas directivas: el resto de la CSP queda por defecto
 * para no romper scripts/estilos propios.
 */
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value:
      "frame-ancestors 'none'; frame-src https://auth.privy.io https://challenges.cloudflare.com;",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
