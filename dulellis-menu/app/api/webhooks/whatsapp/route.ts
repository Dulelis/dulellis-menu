import { NextResponse, type NextRequest } from "next/server";
import { DULELIS_WHATSAPP_NUMBER } from "@/lib/store-contact";
import { sendWhatsAppMenu, sendWhatsAppText, verifyWhatsAppSignature } from "@/lib/whatsapp-cloud";

export const runtime = "nodejs";

type IncomingMessage = {
  id?: string;
  from?: string;
  type?: string;
  text?: { body?: string };
  button?: { payload?: string; text?: string };
  interactive?: {
    button_reply?: { id?: string; title?: string };
    list_reply?: { id?: string; title?: string };
  };
};

type WebhookPayload = {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      field?: string;
      value?: { messages?: IncomingMessage[] };
    }>;
  }>;
};

const processedMessageIds = new Map<string, number>();

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

function messageCommand(message: IncomingMessage) {
  return normalize(
    message.interactive?.button_reply?.id ||
    message.interactive?.list_reply?.id ||
    message.button?.payload ||
    message.text?.body ||
    "",
  );
}

function siteUrl(request: NextRequest) {
  return String(process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || request.nextUrl.origin).replace(/\/+$/, "");
}

function isDuplicate(messageId: string) {
  const now = Date.now();
  for (const [id, timestamp] of processedMessageIds) {
    if (now - timestamp > 15 * 60_000) processedMessageIds.delete(id);
  }
  if (processedMessageIds.has(messageId)) return true;
  processedMessageIds.set(messageId, now);
  return false;
}

async function answerMessage(request: NextRequest, message: IncomingMessage) {
  const to = String(message.from || "").replace(/\D/g, "");
  const id = String(message.id || "");
  if (!to || !id || isDuplicate(id)) return;

  const command = messageCommand(message);
  const preordersUrl = `${siteUrl(request)}/encomendas`;

  if (command === "fazer_encomenda" || /(encomenda|encomendar|bolo|doce|salgado|cardapio|catalogo)/.test(command)) {
    await sendWhatsAppText(to, `Faça sua encomenda pelo catálogo da Dulelis:\n\n${preordersUrl}\n\nLá você escolhe os produtos, personalizações, data, horário, entrega ou retirada. O pedido entra automaticamente em nossa agenda.`);
    return;
  }

  if (command === "acompanhar" || /(acompanhar|meu pedido|status|andamento)/.test(command)) {
    await sendWhatsAppText(to, `Para consultar ou alterar suas encomendas, entre com seu WhatsApp em:\n\n${preordersUrl}`);
    return;
  }

  if (command === "atendimento" || /(atendente|pessoa|humano|ajuda)/.test(command)) {
    await sendWhatsAppText(to, `Para falar com a equipe da Dulelis, acesse:\n\nhttps://wa.me/${DULELIS_WHATSAPP_NUMBER}?text=${encodeURIComponent("Olá! Vim pelo bot de encomendas e preciso de atendimento.")}`);
    return;
  }

  await sendWhatsAppMenu(to);
}

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");
  const expectedToken = String(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "");
  if (mode === "subscribe" && expectedToken && token === expectedToken && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ ok: false, error: "Verificação inválida." }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (!verifyWhatsAppSignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ ok: false, error: "Assinatura inválida." }, { status: 401 });
  }

  const payload = JSON.parse(rawBody) as WebhookPayload;
  if (payload.object !== "whatsapp_business_account") return NextResponse.json({ ok: true });
  const messages = (payload.entry || []).flatMap((entry) =>
    (entry.changes || []).filter((change) => change.field === "messages").flatMap((change) => change.value?.messages || []),
  );

  try {
    await Promise.all(messages.map((message) => answerMessage(request, message)));
  } catch (error) {
    console.error("Falha no bot do WhatsApp:", error instanceof Error ? error.message : error);
  }
  return NextResponse.json({ ok: true });
}

