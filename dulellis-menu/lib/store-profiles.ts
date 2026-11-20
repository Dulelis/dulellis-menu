export type StoreChannel = "delivery" | "encomendas" | "naturais";
export type StoreAddress = {
  nome: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  maps_url: string;
};

export const DEFAULT_STORE_PROFILES: Record<StoreChannel, StoreAddress> = {
  delivery: { nome: "Dulelis Delivery", endereco: "Rua Manoel Felício Adriano", numero: "532", complemento: "", bairro: "Centro", cidade: "Navegantes", uf: "SC", cep: "88370-314", maps_url: "https://maps.app.goo.gl/Vu3gjbNE1GDicuhR7" },
  encomendas: { nome: "Dulelis Encomendas", endereco: "Rua Manoel Felício Adriano", numero: "532", complemento: "", bairro: "Centro", cidade: "Navegantes", uf: "SC", cep: "88370-314", maps_url: "https://maps.app.goo.gl/Vu3gjbNE1GDicuhR7" },
  naturais: { nome: "Dulelis Produtos Naturais", endereco: "Rua Manoel Felício Adriano", numero: "532", complemento: "", bairro: "Centro", cidade: "Navegantes", uf: "SC", cep: "88370-314", maps_url: "https://maps.app.goo.gl/Vu3gjbNE1GDicuhR7" },
};

function text(value: unknown, limit = 160) { return String(value || "").trim().slice(0, limit); }

export function normalizeStoreProfiles(raw: unknown): Record<StoreChannel, StoreAddress> {
  const source = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const result = structuredClone(DEFAULT_STORE_PROFILES);
  for (const channel of Object.keys(result) as StoreChannel[]) {
    const item = source[channel] && typeof source[channel] === "object" ? source[channel] as Record<string, unknown> : {};
    result[channel] = {
      nome: text(item.nome || result[channel].nome, 80), endereco: text(item.endereco), numero: text(item.numero, 30),
      complemento: text(item.complemento, 80), bairro: text(item.bairro, 80), cidade: text(item.cidade || result[channel].cidade, 80),
      uf: text(item.uf || result[channel].uf, 2).toUpperCase(), cep: text(item.cep, 10), maps_url: text(item.maps_url, 500),
    };
  }
  return result;
}

export function storeAddressSummary(address: StoreAddress) {
  return [[address.endereco, address.numero].filter(Boolean).join(", "), address.complemento, address.bairro, [address.cidade, address.uf].filter(Boolean).join(" - "), address.cep ? `CEP ${address.cep}` : ""].filter(Boolean).join(", ");
}
