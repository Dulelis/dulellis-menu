function normalizarNumero(value: string): string {
  return String(value || "").replace(/\D/g, "");
}

export function getSmsOtpEnabled() {
  return Boolean(process.env.SMS_OTP_API_URL || process.env.WHATSAPP_OTP_API_URL);
}

export async function enviarTokenViaSms(args: { telefone: string; token?: string; minutos: number; resetUrl?: string }) {
  const url = String(process.env.SMS_OTP_API_URL || process.env.WHATSAPP_OTP_API_URL || "").trim();
  if (!url) {
    throw new Error("SMS_OTP_API_URL nao configurado.");
  }
  const from = String(process.env.SMS_OTP_FROM || "").trim();
  if (!from) {
    throw new Error("SMS_OTP_FROM nao configurado.");
  }

  const apiToken = String(process.env.SMS_OTP_API_TOKEN || process.env.ZENVIA_API_TOKEN || "").trim();
  const authHeaderName = String(process.env.SMS_OTP_AUTH_HEADER || process.env.WHATSAPP_OTP_AUTH_HEADER || "").trim();
  const authHeaderValue = String(process.env.SMS_OTP_AUTH_VALUE || process.env.WHATSAPP_OTP_AUTH_VALUE || "").trim();
  const telefone = normalizarNumero(args.telefone);
  const mensagem = args.resetUrl
    ? `Dulelis: toque no link para redefinir sua senha (valido por ${args.minutos} minutos): ${args.resetUrl}`
    : `Dulelis: seu codigo para recuperar a senha e ${String(args.token || "").trim()}. Valido por ${args.minutos} minutos.`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Zenvia v2 uses X-API-Token. Keep support for the legacy custom header setup too.
  const bearerAsToken =
    authHeaderName.toLowerCase() === "authorization" && authHeaderValue.toLowerCase().startsWith("bearer ")
      ? authHeaderValue.slice(7).trim()
      : "";

  if (apiToken) {
    headers["X-API-Token"] = apiToken;
  } else if (bearerAsToken) {
    headers["X-API-Token"] = bearerAsToken;
  } else if (authHeaderName && authHeaderValue) {
    headers[authHeaderName] = authHeaderValue;
  }

  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      externalId: `reset-${Date.now()}`,
      from,
      to: telefone,
      contents: [
        {
          type: "text",
          text: mensagem,
        },
      ],
    }),
  });

  if (!resp.ok) {
    const bodyText = await resp.text().catch(() => "");
    throw new Error(`Falha ao enviar SMS (${resp.status}). ${bodyText}`.trim());
  }
}
