import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "Cardápio temporariamente indisponível." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { data, error } = await supabase
    .from("estoque")
    .select("id,nome,descricao,categoria,preco,imagem_url,ordem_categoria")
    .eq("exibir_cardapio", true)
    .order("categoria", { ascending: true })
    .order("ordem_categoria", { ascending: true })
    .order("nome", { ascending: true });

  if (error) {
    console.error("Falha ao carregar cardápio público:", error.message);
    return NextResponse.json(
      { ok: false, error: "Não foi possível carregar o cardápio." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { ok: true, produtos: data || [] },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
