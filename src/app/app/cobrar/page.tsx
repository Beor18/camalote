import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { BridgeApp } from "@/components/bridge/app";

export const metadata: Metadata = {
  title: "Cobrá en dólares",
};

export default function CobrarPage() {
  return (
    <Providers>
      <BridgeApp view="cobros" />
    </Providers>
  );
}
