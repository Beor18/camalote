import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { BridgeApp } from "@/components/bridge/app";

export const metadata: Metadata = {
  title: "Cruzá a Solana",
};

export default function AppPage() {
  return (
    <Providers>
      <BridgeApp />
    </Providers>
  );
}
