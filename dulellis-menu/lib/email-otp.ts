function normalizarEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}

function getSmtpConfig() {
  const host = String(process.env.SMTP_HOST || "").trim();
  const port = Number(process.env.SMTP_PORT || 465);
  const user = String(process.env.SMTP_USER || "").trim();
  const pass = String(process.env.SMTP_PASS || "").trim();
  const secure = String(process.env.SMTP_SECURE || "").trim().toLowerCase();

  return {
    host,
    port: Number.isFinite(port) && port > 0 ? port : 465,
    user,
    pass,
    secure: secure ? secure === "true" : true,
  };
}

export function getEmailOtpEnabled() {
  const smtp = getSmtpConfig();
  const hasSmtp = Boolean(smtp.host && smtp.user && smtp.pass);
  const hasResend = Boolean(
    String(process.env.RESEND_API_KEY || "").trim() && String(process.env.EMAIL_OTP_FROM || "").trim(),
  );
  const hasWebhook = Boolean(String(process.env.EMAIL_OTP_API_URL || "").trim());
  return hasSmtp || hasResend || hasWebhook;
}

export async function enviarLinkRecuperacaoPorEmail(args: {
  email: string;
  resetUrl: string;
  minutos: number;
}) {
  const email = normalizarEmail(args.email);
  const from = String(process.env.EMAIL_OTP_FROM || "").trim();
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

  const smtp = getSmtpConfig();
  if (smtp.host && smtp.user && smtp.pass) {
    const { createTransport } = await import("nodemailer");
    const transport = createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: {
        user: smtp.user,
        pass: smtp.pass,
      },
    });

    await transport.sendMail({
      from: from || smtp.user,
      to: email,
      subject: assunto,
      text: texto,
      html,
    });
    return;
  }

  const resendApiKey = String(process.env.RESEND_API_KEY || "").trim();
  if (!resendApiKey || !from) {
    throw new Error(
      "Configure EMAIL_OTP_API_URL ou SMTP_HOST/SMTP_USER/SMTP_PASS ou RESEND_API_KEY/EMAIL_OTP_FROM.",
    );
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
