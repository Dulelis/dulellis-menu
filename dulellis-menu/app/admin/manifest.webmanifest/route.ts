import { NextResponse } from "next/server";

export function GET() {
  return new NextResponse(
    JSON.stringify({
      error: "Admin PWA desativada. Use o atalho do navegador para abrir o painel.",
    }),
    {
      status: 410,
      headers: {
        "Content-Type": "application/manifest+json",
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
