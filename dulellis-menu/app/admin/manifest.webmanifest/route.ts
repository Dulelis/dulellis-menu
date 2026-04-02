import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    {
      id: "/admin/",
      name: "Dulelis Admin",
      short_name: "Admin",
      description: "Painel administrativo da Dulelis Delivery para instalar no celular.",
      start_url: "/admin/login?next=/admin&source=pwa",
      scope: "/admin/",
      display: "standalone",
      orientation: "portrait",
      background_color: "#020617",
      theme_color: "#0f172a",
      lang: "pt-BR",
      categories: ["business", "productivity", "food"],
      icons: [
        {
          src: "/admin-icon-192.png",
          sizes: "192x192",
          type: "image/png",
        },
        {
          src: "/admin-icon-512.png",
          sizes: "512x512",
          type: "image/png",
        },
        {
          src: "/admin-icon-512-maskable.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
    },
    {
      headers: {
        "Content-Type": "application/manifest+json",
      },
    },
  );
}
