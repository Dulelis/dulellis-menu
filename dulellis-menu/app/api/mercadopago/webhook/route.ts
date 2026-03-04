import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const key = serviceRole || anon;
  if (!supabaseUrl || !key) return null;
  return createClient(supabaseUrl, key);
}

export async function POST(request: Request) {
  try {
    const tokenEsperado = process.env.MERCADOPAGO_WEBHOOK_TOKEN;
    if (tokenEsperado) {
      const tokenRecebido = new URL(request.url).searchParams.get("token");
      if (!tokenRecebido || tokenRecebido !== tokenEsperado) {
        return NextResponse.json({ ok: false, error: "token webhook invalido" }, { status: 401 });
      }
    }

    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) {
      return NextResponse.json({ ok: false, error: "token ausente" }, { status: 500 });
    }

    const url = new URL(request.url);
    const body = (await request.json().catch(() => ({}))) as {
      type?: string;
      action?: string;
      data?: { id?: string | number };
      id?: string | number;
      topic?: string;
    };

    const tipo = String(body.type || body.topic || url.searchParams.get("topic") || "");
    const idBruto =
      body?.data?.id ||
      body?.id ||
      url.searchParams.get("id") ||
      url.searchParams.get("data.id") ||
      "";
    const paymentId = String(idBruto || "");

    if (!paymentId || (!tipo.includes("payment") && tipo !== "")) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const payment = await mpRes.json();
    if (!mpRes.ok) {
      return NextResponse.json({ ok: false, error: payment?.message || "erro mp" }, { status: mpRes.status });
    }

    const referencia = String(payment?.external_reference || "");
    const status = String(payment?.status || "");
    const total = Number(payment?.transaction_amount || 0);
    const metadata = (payment?.metadata || {}) as { whatsapp?: string; pedido_id?: number | string };
    const whatsapp = String(metadata.whatsapp || "");
    const pedidoIdMetadata = Number(metadata.pedido_id || 0);

    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({ ok: true, warning: "supabase ausente" });
    }

    const payloadStatus = {
      status_pagamento: status,
      pagamento_id: paymentId,
      pagamento_atualizado_em: new Date().toISOString(),
    };

    let atualizado = false;

    if (pedidoIdMetadata > 0) {
      const { data, error } = await supabase
        .from("pedidos")
        .update(payloadStatus)
        .eq("id", pedidoIdMetadata)
        .select("id");
      if (!error && (data?.length || 0) > 0) atualizado = true;
    }

    if (referencia) {
      const { data, error } = await supabase
        .from("pedidos")
        .update(payloadStatus)
        .eq("pagamento_referencia", referencia)
        .select("id");
      if (!error && (data?.length || 0) > 0) atualizado = true;
    }

    if (!atualizado && whatsapp && total > 0) {
      const { data: candidatos, error: erroBusca } = await supabase
        .from("pedidos")
        .select("id, total, whatsapp, created_at")
        .eq("whatsapp", whatsapp)
        .order("created_at", { ascending: false })
        .limit(10);

      if (!erroBusca) {
        const match = (candidatos || []).find(
          (p: { id?: number | string; total?: number | string | null }) =>
            Math.abs(Number(p.total || 0) - total) < 0.01
        );
        if (match?.id) {
          const { error: erroUpdate } = await supabase
            .from("pedidos")
            .update(payloadStatus)
            .eq("id", match.id);
          if (!erroUpdate) atualizado = true;
        }
      }
    }

    return NextResponse.json({ ok: true, atualizado, paymentId, status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}
