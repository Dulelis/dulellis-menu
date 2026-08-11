import { getServiceSupabase } from "@/lib/server-supabase";
import {
  getWebPushErrorMessage,
  getWebPushStatusCode,
  sendWebPushNotification,
} from "@/lib/web-push";

type DeliveryRow = {
  id: number;
  subscription_id: number;
  tentativas: number;
};

type SubscriptionRow = {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  ativo: boolean;
  falhas_consecutivas: number;
};

export async function processPushCampaignBatch(campaignId: number, batchSize = 50) {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Supabase não configurado.");

  const { data: campaign, error: campaignError } = await supabase
    .from("push_campaigns")
    .select("id,titulo,mensagem,url,status")
    .eq("id", campaignId)
    .maybeSingle();
  if (campaignError) throw new Error(campaignError.message);
  if (!campaign) throw new Error("Campanha não encontrada.");

  await supabase
    .from("push_campaigns")
    .update({ status: "sending", iniciado_em: new Date().toISOString() })
    .eq("id", campaignId)
    .in("status", ["queued", "partial", "failed"]);

  const { data: deliveries, error: deliveriesError } = await supabase
    .from("push_campaign_deliveries")
    .select("id,subscription_id,tentativas")
    .eq("campaign_id", campaignId)
    .eq("status", "pending")
    .order("id", { ascending: true })
    .limit(Math.max(1, Math.min(batchSize, 100)));
  if (deliveriesError) throw new Error(deliveriesError.message);

  const pending = (deliveries || []) as DeliveryRow[];
  const subscriptionIds = pending.map((item) => item.subscription_id);
  const subscriptionsById = new Map<number, SubscriptionRow>();

  if (subscriptionIds.length) {
    const { data: subscriptions, error: subscriptionsError } = await supabase
      .from("push_subscriptions")
      .select("id,endpoint,p256dh,auth,ativo,falhas_consecutivas")
      .in("id", subscriptionIds);
    if (subscriptionsError) throw new Error(subscriptionsError.message);
    for (const subscription of (subscriptions || []) as SubscriptionRow[]) {
      subscriptionsById.set(subscription.id, subscription);
    }
  }

  for (const delivery of pending) {
    const subscription = subscriptionsById.get(delivery.subscription_id);
    if (!subscription?.ativo) {
      await supabase
        .from("push_campaign_deliveries")
        .update({ status: "skipped", erro: "Inscrição inativa.", processado_em: new Date().toISOString() })
        .eq("id", delivery.id);
      continue;
    }

    try {
      await sendWebPushNotification(subscription, {
        title: String(campaign.titulo),
        body: String(campaign.mensagem),
        url: String(campaign.url || "/"),
        tag: `campanha-${campaignId}`,
        campaignId,
      });
      const now = new Date().toISOString();
      await Promise.all([
        supabase
          .from("push_campaign_deliveries")
          .update({ status: "sent", erro: null, tentativas: Number(delivery.tentativas || 0) + 1, processado_em: now })
          .eq("id", delivery.id),
        supabase
          .from("push_subscriptions")
          .update({ ultimo_sucesso_em: now, falhas_consecutivas: 0, updated_at: now })
          .eq("id", subscription.id),
      ]);
    } catch (error) {
      const statusCode = getWebPushStatusCode(error);
      const expired = statusCode === 404 || statusCode === 410;
      const attempts = Number(delivery.tentativas || 0) + 1;
      const retry = !expired && attempts < 3;
      const now = new Date().toISOString();
      await Promise.all([
        supabase
          .from("push_campaign_deliveries")
          .update({
            status: expired ? "expired" : retry ? "pending" : "failed",
            erro: getWebPushErrorMessage(error),
            tentativas: attempts,
            processado_em: now,
          })
          .eq("id", delivery.id),
        supabase
          .from("push_subscriptions")
          .update({
            ativo: expired ? false : true,
            cancelado_em: expired ? now : null,
            ultima_falha_em: now,
            falhas_consecutivas: Number(subscription.falhas_consecutivas || 0) + 1,
            updated_at: now,
          })
          .eq("id", subscription.id),
      ]);
    }
  }

  const { data: allDeliveries, error: countError } = await supabase
    .from("push_campaign_deliveries")
    .select("status")
    .eq("campaign_id", campaignId);
  if (countError) throw new Error(countError.message);

  const statuses = (allDeliveries || []) as Array<{ status: string }>;
  const sent = statuses.filter((item) => item.status === "sent").length;
  const failed = statuses.filter((item) => ["failed", "expired", "skipped"].includes(item.status)).length;
  const remaining = statuses.filter((item) => item.status === "pending").length;
  const finalStatus = remaining > 0 ? "partial" : failed > 0 && sent === 0 ? "failed" : "completed";

  await supabase
    .from("push_campaigns")
    .update({
      status: finalStatus,
      total_enviados: sent,
      total_falhas: failed,
      concluido_em: remaining === 0 ? new Date().toISOString() : null,
    })
    .eq("id", campaignId);

  return { campaignId, sent, failed, remaining, status: finalStatus };
}
