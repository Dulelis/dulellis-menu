import { createSign } from "crypto";
import { existsSync, readFileSync } from "fs";

type QzSignatureAlgorithm = "SHA1" | "SHA256" | "SHA512";

type QzSigningConfig = {
  enabled: boolean;
  certificate: string;
  privateKey: string;
  algorithm: QzSignatureAlgorithm;
  passphrase: string | null;
};

function normalizarValorPemBruto(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\\n/g, "\n").trim();
}

function lerTextoEnvOuArquivo(args: {
  direct?: string;
  base64?: string;
  path?: string;
}): string {
  const direto = String(args.direct || "").trim();
  if (direto) {
    return normalizarValorPemBruto(direto);
  }

  const base64 = String(args.base64 || "").trim();
  if (base64) {
    return normalizarValorPemBruto(
      Buffer.from(base64, "base64").toString("utf8"),
    );
  }

  const path = String(args.path || "").trim();
  if (path && existsSync(path)) {
    return normalizarValorPemBruto(readFileSync(path, "utf8"));
  }

  return "";
}

function obterAlgoritmoAssinatura(): QzSignatureAlgorithm {
  const valor = String(process.env.QZ_SIGNATURE_ALGORITHM || "SHA512")
    .trim()
    .toUpperCase();
  if (valor === "SHA1" || valor === "SHA256" || valor === "SHA512") {
    return valor;
  }
  return "SHA512";
}

export function getQzSigningConfig(): QzSigningConfig {
  const certificate = lerTextoEnvOuArquivo({
    direct: process.env.QZ_CERTIFICATE,
    base64: process.env.QZ_CERTIFICATE_BASE64,
    path: process.env.QZ_CERTIFICATE_PATH,
  });
  const privateKey = lerTextoEnvOuArquivo({
    direct: process.env.QZ_PRIVATE_KEY,
    base64: process.env.QZ_PRIVATE_KEY_BASE64,
    path: process.env.QZ_PRIVATE_KEY_PATH,
  });
  const passphrase =
    String(process.env.QZ_PRIVATE_KEY_PASSPHRASE || "").trim() || null;

  return {
    enabled: Boolean(certificate && privateKey),
    certificate,
    privateKey,
    algorithm: obterAlgoritmoAssinatura(),
    passphrase,
  };
}

export function signQzMessage(message: string): string {
  const config = getQzSigningConfig();
  if (!config.enabled) {
    throw new Error("Assinatura do QZ Tray nao configurada.");
  }

  const sign = createSign(config.algorithm);
  sign.update(message);
  sign.end();

  return sign.sign(
    config.passphrase
      ? { key: config.privateKey, passphrase: config.passphrase }
      : { key: config.privateKey },
    "base64",
  );
}
