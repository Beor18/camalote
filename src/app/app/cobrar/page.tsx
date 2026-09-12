import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Providers } from "@/components/providers";
import { BridgeApp } from "@/components/bridge/app";
import { SHOW_HIDDEN_VIEWS } from "@/lib/config";

export const metadata: Metadata = {
  title: "Cobrá en dólares",
};

/** Cobrar con links quedó oculto: solo vuelve con NEXT_PUBLIC_SHOW_HIDDEN_VIEWS=true. */
export default function CobrarPage() {
  if (!SHOW_HIDDEN_VIEWS) redirect("/app");
  return (
    <Providers>
      <BridgeApp view="cobros" />
    </Providers>
  );
}
