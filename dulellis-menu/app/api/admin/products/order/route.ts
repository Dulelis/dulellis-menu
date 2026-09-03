import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/admin-request";
import { enforceSameOriginForWrite } from "@/lib/request-security";
import { getServiceSupabase } from "@/lib/server-supabase";

export async function POST(request: NextRequest) {
  if (!(await isAdminRequestAuthorized(request))) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }
  const originError = enforceSameOriginForWrite(request);
  if (originError) return originError;

  const body = (await request.json().catch(() => ({}))) as {
    productId?: number;
    direction?: number;
  };
  const productId = Number(body.productId);
  const direction = Number(body.direction);
  if (!Number.isInteger(productId) || productId <= 0 || ![-1, 1].includes(direction)) {
    return NextResponse.json({ ok: false, error: "Movimento inválido." }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase não configurado." }, { status: 503 });
  }

  const { error } = await supabase.rpc("admin_mover_produto_categoria", {
    p_produto_id: productId,
    p_direcao: direction,
  });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
