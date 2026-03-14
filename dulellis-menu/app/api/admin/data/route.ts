import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/admin-request";
import { getServiceSupabase } from "@/lib/server-supabase";

export async function GET(request: NextRequest) {
  const autorizado = await isAdminRequestAuthorized(request);
  if (!autorizado) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY ausente." }, { status: 500 });
  }

  const [resEst, resCli, resPed, resTaxas, resProm, resPropagandas, resHorario] = await Promise.all([
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
  ]);

  const erro =
    resEst.error ||
    resCli.error ||
    resPed.error ||
    resTaxas.error ||
    resProm.error ||
    resPropagandas.error ||
    resHorario.error;

  if (erro) {
    return NextResponse.json({ ok: false, error: erro.message }, { status: 500 });
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
    },
  });
}
