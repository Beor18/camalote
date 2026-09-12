import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Providers } from "@/components/providers";
import { PayApp } from "@/components/pay/pay-app";
import { SHOW_HIDDEN_VIEWS } from "@/lib/config";

export const metadata: Metadata = {
  title: "Pagar",
  description:
    "Pagá con tu email desde Coinbase o Base. Los USDC llegan a Solana en menos de un minuto.",
};

/** Los links de cobro quedaron ocultos: solo vuelven con NEXT_PUBLIC_SHOW_HIDDEN_VIEWS=true. */
export default function PayPage() {
  if (!SHOW_HIDDEN_VIEWS) redirect("/");
  return (
    <Providers>
      <Suspense fallback={null}>
        <PayApp />
      </Suspense>
    </Providers>
  );
}
