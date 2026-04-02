import type { Metadata, Viewport } from "next";
import { AdminPwaRegistration } from "@/components/AdminPwaRegistration";

export const metadata: Metadata = {
  title: {
    default: "Dulelis Admin",
    template: "%s | Dulelis Admin",
  },
  description: "Painel administrativo da Dulelis Delivery em formato de app para uso no celular.",
  applicationName: "Dulelis Admin",
  manifest: "/admin/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/admin-icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/admin-icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/admin-apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    title: "Dulelis Admin",
    statusBarStyle: "black-translucent",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-title": "Admin Dulelis",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f172a",
  colorScheme: "light",
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <AdminPwaRegistration />
      {children}
    </>
  );
}
