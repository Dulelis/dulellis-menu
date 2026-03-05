function normalizarNumero(value: string): string {
  return String(value || "").replace(/\D/g, "");
}

export function getWhatsappOtpEnabled() {
  return Boolean(process.env.WHATSAPP_OTP_API_URL);
}

export async function enviarTokenViaWhatsapp(args: { whatsapp: string; token: string; minutos: number }) {
  const url = String(process.env.WHATSAPP_OTP_API_URL || "").trim();
  if (!url) {
    throw new Error("WHATSAPP_OTP_API_URL nao configurado.");
  }

  const authHeaderName = String(process.env.WHATSAPP_OTP_AUTH_HEADER || "Authorization").trim();
  const authHeaderValue = String(process.env.WHATSAPP_OTP_AUTH_VALUE || "").trim();
  const telefone = normalizarNumero(args.whatsapp);
  const mensagem = `Dulelis: seu codigo para recuperar a senha e ${args.token}. Valido por ${args.minutos} minutos.`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authHeaderName && authHeaderValue) {
    headers[authHeaderName] = authHeaderValue;
  }

  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: telefone,
      type: "text",
      text: {
        body: mensagem,
      },
    }),
  });

  if (!resp.ok) {
    const bodyText = await resp.text().catch(() => "");
    throw new Error(`Falha ao enviar WhatsApp (${resp.status}). ${bodyText}`.trim());
  }
}
