import type { Metadata, Viewport } from "next";
import { Caveat, Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { RegisterServiceWorker } from "@/components/register-sw";
import { LanguageProvider } from "@/lib/i18n";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

// Solo para la carta de despedida de la landing.
const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Camalote · Invertí una parte de cada cobro",
    template: "%s · Camalote",
  },
  description:
    "Elegís un porcentaje y una acción. Cada vez que te llegan USDC a tu cuenta de Solana, esa parte compra acciones tokenizadas, sola. Desde 10 dólares, sin broker, con la comisión a la vista.",
  applicationName: "Camalote",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Camalote",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf8" },
    { media: "(prefers-color-scheme: dark)", color: "#12100e" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} ${caveat.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LanguageProvider>{children}</LanguageProvider>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
