import { NextRequest, NextResponse } from "next/server";

function lerCredenciaisBasicas(authHeader: string | null) {
  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return null;
  }

  try {
    const encoded = authHeader.slice(6).trim();
    const decoded = Buffer.from(encoded, "base64").toString("utf-8");
    const separador = decoded.indexOf(":");
    if (separador < 0) return null;

    const username = decoded.slice(0, separador);
    const password = decoded.slice(separador + 1);
    return { username, password };
  } catch {
    return null;
  }
}

async function lerBodySeguro(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return await req.json();
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const form = await req.formData();
    return Object.fromEntries(form.entries());
  }

  const text = await req.text();
  return { raw: text };
}

export async function POST(req: NextRequest) {
  const expectedUser = process.env.PAGBANK_WEBHOOK_USERNAME;
  const expectedPass = process.env.PAGBANK_WEBHOOK_PASSWORD;

  if (!expectedUser || !expectedPass) {
    return NextResponse.json(
      { error: "Webhook do PagBank nao configurado no servidor." },
      { status: 500 },
    );
  }

  const creds = lerCredenciaisBasicas(req.headers.get("authorization"));
  if (!creds || creds.username !== expectedUser || creds.password !== expectedPass) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  const body = await lerBodySeguro(req);

  // Mantem o webhook compatível com o PagBank e disponível para evolução de regras.
  console.log("Webhook PagBank recebido:", {
    at: new Date().toISOString(),
    body,
  });

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "pagbank-webhook",
    time: new Date().toISOString(),
  });
}
