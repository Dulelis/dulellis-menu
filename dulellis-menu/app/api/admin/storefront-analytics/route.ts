import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/admin-request";
import { getServiceSupabase } from "@/lib/server-supabase";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PAGE_SIZE = 1000;

function startOfSaoPauloDay(dateKey: string) {
  return new Date(`${dateKey}T03:00:00.000Z`);
}

function dayAfter(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  if (!(await isAdminRequestAuthorized(request))) {
    return NextResponse.json(
      { ok: false, error: "Não autorizado." },
      { status: 401 },
    );
  }

  const from = request.nextUrl.searchParams.get("from") || "";
  const to = request.nextUrl.searchParams.get("to") || "";
  if (!DATE_PATTERN.test(from) || !DATE_PATTERN.test(to) || from > to) {
    return NextResponse.json(
      { ok: false, error: "Período de visualizações inválido." },
      { status: 400 },
    );
  }

  const start = startOfSaoPauloDay(from);
  const end = startOfSaoPauloDay(dayAfter(to));
  if (
    !Number.isFinite(start.getTime()) ||
    !Number.isFinite(end.getTime()) ||
    end.getTime() - start.getTime() > 370 * 24 * 60 * 60 * 1000
  ) {
    return NextResponse.json(
      { ok: false, error: "O período máximo para visualizações é de 370 dias." },
      { status: 400 },
    );
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "Serviço de visualizações indisponível." },
      { status: 503 },
    );
  }

  const actors: string[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("admin_audit_logs")
      .select("actor")
      .eq("action", "storefront_view")
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString())
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      return NextResponse.json(
        { ok: false, error: "Não foi possível consultar as visualizações." },
        { status: 500 },
      );
    }

    const page = data || [];
    actors.push(...page.map((item) => String(item.actor || "")));
    if (page.length < PAGE_SIZE) break;
  }

  return NextResponse.json({
    ok: true,
    data: {
      views: actors.length,
      visitors: new Set(actors.filter(Boolean)).size,
    },
  });
}
