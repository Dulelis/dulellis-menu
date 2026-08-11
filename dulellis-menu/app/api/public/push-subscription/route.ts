import { NextResponse, type NextRequest } from "next/server";
import { getCustomerSessionFromRequest } from "@/lib/customer-request";
import { getServiceSupabase } from "@/lib/server-supabase";
import { enforceSameOriginForWrite } from "@/lib/request-security";
import { getWebPushPublicKey, isWebPushConfigured } from "@/lib/web-push";

type SubscriptionBody = {
  endpoint?: string;
  expirationTime?: number | null;
  keys?: { p256dh?: string; auth?: string };
};

function validSubscription(body: SubscriptionBody) {
  const endpoint = String(body.endpoint || "").trim();
  const p256dh = String(body.keys?.p256dh || "").trim();
  const auth = String(body.keys?.auth || "").trim();
  return endpoint.startsWith("https://") && endpoint.length <= 2048 && p256dh.length >= 20 && auth.length >= 8;
}

export async function GET(request: NextRequest) {
  const session = getCustomerSessionFromRequest(request);
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  const publicKey = getWebPushPublicKey();
  if (!publicKey || !isWebPushConfigured()) {
    return NextResponse.json({ ok: true, configured: false, subscribed: false, publicKey: "" });
  }

  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ ok: false, error: "Supabase não configurado." }, { status: 500 });

  const { count, error } = await supabase
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("cliente_id", Number(session.clienteId))
    .eq("ativo", true);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, configured: true, subscribed: Number(count || 0) > 0, publicKey });
}

export async function POST(request: NextRequest) {
  const session = getCustomerSessionFromRequest(request);
  if (!session) return NextResponse.json({ ok: false, error: "Login obrigatório." }, { status: 401 });
  const originError = enforceSameOriginForWrite(request);
  if (originError) return originError;
  if (!isWebPushConfigured()) {
    return NextResponse.json({ ok: false, error: "Web Push ainda não foi configurado." }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as SubscriptionBody;
  if (!validSubscription(body)) {
    return NextResponse.json({ ok: false, error: "Inscrição de notificação inválida." }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ ok: false, error: "Supabase não configurado." }, { status: 500 });
  const now = new Date().toISOString();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      cliente_id: Number(session.clienteId),
      endpoint: String(body.endpoint),
      p256dh: String(body.keys?.p256dh),
      auth: String(body.keys?.auth),
      expiration_time: body.expirationTime || null,
      user_agent: String(request.headers.get("user-agent") || "").slice(0, 500),
      ativo: true,
      consentido_em: now,
      cancelado_em: null,
      falhas_consecutivas: 0,
      updated_at: now,
    },
    { onConflict: "endpoint" },
  );
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  await supabase
    .from("clientes")
    .update({ push_marketing_consent: true, push_marketing_consent_at: now })
    .eq("id", Number(session.clienteId));
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const session = getCustomerSessionFromRequest(request);
  if (!session) return NextResponse.json({ ok: false, error: "Login obrigatório." }, { status: 401 });
  const originError = enforceSameOriginForWrite(request);
  if (originError) return originError;
  const body = (await request.json().catch(() => ({}))) as { endpoint?: string };

  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ ok: false, error: "Supabase não configurado." }, { status: 500 });
  const now = new Date().toISOString();
  let query = supabase
    .from("push_subscriptions")
    .update({ ativo: false, cancelado_em: now, updated_at: now })
    .eq("cliente_id", Number(session.clienteId));
  if (String(body.endpoint || "").startsWith("https://")) query = query.eq("endpoint", String(body.endpoint));
  const { error } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const { count } = await supabase
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("cliente_id", Number(session.clienteId))
    .eq("ativo", true);
  if (Number(count || 0) === 0) {
    await supabase
      .from("clientes")
      .update({ push_marketing_consent: false })
      .eq("id", Number(session.clienteId));
  }
  return NextResponse.json({ ok: true });
}
