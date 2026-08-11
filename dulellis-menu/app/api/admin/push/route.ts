import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/admin-request";
import {
  cleanPushUrl,
  createPushCampaign,
  getPushAudienceSubscriptions,
  type PushAudience,
} from "@/lib/push-audiences";
import { processPushCampaignBatch } from "@/lib/push-campaigns";
import { enforceSameOriginForWrite } from "@/lib/request-security";
import { getServiceSupabase } from "@/lib/server-supabase";
import { isWebPushConfigured } from "@/lib/web-push";

async function authorize(request: NextRequest) {
  return isAdminRequestAuthorized(request);
}

export async function GET(request: NextRequest) {
  if (!(await authorize(request))) return NextResponse.json({ ok: false }, { status: 401 });
  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ ok: false, error: "Supabase não configurado." }, { status: 500 });

  try {
    const [allSubscriptions, birthdaySubscriptions, campaigns, birthdayAutomation] = await Promise.all([
      getPushAudienceSubscriptions("all"),
      getPushAudienceSubscriptions("birthday"),
      supabase
        .from("push_campaigns")
        .select("id,titulo,mensagem,url,publico,origem,status,total_destinatarios,total_enviados,total_falhas,created_at,concluido_em")
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("push_birthday_automation")
        .select("ativo,titulo,mensagem,url,updated_at")
        .eq("id", 1)
        .maybeSingle(),
    ]);
    const error = campaigns.error || birthdayAutomation.error;
    if (error) throw new Error(error.message);
    return NextResponse.json({
      ok: true,
      configured: isWebPushConfigured(),
      activeSubscriptions: allSubscriptions.length,
      audiences: { all: allSubscriptions.length, birthday: birthdaySubscriptions.length },
      birthdayAutomation: birthdayAutomation.data,
      campaigns: campaigns.data || [],
    });
  } catch (reason) {
    const error = reason instanceof Error ? reason.message : "Falha ao carregar notificações.";
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await authorize(request))) return NextResponse.json({ ok: false }, { status: 401 });
  const originError = enforceSameOriginForWrite(request);
  if (originError) return originError;

  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    title?: string;
    message?: string;
    url?: string;
    campaignId?: number;
    audience?: PushAudience;
    enabled?: boolean;
  };
  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ ok: false, error: "Supabase não configurado." }, { status: 500 });

  if (body.action === "process") {
    const campaignId = Number(body.campaignId || 0);
    if (!Number.isInteger(campaignId) || campaignId <= 0) {
      return NextResponse.json({ ok: false, error: "Campanha inválida." }, { status: 400 });
    }
    const result = await processPushCampaignBatch(campaignId);
    return NextResponse.json({ ok: true, result });
  }

  const title = String(body.title || "").trim().slice(0, 80);
  const message = String(body.message || "").trim().slice(0, 500);
  if (title.length < 3 || message.length < 3) {
    return NextResponse.json({ ok: false, error: "Informe título e mensagem." }, { status: 400 });
  }

  if (body.action === "saveBirthdayAutomation") {
    const { data, error } = await supabase
      .from("push_birthday_automation")
      .update({
        ativo: Boolean(body.enabled),
        titulo: title,
        mensagem: message,
        url: cleanPushUrl(body.url),
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1)
      .select("ativo,titulo,mensagem,url,updated_at")
      .single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, birthdayAutomation: data });
  }

  if (!isWebPushConfigured()) {
    return NextResponse.json({ ok: false, error: "Configure as chaves VAPID antes de enviar." }, { status: 503 });
  }

  const audience: PushAudience = body.audience === "birthday" ? "birthday" : "all";
  try {
    const result = await createPushCampaign({
      title,
      message,
      url: cleanPushUrl(body.url),
      audience,
      source: "manual",
    });
    return NextResponse.json({ ok: true, result });
  } catch (reason) {
    const error = reason instanceof Error ? reason.message : "Falha ao criar campanha.";
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await authorize(request))) return NextResponse.json({ ok: false }, { status: 401 });
  const originError = enforceSameOriginForWrite(request);
  if (originError) return originError;

  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ ok: false, error: "Supabase não configurado." }, { status: 500 });

  const { data, error } = await supabase
    .from("push_campaigns")
    .delete()
    .gte("id", 1)
    .select("id");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, removed: data?.length || 0 });
}
