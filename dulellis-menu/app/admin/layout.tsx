import type { Metadata, Viewport } from "next";
import { AdminShortcutCleanup } from "@/components/AdminShortcutCleanup";

export const metadata: Metadata = {
  title: {
    default: "Dulelis Admin",
    template: "%s | Dulelis Admin",
  },
  description: "Painel administrativo da Dulelis Delivery para gerenciar pedidos e produtos.",
  applicationName: null,
  manifest: null,
  icons: null,
  appleWebApp: null,
  other: {
    "mobile-web-app-capable": "no",
    "apple-mobile-web-app-title": "Dulelis Admin",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#8a4b1d",
  colorScheme: "light",
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <AdminShortcutCleanup />
      {children}
    </>
  );
}
