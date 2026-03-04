import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";

type StockBody = {
  id?: number;
  delta?: number;
};

export async function POST(request: Request) {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY ausente." }, { status: 500 });
  }

  const body = (await request.json().catch(() => ({}))) as StockBody;
  const id = Number(body.id);
  const delta = Number(body.delta);
  if (!Number.isInteger(id) || !Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 50) {
    return NextResponse.json({ ok: false, error: "Parametros invalidos." }, { status: 400 });
  }

  const tentativasMaximas = 6;
  for (let tentativa = 0; tentativa < tentativasMaximas; tentativa += 1) {
    const { data: itemAtual, error: erroBusca } = await supabase
      .from("estoque")
      .select("id, quantidade")
      .eq("id", id)
      .maybeSingle();

    if (erroBusca) {
      return NextResponse.json({ ok: false, error: erroBusca.message }, { status: 500 });
    }
    if (!itemAtual) {
      return NextResponse.json({ ok: true, updated: false, reason: "not_found" });
    }

    const quantidadeAtualBruta = itemAtual.quantidade;
    const quantidadeAtual = Number(quantidadeAtualBruta ?? 0);
    if (!Number.isFinite(quantidadeAtual)) {
      return NextResponse.json({ ok: false, error: "Quantidade invalida no estoque." }, { status: 500 });
    }
    if (delta < 0 && quantidadeAtual < Math.abs(delta)) {
      return NextResponse.json({ ok: true, updated: false, reason: "insufficient" });
    }

    const novaQuantidade = quantidadeAtual + delta;
    const { data: atualizado, error: erroUpdate } = await supabase
      .from("estoque")
      .update({ quantidade: novaQuantidade })
      .eq("id", id)
      .eq("quantidade", quantidadeAtualBruta as string | number | null)
      .select("id")
      .maybeSingle();

    if (erroUpdate) {
      return NextResponse.json({ ok: false, error: erroUpdate.message }, { status: 500 });
    }
    if (atualizado) {
      return NextResponse.json({ ok: true, updated: true, quantidade: novaQuantidade });
    }
  }

  return NextResponse.json({ ok: true, updated: false, reason: "retry_limit" });
}
