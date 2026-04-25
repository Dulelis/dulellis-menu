export type AdminPrintMode = "browser" | "qz";

export type QzPrinterTarget = string | { host: string; port: number };

export type QzPrinterTargetConfig = {
  target: QzPrinterTarget;
  label: string;
};

const QZ_ENABLED_VALUES = new Set(["1", "true", "yes", "on"]);
const PRINT_MODE_RAW = String(process.env.NEXT_PUBLIC_PRINT_MODE || "")
  .trim()
  .toLowerCase();
const QZ_ENABLED_RAW = String(process.env.NEXT_PUBLIC_QZ_ENABLED || "")
  .trim()
  .toLowerCase();
const QZ_PRINTER_NAME =
  String(process.env.NEXT_PUBLIC_QZ_PRINTER || "").trim() || null;
const QZ_PRINTER_HOST =
  String(process.env.NEXT_PUBLIC_QZ_PRINTER_HOST || "").trim() || null;
const QZ_PRINTER_PORT_RAW = Number.parseInt(
  String(process.env.NEXT_PUBLIC_QZ_PRINTER_PORT || "").trim(),
  10,
);
const QZ_PRINTER_PORT =
  Number.isFinite(QZ_PRINTER_PORT_RAW) && QZ_PRINTER_PORT_RAW > 0
    ? QZ_PRINTER_PORT_RAW
    : 9100;
const HAS_QZ_TARGET = Boolean(QZ_PRINTER_HOST || QZ_PRINTER_NAME);

export const QZ_TRAY_SCRIPT_URL = "https://unpkg.com/qz-tray@2.2.4/qz-tray.js";

export const ADMIN_PRINT_MODE: AdminPrintMode =
  PRINT_MODE_RAW === "browser"
    ? "browser"
    : PRINT_MODE_RAW === "qz" ||
        QZ_ENABLED_VALUES.has(QZ_ENABLED_RAW) ||
        HAS_QZ_TARGET
    ? "qz"
    : "browser";

export const ADMIN_QZ_ENABLED = ADMIN_PRINT_MODE === "qz";

export const QZ_PRINTER_TARGETS: QzPrinterTargetConfig[] = ADMIN_QZ_ENABLED
  ? QZ_PRINTER_HOST
    ? [
        {
          target: { host: QZ_PRINTER_HOST, port: QZ_PRINTER_PORT },
          label: `${QZ_PRINTER_HOST}:${QZ_PRINTER_PORT}`,
        },
      ]
    : QZ_PRINTER_NAME
      ? [{ target: QZ_PRINTER_NAME, label: QZ_PRINTER_NAME }]
      : []
  : [];

export const QZ_PRINTER_TARGET = QZ_PRINTER_TARGETS[0]?.target || null;
