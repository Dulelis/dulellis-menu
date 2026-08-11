import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/admin-request";
import { processPushCampaignBatch } from "@/lib/push-campaigns";
import { enforceSameOriginForWrite } from "@/lib/request-security";
import { getServiceSupabase } from "@/lib/server-supabase";
import { isWebPushConfigured } from "@/lib/web-push";

function cleanUrl(value: unknown) {
  const url = String(value || "/").trim();
  return url.startsWith("/") && !url.startsWith("//") ? url.slice(0, 500) : "/";
}

async function authorize(request: NextRequest) {
  return isAdminRequestAuthorized(request);
}

export async function GET(request: NextRequest) {
  if (!(await authorize(request))) return NextResponse.json({ ok: false }, { status: 401 });
  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ ok: false, error: "Supabase não configurado." }, { status: 500 });

  const [subscriptions, campaigns] = await Promise.all([
    supabase.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("ativo", true),
    supabase
      .from("push_campaigns")
      .select("id,titulo,mensagem,url,status,total_destinatarios,total_enviados,total_falhas,created_at,concluido_em")
      .order("created_at", { ascending: false })
      .limit(30),
  ]);
  const error = subscriptions.error || campaigns.error;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({
    ok: true,
    configured: isWebPushConfigured(),
    activeSubscriptions: Number(subscriptions.count || 0),
    campaigns: campaigns.data || [],
  });
}

export async function POST(request: NextRequest) {
  if (!(await authorize(request))) return NextResponse.json({ ok: false }, { status: 401 });
  const originError = enforceSameOriginForWrite(request);
  if (originError) return originError;
  if (!isWebPushConfigured()) {
    return NextResponse.json({ ok: false, error: "Configure as chaves VAPID antes de enviar." }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    title?: string;
    message?: string;
    url?: string;
    campaignId?: number;
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

  const { data: subscriptions, error: subscriptionsError } = await supabase
    .from("push_subscriptions")
    .select("id,cliente_id")
    .eq("ativo", true);
  if (subscriptionsError) return NextResponse.json({ ok: false, error: subscriptionsError.message }, { status: 500 });
  if (!subscriptions?.length) {
    return NextResponse.json({ ok: false, error: "Nenhum cliente ativou as notificações ainda." }, { status: 400 });
  }

  const { data: campaign, error: campaignError } = await supabase
    .from("push_campaigns")
    .insert({
      titulo: title,
      mensagem: message,
      url: cleanUrl(body.url),
      status: "queued",
      total_destinatarios: subscriptions.length,
    })
    .select("id")
    .single();
  if (campaignError || !campaign) {
    return NextResponse.json({ ok: false, error: campaignError?.message || "Falha ao criar campanha." }, { status: 500 });
  }

  const { error: deliveriesError } = await supabase.from("push_campaign_deliveries").insert(
    subscriptions.map((subscription) => ({
      campaign_id: campaign.id,
      subscription_id: subscription.id,
      cliente_id: subscription.cliente_id,
      status: "pending",
    })),
  );
  if (deliveriesError) {
    await supabase.from("push_campaigns").update({ status: "failed" }).eq("id", campaign.id);
    return NextResponse.json({ ok: false, error: deliveriesError.message }, { status: 500 });
  }

  const result = await processPushCampaignBatch(Number(campaign.id));
  return NextResponse.json({ ok: true, result });
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
