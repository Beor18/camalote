import { redirect } from "next/navigation";

/** Invertir es la app entera: la ruta vieja lleva a /app. */
export default function InvertirPage() {
  redirect("/app");
}
