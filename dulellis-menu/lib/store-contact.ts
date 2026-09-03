export const DULELIS_WHATSAPP_NUMBER = "5547988347100";

export function buildDulelisWhatsappUrl(message: string) {
  return `https://wa.me/${DULELIS_WHATSAPP_NUMBER}?text=${encodeURIComponent(String(message || ""))}`;
}
