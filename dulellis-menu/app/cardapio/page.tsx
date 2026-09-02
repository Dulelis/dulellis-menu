import type { Metadata } from "next";
import { Lato, Playfair_Display } from "next/font/google";
import { CardapioClient } from "./CardapioClient";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-cardapio-titulo",
  display: "swap",
});

const lato = Lato({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--font-cardapio-texto",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://dulelisdelivery.com.br";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Cardápio de encomendas",
  description:
    "Cardápio de bolos, doces, salgados e pratos por encomenda da Dulelis Confeitaria.",
  alternates: { canonical: "/cardapio" },
  openGraph: {
    title: "Dulelis Confeitaria — Cardápio",
    description: "Confira nosso cardápio de encomendas e fale conosco pelo WhatsApp.",
    url: new URL("/cardapio", siteUrl).toString(),
    siteName: "Dulelis Confeitaria",
    locale: "pt_BR",
    type: "website",
    images: [{ url: "/logo.png", alt: "Dulelis Confeitaria" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Dulelis Confeitaria — Cardápio",
    description: "Confira nosso cardápio de encomendas.",
    images: ["/logo.png"],
  },
};

export default function CardapioPage() {
  return (
    <div className={`${playfair.variable} ${lato.variable}`}>
      <CardapioClient />
    </div>
  );
}
