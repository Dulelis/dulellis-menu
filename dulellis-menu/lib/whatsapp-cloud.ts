import { createHmac, timingSafeEqual } from "node:crypto";

type WhatsAppTextMessage = {
  messaging_product: "whatsapp";
  recipient_type: "individual";
  to: string;
  type: "text";
  text: { preview_url: boolean; body: string };
};

type WhatsAppButtonsMessage = {
  messaging_product: "whatsapp";
  recipient_type: "individual";
  to: string;
  type: "interactive";
  interactive: {
    type: "button";
    body: { text: string };
    action: { buttons: Array<{ type: "reply"; reply: { id: string; title: string } }> };
  };
};

function cloudConfig() {
  const accessToken = String(process.env.WHATSAPP_CLOUD_ACCESS_TOKEN || "").trim();
  const phoneNumberId = String(process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID || "").trim();
  const version = String(process.env.WHATSAPP_GRAPH_API_VERSION || "v25.0").trim();
  if (!accessToken || !phoneNumberId) throw new Error("Credenciais do WhatsApp Cloud API ausentes.");
  return { accessToken, phoneNumberId, version };
}

async function send(payload: WhatsAppTextMessage | WhatsAppButtonsMessage) {
  const { accessToken, phoneNumberId, version } = cloudConfig();
  const response = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(result.error?.message || `WhatsApp respondeu com status ${response.status}.`);
  }
}

export function verifyWhatsAppSignature(rawBody: string, signature: string | null) {
  const secret = String(process.env.WHATSAPP_META_APP_SECRET || "").trim();
  if (!secret || !signature?.startsWith("sha256=")) return false;
  const received = signature.slice(7);
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  if (received.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

export async function sendWhatsAppText(to: string, body: string) {
  await send({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { preview_url: true, body },
  });
}

export async function sendWhatsAppMenu(to: string) {
  await send({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: "Olá! Sou o assistente de encomendas da Dulelis. Como posso ajudar?" },
      action: {
        buttons: [
          { type: "reply", reply: { id: "fazer_encomenda", title: "Fazer encomenda" } },
          { type: "reply", reply: { id: "acompanhar", title: "Acompanhar pedido" } },
          { type: "reply", reply: { id: "atendimento", title: "Falar com atendente" } },
        ],
      },
    },
  });
}

