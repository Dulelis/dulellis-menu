import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getServiceSupabase } from "@/lib/server-supabase";

const VISITOR_COOKIE = "dulelis_storefront_visitor";
const SESSION_COOKIE = "dulelis_storefront_session";
const SESSION_SECONDS = 30 * 60;

function cookieId(value: string | undefined) {
  const normalized = String(value || "").trim();
  return /^[a-zA-Z0-9-]{16,80}$/.test(normalized) ? normalized : "";
}

function storefrontDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export async function POST(request: NextRequest) {
  const existingSession = cookieId(request.cookies.get(SESSION_COOKIE)?.value);
  if (existingSession) {
    return NextResponse.json({ ok: true, counted: false });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "Serviço de contagem indisponível." },
      { status: 503 },
    );
  }

  const visitorId =
    cookieId(request.cookies.get(VISITOR_COOKIE)?.value) || randomUUID();
  const actor = `storefront:${visitorId}`;
  const thirtyMinutesAgo = new Date(Date.now() - SESSION_SECONDS * 1000);
  const { data: recentView, error: recentError } = await supabase
    .from("admin_audit_logs")
    .select("id")
    .eq("actor", actor)
    .eq("action", "storefront_view")
    .gte("created_at", thirtyMinutesAgo.toISOString())
    .limit(1)
    .maybeSingle();

  if (recentError) {
    return NextResponse.json(
      { ok: false, error: "Não foi possível registrar a visualização." },
      { status: 500 },
    );
  }

  let counted = false;
  if (!recentView) {
    const { error } = await supabase.from("admin_audit_logs").insert({
      actor,
      action: "storefront_view",
      details: {
        page: "vitrine",
        local_date: storefrontDateKey(),
      },
    });
    if (error) {
      return NextResponse.json(
        { ok: false, error: "Não foi possível registrar a visualização." },
        { status: 500 },
      );
    }
    counted = true;
  }

  const response = NextResponse.json({ ok: true, counted });
  const secure = process.env.NODE_ENV === "production";
  response.cookies.set(VISITOR_COOKIE, visitorId, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  response.cookies.set(SESSION_COOKIE, randomUUID(), {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: SESSION_SECONDS,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
