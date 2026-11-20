import { NextRequest, NextResponse } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/admin-request";
import { getServiceSupabase } from "@/lib/server-supabase";
import { enforceSameOriginForWrite } from "@/lib/request-security";
import { NATURAL_STORE_CONFIG_ID } from "@/lib/natural-store";

export async function GET(request: NextRequest) {
  if (!await isAdminRequestAuthorized(request)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const db = getServiceSupabase();
  if (!db) return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  const { data, error } = await db.from("configuracoes_loja").select("hora_abertura,hora_fechamento,dias_semana,ativo").eq("id", NATURAL_STORE_CONFIG_ID).maybeSingle();
  if (error) return NextResponse.json({ error: "Não foi possível carregar o horário." }, { status: 500 });
  return NextResponse.json({ horario: data }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!await isAdminRequestAuthorized(request)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const originError = enforceSameOriginForWrite(request);
  if (originError) return originError;
  const body = await request.json().catch(() => null);
  const validTime = (value: unknown) => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  const days = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
  if (!body || !validTime(body.hora_abertura) || !validTime(body.hora_fechamento) || body.hora_abertura === body.hora_fechamento || typeof body.ativo !== "boolean" || !Array.isArray(body.dias_semana) || !body.dias_semana.length || !body.dias_semana.every((day: unknown) => typeof day === "string" && days.includes(day))) {
    return NextResponse.json({ error: "Informe horários diferentes de abertura e fechamento e selecione os dias de funcionamento." }, { status: 400 });
  }
  const db = getServiceSupabase();
  if (!db) return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  const { error } = await db.from("configuracoes_loja").upsert({ id: NATURAL_STORE_CONFIG_ID, hora_abertura: body.hora_abertura, hora_fechamento: body.hora_fechamento, dias_semana: [...new Set(body.dias_semana)], ativo: body.ativo });
  return error ? NextResponse.json({ error: "Não foi possível salvar o horário." }, { status: 500 }) : NextResponse.json({ ok: true });
}
