function normalizarNumero(value: string): string {
  return String(value || "").replace(/\D/g, "");
}

export function getSmsOtpEnabled() {
  return Boolean(process.env.SMS_OTP_API_URL || process.env.WHATSAPP_OTP_API_URL);
}

export async function enviarTokenViaSms(args: { telefone: string; token: string; minutos: number }) {
  const url = String(process.env.SMS_OTP_API_URL || process.env.WHATSAPP_OTP_API_URL || "").trim();
  if (!url) {
    throw new Error("SMS_OTP_API_URL nao configurado.");
  }

  const authHeaderName = String(
    process.env.SMS_OTP_AUTH_HEADER || process.env.WHATSAPP_OTP_AUTH_HEADER || "Authorization",
  ).trim();
  const authHeaderValue = String(
    process.env.SMS_OTP_AUTH_VALUE || process.env.WHATSAPP_OTP_AUTH_VALUE || "",
  ).trim();
  const telefone = normalizarNumero(args.telefone);
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
      messaging_product: "sms",
      to: telefone,
      type: "text",
      text: {
        body: mensagem,
      },
    }),
  });

  if (!resp.ok) {
    const bodyText = await resp.text().catch(() => "");
    throw new Error(`Falha ao enviar SMS (${resp.status}). ${bodyText}`.trim());
  }
}
