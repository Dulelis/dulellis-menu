export type AdminPrintMode = "browser" | "qz" | "rawbt";

export type QzPrinterTarget = string | { host: string; port: number };

export type QzPrinterTargetConfig = {
  target: QzPrinterTarget;
  label: string;
};

const ENABLED_VALUES = new Set(["1", "true", "yes", "on"]);
const PRINT_MODE_RAW = String(process.env.NEXT_PUBLIC_PRINT_MODE || "")
  .trim()
  .toLowerCase();
const QZ_ENABLED_RAW = String(process.env.NEXT_PUBLIC_QZ_ENABLED || "")
  .trim()
  .toLowerCase();
const RAWBT_ENABLED_RAW = String(process.env.NEXT_PUBLIC_RAWBT_ENABLED || "")
  .trim()
  .toLowerCase();
const QZ_PRINTER_NAME =
  String(process.env.NEXT_PUBLIC_QZ_PRINTER || "").trim() || null;
const QZ_PRINTER_HOST =
  String(process.env.NEXT_PUBLIC_QZ_PRINTER_HOST || "").trim() || null;
const RAWBT_PACKAGE_NAME_RAW =
  String(process.env.NEXT_PUBLIC_RAWBT_PACKAGE || "").trim() ||
  "ru.a402d.rawbtprinter";
const QZ_PRINTER_PORT_RAW = Number.parseInt(
  String(process.env.NEXT_PUBLIC_QZ_PRINTER_PORT || "").trim(),
  10,
);
const QZ_PRINTER_PORT =
  Number.isFinite(QZ_PRINTER_PORT_RAW) && QZ_PRINTER_PORT_RAW > 0
    ? QZ_PRINTER_PORT_RAW
    : 9100;
const HAS_QZ_TARGET = Boolean(QZ_PRINTER_HOST || QZ_PRINTER_NAME);
const FORCE_BROWSER_MODE = PRINT_MODE_RAW === "browser";
const FORCE_QZ_MODE = PRINT_MODE_RAW === "qz";
const FORCE_RAWBT_MODE = PRINT_MODE_RAW === "rawbt";

export const QZ_TRAY_SCRIPT_URL = "https://unpkg.com/qz-tray@2.2.4/qz-tray.js";

export const ADMIN_QZ_ENABLED =
  !FORCE_BROWSER_MODE &&
  (FORCE_QZ_MODE || ENABLED_VALUES.has(QZ_ENABLED_RAW) || HAS_QZ_TARGET);
export const ADMIN_RAWBT_ENABLED =
  !FORCE_BROWSER_MODE &&
  (FORCE_RAWBT_MODE ||
    ENABLED_VALUES.has(RAWBT_ENABLED_RAW) ||
    RAWBT_ENABLED_RAW === "");
export const ADMIN_PRINT_MODE: AdminPrintMode = FORCE_BROWSER_MODE
  ? "browser"
  : ADMIN_QZ_ENABLED
    ? "qz"
    : ADMIN_RAWBT_ENABLED
      ? "rawbt"
      : "browser";
export const RAWBT_PACKAGE_NAME = RAWBT_PACKAGE_NAME_RAW;

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
