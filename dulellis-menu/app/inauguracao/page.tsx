import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://dulelisdelivery.com.br";
const imagePath = "/divulgacao/inauguracao-dulelis.png";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Inauguração Dulelis Delivery",
  description:
    "Clientes especiais: inauguração do Dulelis Delivery em 8 de setembro de 2026, a partir das 13h.",
  alternates: { canonical: "/inauguracao" },
  openGraph: {
    title: "Inauguração Dulelis Delivery",
    description: "Você é nosso convidado especial. Confira a programação e participe!",
    url: "/inauguracao",
    siteName: "Dulelis Confeitaria",
    locale: "pt_BR",
    type: "website",
    images: [
      {
        url: imagePath,
        width: 2000,
        height: 1414,
        alt: "Convite para a inauguração do Dulelis Delivery",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Inauguração Dulelis Delivery",
    description: "Você é nosso convidado especial. Confira a programação e participe!",
    images: [imagePath],
  },
};

export default function InauguracaoPage() {
  return (
    <main className="min-h-screen bg-black">
      <Link href="/" aria-label="Acessar o Dulelis Delivery" className="block">
        <Image
          src={imagePath}
          alt="Convite para a inauguração do Dulelis Delivery"
          width={2000}
          height={1414}
          priority
          className="h-auto w-full"
        />
      </Link>
    </main>
  );
}
