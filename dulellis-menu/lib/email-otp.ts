function normalizarEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}

export function getEmailOtpEnabled() {
  const hasResend = Boolean(
    String(process.env.RESEND_API_KEY || "").trim() && String(process.env.EMAIL_OTP_FROM || "").trim(),
  );
  const hasWebhook = Boolean(String(process.env.EMAIL_OTP_API_URL || "").trim());
  return hasResend || hasWebhook;
}

export async function enviarLinkRecuperacaoPorEmail(args: {
  email: string;
  resetUrl: string;
  minutos: number;
}) {
  const email = normalizarEmail(args.email);
  const assunto = "Recuperacao de senha - Dulelis";
  const texto = `Clique no link para redefinir sua senha (valido por ${args.minutos} minutos): ${args.resetUrl}`;
  const html = `<p>Clique no link para redefinir sua senha (valido por ${args.minutos} minutos):</p><p><a href="${args.resetUrl}">${args.resetUrl}</a></p>`;

  const webhookUrl = String(process.env.EMAIL_OTP_API_URL || "").trim();
  if (webhookUrl) {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: email, subject: assunto, text: texto, html }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Falha ao enviar e-mail (${response.status}). ${body}`.trim());
    }
    return;
  }

  const resendApiKey = String(process.env.RESEND_API_KEY || "").trim();
  const from = String(process.env.EMAIL_OTP_FROM || "").trim();
  if (!resendApiKey || !from) {
    throw new Error("RESEND_API_KEY/EMAIL_OTP_FROM nao configurados.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: assunto,
      text: texto,
      html,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Falha ao enviar e-mail (${response.status}). ${body}`.trim());
  }
}
