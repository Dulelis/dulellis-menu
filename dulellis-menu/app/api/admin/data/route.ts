import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/admin-request";
import { getServiceSupabase } from "@/lib/server-supabase";

function tabelaAusente(error: { message?: string } | null) {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("does not exist") ||
    message.includes("could not find the table") ||
    message.includes("relation") && message.includes("does not exist")
  );
}

export async function GET(request: NextRequest) {
  const autorizado = await isAdminRequestAuthorized(request);
  if (!autorizado) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY ausente." }, { status: 500 });
  }

  const [resEst, resCli, resPed, resTaxas, resProm, resPropagandas, resHorario, resEntregadores, resEntregas] = await Promise.all([
    supabase.from("estoque").select("*").order("nome"),
    supabase.from("clientes").select("*").order("created_at", { ascending: false }),
    supabase.from("pedidos").select("*").order("created_at", { ascending: false }),
    supabase.from("taxas_entrega").select("*").order("taxa"),
    supabase.from("promocoes").select("*").order("created_at", { ascending: false }),
    supabase.from("propagandas").select("*").order("ordem").order("created_at", { ascending: false }),
    supabase
      .from("configuracoes_loja")
      .select("id,hora_abertura,hora_fechamento,ativo,dias_semana")
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase.from("entregadores").select("*").order("nome"),
    supabase.from("entregas").select("*").order("aceito_em", { ascending: false }),
  ]);

  const erro =
    resEst.error ||
    resCli.error ||
    resPed.error ||
    resTaxas.error ||
    resProm.error ||
    resPropagandas.error ||
    resHorario.error;

  const erroEntregadores = tabelaAusente(resEntregadores.error) ? null : resEntregadores.error;
  const erroEntregas = tabelaAusente(resEntregas.error) ? null : resEntregas.error;

  if (erro || erroEntregadores || erroEntregas) {
    return NextResponse.json(
      { ok: false, error: erro?.message || erroEntregadores?.message || erroEntregas?.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    data: {
      estoque: resEst.data || [],
      clientes: resCli.data || [],
      pedidos: resPed.data || [],
      taxas: resTaxas.data || [],
      promocoes: resProm.data || [],
      propagandas: resPropagandas.data || [],
      horario: resHorario.data || null,
      entregadores: resEntregadores.data || [],
      entregas: resEntregas.data || [],
    },
  });
}
