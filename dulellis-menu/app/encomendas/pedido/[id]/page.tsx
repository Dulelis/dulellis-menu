import type { Metadata } from "next";
import { PreorderTrackingClient } from "./PreorderTrackingClient";

export const metadata: Metadata = { title: "Acompanhar encomenda" };

export default async function PreorderTrackingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PreorderTrackingClient orderId={Number(id)} />;
}
