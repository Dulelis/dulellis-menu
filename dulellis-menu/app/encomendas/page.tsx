import type { Metadata } from "next";
import { PreordersPageClient } from "./PreordersPageClient";

export const metadata: Metadata = {
  title: "Encomendas",
  description: "Agende bolos, doces, salgados e produtos personalizados na Dulelis.",
};

export default function PreordersPage() {
  return <PreordersPageClient />;
}
