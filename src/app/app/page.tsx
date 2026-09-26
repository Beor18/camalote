import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { BridgeApp } from "@/components/bridge/app";

export const metadata: Metadata = {
  title: "Invest part of every payment",
};

export default function AppPage() {
  return (
    <Providers>
      <BridgeApp view="invest" />
    </Providers>
  );
}
