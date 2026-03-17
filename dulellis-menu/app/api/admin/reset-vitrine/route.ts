import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/admin-request";
import { getServiceSupabase } from "@/lib/server-supabase";

export async function POST(request: NextRequest) {
  const autorizado = await isAdminRequestAuthorized(request);
  if (!autorizado) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY ausente." }, { status: 500 });
  }

  try {
    const [resTokens, resPedidos, resClientes] = await Promise.all([
      supabase.from("clientes_password_reset_tokens").delete().not("id", "is", null),
      supabase.from("pedidos").delete().not("id", "is", null),
      supabase.from("clientes").delete().not("id", "is", null),
    ]);

    const erro = resTokens.error || resPedidos.error || resClientes.error;
    if (erro) {
      throw erro;
    }

    return NextResponse.json({
      ok: true,
      message: "Dados públicos da vitrine removidos com sucesso.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao resetar dados da vitrine.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
