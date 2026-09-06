import type { Metadata } from "next";
import { Suspense } from "react";
import { Providers } from "@/components/providers";
import { PayApp } from "@/components/pay/pay-app";

export const metadata: Metadata = {
  title: "Pagar",
  description:
    "Pagá con tu email desde Coinbase o Base. Los USDC llegan a Solana en menos de un minuto.",
};

export default function PayPage() {
  return (
    <Providers>
      <Suspense fallback={null}>
        <PayApp />
      </Suspense>
    </Providers>
  );
}
