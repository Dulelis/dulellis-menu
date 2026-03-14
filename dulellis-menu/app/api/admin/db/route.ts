import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/admin-request";
import { getServiceSupabase } from "@/lib/server-supabase";

const TABELAS_PERMITIDAS = new Set([
  "estoque",
  "taxas_entrega",
  "promocoes",
  "propagandas",
  "configuracoes_loja",
  "pedidos",
  "clientes",
]);

type AdminDbBody = {
  action?: "insert" | "update_eq" | "delete_eq" | "delete_in";
  table?: string;
  payload?: Record<string, unknown>;
  values?: Array<Record<string, unknown>>;
  eq?: { column: string; value: string | number | boolean | null };
  in?: { column: string; values: Array<string | number | boolean | null> };
};

export async function POST(request: NextRequest) {
  const autorizado = await isAdminRequestAuthorized(request);
  if (!autorizado) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY ausente." }, { status: 500 });
  }

  const body = (await request.json().catch(() => ({}))) as AdminDbBody;
  const action = body.action;
  const table = String(body.table || "");

  if (!action || !table || !TABELAS_PERMITIDAS.has(table)) {
    return NextResponse.json({ ok: false, error: "Operação inválida." }, { status: 400 });
  }

  try {
    if (action === "insert") {
      const values = Array.isArray(body.values) ? body.values : [];
      if (!values.length) {
        return NextResponse.json({ ok: false, error: "values obrigatorio." }, { status: 400 });
      }
      const { data, error } = await supabase.from(table).insert(values).select("*");
      if (error) throw error;
      return NextResponse.json({ ok: true, data: data || [] });
    }

    if (action === "update_eq") {
      if (!body.payload || !body.eq?.column) {
        return NextResponse.json({ ok: false, error: "payload/eq obrigatorios." }, { status: 400 });
      }
      const { data, error } = await supabase
        .from(table)
        .update(body.payload)
        .eq(body.eq.column, body.eq.value)
        .select("*");
      if (error) throw error;
      return NextResponse.json({ ok: true, data: data || [] });
    }

    if (action === "delete_eq") {
      if (!body.eq?.column) {
        return NextResponse.json({ ok: false, error: "eq obrigatorio." }, { status: 400 });
      }
      const { data, error } = await supabase
        .from(table)
        .delete()
        .eq(body.eq.column, body.eq.value)
        .select("id");
      if (error) throw error;
      return NextResponse.json({ ok: true, data: data || [] });
    }

    if (action === "delete_in") {
      if (!body.in?.column || !Array.isArray(body.in.values) || body.in.values.length === 0) {
        return NextResponse.json({ ok: false, error: "in obrigatorio." }, { status: 400 });
      }
      const { data, error } = await supabase
        .from(table)
        .delete()
        .in(body.in.column, body.in.values)
        .select("id");
      if (error) throw error;
      return NextResponse.json({ ok: true, data: data || [] });
    }

    return NextResponse.json({ ok: false, error: "Ação não suportada." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha na operacao.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
