import type { Metadata } from "next";
import { PreorderReceiptClient } from "./PreorderReceiptClient";

export const metadata: Metadata = { title: "Recibo de pagamento | Dulelis" };

export default async function PreorderReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PreorderReceiptClient orderId={Number(id)} />;
}
