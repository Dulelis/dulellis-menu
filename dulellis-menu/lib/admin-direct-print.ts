import {
  QZ_PRINTER_TARGETS,
  RAWBT_PACKAGE_NAME,
  type QzPrinterTarget,
} from "@/lib/admin-print-config";

type QzGlobal = {
  websocket?: { isActive?: () => boolean; connect?: () => Promise<void> };
  security?: {
    setCertificatePromise?: (handler: () => Promise<string>) => void;
    setSignatureAlgorithm?: (algorithm: string) => void;
    setSignaturePromise?: (handler: (value: string) => Promise<string>) => void;
  };
  configs?: { create?: (printer: QzPrinterTarget) => unknown };
  print?: (
    config: unknown,
    data: Array<{ type: string; format: string; data: string }>,
  ) => Promise<void>;
};

let qzSecurityConfigured = false;
let qzConnection: Promise<void> | null = null;

async function responseText(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "same-origin",
    ...init,
  });
  if (!response.ok) return "";
  return (await response.text()).trim();
}

export async function printEscPosWithQz(data: string) {
  const qz = (window as unknown as { qz?: QzGlobal }).qz;
  if (!qz?.websocket?.isActive || !qz.websocket.connect || !qz.print) {
    throw new Error("QZ Tray não está aberto neste computador.");
  }
  if (!QZ_PRINTER_TARGETS.length) {
    throw new Error("Nenhuma impressora foi configurada para o QZ Tray.");
  }

  if (!qzSecurityConfigured) {
    qz.security?.setCertificatePromise?.(() =>
      responseText("/api/admin/qz/certificate"),
    );
    qz.security?.setSignatureAlgorithm?.("SHA512");
    qz.security?.setSignaturePromise?.((request) =>
      responseText("/api/admin/qz/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request }),
      }),
    );
    qzSecurityConfigured = true;
  }

  if (!qz.websocket.isActive()) {
    qzConnection ||= qz.websocket.connect().finally(() => {
      qzConnection = null;
    });
    await qzConnection;
  }

  const errors: string[] = [];
  for (const printer of QZ_PRINTER_TARGETS) {
    try {
      const config = qz.configs?.create?.(printer.target);
      if (!config) throw new Error("Configuração indisponível.");
      await qz.print(config, [{ type: "raw", format: "command", data }]);
      return;
    } catch (error) {
      errors.push(`${printer.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(errors.join(" | ") || "A impressora não respondeu.");
}

function bytesToBase64(value: string) {
  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    bytes[index] = code <= 0xff ? code : 0x3f;
  }
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return window.btoa(binary);
}

export function openEscPosInRawbt(data: string) {
  const base64 = bytesToBase64(data);
  window.location.href = `intent:base64,${base64}#Intent;scheme=rawbt;package=${RAWBT_PACKAGE_NAME};end;`;
}

export function qrCodeEscPos(content: string) {
  const value = String(content || "").trim();
  if (!value) return "";
  const bytes = Array.from(new TextEncoder().encode(value));
  const command = (items: number[]) => String.fromCharCode(...items);
  const storageSize = bytes.length + 3;
  return (
    command([0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]) +
    command([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x06]) +
    command([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31]) +
    command([
      0x1d,
      0x28,
      0x6b,
      storageSize % 256,
      Math.floor(storageSize / 256),
      0x31,
      0x50,
      0x30,
    ]) +
    command(bytes) +
    command([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30])
  );
}
