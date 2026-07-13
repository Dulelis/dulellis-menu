import type { Metadata } from "next";
import { AdminPreordersClient } from "./AdminPreordersClient";

export const metadata: Metadata = { title: "Agenda de encomendas" };

export default function AdminPreordersPage() {
  return <AdminPreordersClient />;
}
