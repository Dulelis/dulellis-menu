function normalizarNumero(value: string): string {
  return String(value || "").replace(/\D/g, "");
}

type SmsProvider = "vonage" | "http";

function getSmsProvider(): SmsProvider {
  const explicit = String(process.env.SMS_OTP_PROVIDER || "").trim().toLowerCase();
  if (explicit === "vonage") return "vonage";
  if (explicit === "http" || explicit === "zenvia") return "http";

  const hasVonageCreds =
    Boolean(String(process.env.VONAGE_API_KEY || "").trim()) &&
    Boolean(String(process.env.VONAGE_API_SECRET || "").trim());
  return hasVonageCreds ? "vonage" : "http";
}

export function getSmsOtpEnabled() {
  const provider = getSmsProvider();
  if (provider === "vonage") {
    return Boolean(
      String(process.env.VONAGE_API_KEY || "").trim() &&
        String(process.env.VONAGE_API_SECRET || "").trim() &&
        String(process.env.SMS_OTP_FROM || process.env.VONAGE_SMS_FROM || "").trim(),
    );
  }
  return Boolean(process.env.SMS_OTP_API_URL || process.env.WHATSAPP_OTP_API_URL);
}

export async function enviarTokenViaSms(args: { telefone: string; token?: string; minutos: number; resetUrl?: string }) {
  const telefone = normalizarNumero(args.telefone);
  const mensagem = args.resetUrl
    ? `Dulelis: toque no link para redefinir sua senha (valido por ${args.minutos} minutos): ${args.resetUrl}`
    : `Dulelis: seu codigo para recuperar a senha e ${String(args.token || "").trim()}. Valido por ${args.minutos} minutos.`;
  const provider = getSmsProvider();

  if (provider === "vonage") {
    const apiKey = String(process.env.VONAGE_API_KEY || "").trim();
    const apiSecret = String(process.env.VONAGE_API_SECRET || "").trim();
    const from = String(process.env.SMS_OTP_FROM || process.env.VONAGE_SMS_FROM || "").trim();

    if (!apiKey || !apiSecret) {
      throw new Error("VONAGE_API_KEY/VONAGE_API_SECRET nao configurados.");
    }
    if (!from) {
      throw new Error("SMS_OTP_FROM (ou VONAGE_SMS_FROM) nao configurado.");
    }

    const { Vonage } = await import("@vonage/server-sdk");
    const vonage = new Vonage({ apiKey, apiSecret });
    await vonage.sms.send({ to: telefone, from, text: mensagem });
    return;
  }

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
