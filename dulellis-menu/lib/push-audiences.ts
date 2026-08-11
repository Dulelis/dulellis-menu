import { getServiceSupabase } from "@/lib/server-supabase";
import { processPushCampaignBatch } from "@/lib/push-campaigns";

export type PushAudience = "all" | "birthday";

type ActiveSubscription = {
  id: number;
  cliente_id: number;
};

type CampaignInput = {
  title: string;
  message: string;
  url: string;
  audience: PushAudience;
  source?: "manual" | "automatic";
  automationKey?: string;
};

function saoPauloDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || "";
  const year = value("year");
  const month = value("month");
  const day = value("day");
  return { isoDate: `${year}-${month}-${day}`, monthDay: `${month}-${day}` };
}

function birthdayMonthDay(value: unknown) {
  const date = String(value || "").trim().slice(0, 10);
  const iso = date.match(/^\d{4}-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}`;
  const br = date.match(/^(\d{2})\/(\d{2})\/\d{4}$/);
  return br ? `${br[2]}-${br[1]}` : "";
}

export function cleanPushUrl(value: unknown) {
  const url = String(value || "/").trim();
  return url.startsWith("/") && !url.startsWith("//") ? url.slice(0, 500) : "/";
}

export async function getPushAudienceSubscriptions(audience: PushAudience) {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Supabase não configurado.");

  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("id,cliente_id")
    .eq("ativo", true);
  if (error) throw new Error(error.message);

  const subscriptions = (data || []) as ActiveSubscription[];
  if (audience === "all" || !subscriptions.length) return subscriptions;

  const customerIds = [...new Set(subscriptions.map((item) => item.cliente_id))];
  const { data: customers, error: customersError } = await supabase
    .from("clientes")
    .select("id,data_aniversario")
    .in("id", customerIds);
  if (customersError) throw new Error(customersError.message);

  const today = saoPauloDateParts().monthDay;
  const birthdayCustomerIds = new Set(
    (customers || [])
      .filter((customer) => birthdayMonthDay(customer.data_aniversario) === today)
      .map((customer) => Number(customer.id)),
  );
  return subscriptions.filter((subscription) => birthdayCustomerIds.has(subscription.cliente_id));
}

export async function createPushCampaign(input: CampaignInput) {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Supabase não configurado.");

  const subscriptions = await getPushAudienceSubscriptions(input.audience);
  if (!subscriptions.length) {
    throw new Error(
      input.audience === "birthday"
        ? "Nenhum aniversariante de hoje autorizou as notificações."
        : "Nenhum cliente ativou as notificações ainda.",
    );
  }

  const { data: campaign, error: campaignError } = await supabase
    .from("push_campaigns")
    .insert({
      titulo: input.title,
      mensagem: input.message,
      url: cleanPushUrl(input.url),
      publico: input.audience,
      origem: input.source || "manual",
      chave_automacao: input.automationKey || null,
      status: "queued",
      total_destinatarios: subscriptions.length,
    })
    .select("id")
    .single();
  if (campaignError || !campaign) {
    throw new Error(campaignError?.message || "Falha ao criar campanha.");
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
    throw new Error(deliveriesError.message);
  }

  return processPushCampaignBatch(Number(campaign.id));
}

export async function processCampaignUntilFinished(campaignId: number, initialRemaining: number) {
  let result = { campaignId, sent: 0, failed: 0, remaining: initialRemaining, status: "queued" };
  let attempts = 0;
  while (result.remaining > 0 && attempts < 40) {
    attempts += 1;
    result = await processPushCampaignBatch(campaignId);
  }
  return result;
}

export async function runBirthdayPushAutomation() {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Supabase não configurado.");

  const { data: settings, error } = await supabase
    .from("push_birthday_automation")
    .select("ativo,titulo,mensagem,url")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!settings?.ativo) return { skipped: true, reason: "disabled" };

  const automationKey = `birthday:${saoPauloDateParts().isoDate}`;
  const { data: existing, error: existingError } = await supabase
    .from("push_campaigns")
    .select("id,status")
    .eq("chave_automacao", automationKey)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing) return { skipped: true, reason: "already-processed", campaignId: existing.id };

  let result;
  try {
    result = await createPushCampaign({
      title: String(settings.titulo),
      message: String(settings.mensagem),
      url: String(settings.url || "/"),
      audience: "birthday",
      source: "automatic",
      automationKey,
    });
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "Falha na automação de aniversário.";
    if (message.includes("Nenhum aniversariante")) return { skipped: true, reason: "no-recipients" };
    throw reason;
  }

  const finalResult = await processCampaignUntilFinished(result.campaignId, result.remaining);
  return { skipped: false, ...finalResult };
}
