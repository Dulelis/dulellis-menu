import type { Metadata } from "next";
import PreorderCompletionClient from "./PreorderCompletionClient";

export const metadata: Metadata = {
  title: "Confirmar retirada da encomenda",
};

type PageProps = {
  searchParams: Promise<{ pedido?: string; token?: string }>;
};

export default async function PreorderCompletionPage({ searchParams }: PageProps) {
  const params = await searchParams;
  return (
    <PreorderCompletionClient
      orderId={Number(params.pedido || 0)}
      token={String(params.token || "")}
    />
  );
}
