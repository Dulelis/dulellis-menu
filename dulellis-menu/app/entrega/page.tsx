import EntregaPageClient from "./EntregaPageClient";

type PageProps = {
  searchParams: Promise<{
    pedido?: string;
  }>;
};

export default async function EntregaPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const pedidoId = Number(params.pedido || 0);
  return <EntregaPageClient pedidoId={pedidoId} />;
}
