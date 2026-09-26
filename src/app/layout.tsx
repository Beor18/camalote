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
    default: "Camalote · Invest part of every payment",
    template: "%s · Camalote",
  },
  description:
    "Pick a percentage and a stock. Every time USDC land in your Solana account, that part buys tokenized stocks, on its own. From 10 dollars, no broker, with the fee in plain sight.",
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
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} ${caveat.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LanguageProvider>{children}</LanguageProvider>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
