import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { BridgeApp } from "@/components/bridge/app";

export const metadata: Metadata = {
  title: "Invertí una parte de cada cobro",
};

export default function InvertirPage() {
  return (
    <Providers>
      <BridgeApp view="invest" />
    </Providers>
  );
}
