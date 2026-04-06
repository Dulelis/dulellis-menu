import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/admin-request";
import { getServiceSupabase } from "@/lib/server-supabase";

export async function GET(request: NextRequest) {
  const autorizado = await isAdminRequestAuthorized(request);
  if (!autorizado) {
    return NextResponse.json({ ok: false, error: "Nao autorizado." }, { status: 401 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY ausente." }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("pedidos")
    .select("id,created_at,status_pedido,forma_pagamento,status_pagamento,observacao,pagamento_id,pagamento_atualizado_em")
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, pedidos: data || [] });
}
