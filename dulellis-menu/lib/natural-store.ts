export const NATURAL_STORE_CONFIG_ID = 1000001;

export function isNaturalProduct(product: { categoria?: string | null }) {
  return String(product.categoria || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() === "produtos naturais";
}
