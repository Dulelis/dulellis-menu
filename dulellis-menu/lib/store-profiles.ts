import type { ServiceSupabaseClient } from "@/lib/order-draft";

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

export const STORE_PROFILES_RECORD_NAME = "__DULELLIS_CONFIG_LOJAS__";
const STORE_PROFILES_PREFIX = "DULELLIS_LOJAS_V1:";

export const DEFAULT_STORE_PROFILES: Record<StoreChannel, StoreAddress> = {
  delivery: { nome: "Dulelis Delivery", endereco: "Rua Manoel Felício Adriano", numero: "532", complemento: "", bairro: "Centro", cidade: "Navegantes", uf: "SC", cep: "88370-314", maps_url: "https://maps.app.goo.gl/Vu3gjbNE1GDicuhR7" },
  encomendas: { nome: "Dulelis Encomendas", endereco: "", numero: "", complemento: "", bairro: "", cidade: "Navegantes", uf: "SC", cep: "", maps_url: "" },
  naturais: { nome: "Dulelis Produtos Naturais", endereco: "", numero: "", complemento: "", bairro: "", cidade: "Navegantes", uf: "SC", cep: "", maps_url: "" },
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

export async function readStoreProfiles(db: ServiceSupabaseClient) {
  const { data, error } = await db.from("precificacao_produtos").select("id,observacoes").eq("nome", STORE_PROFILES_RECORD_NAME).order("id").limit(1).maybeSingle();
  if (error) throw error;
  const observations = String(data?.observacoes || "");
  if (!observations.startsWith(STORE_PROFILES_PREFIX)) return { id: Number(data?.id || 0), profiles: normalizeStoreProfiles(null) };
  try { return { id: Number(data?.id || 0), profiles: normalizeStoreProfiles(JSON.parse(observations.slice(STORE_PROFILES_PREFIX.length))) }; }
  catch { return { id: Number(data?.id || 0), profiles: normalizeStoreProfiles(null) }; }
}

export async function saveStoreProfiles(db: ServiceSupabaseClient, raw: unknown) {
  const profiles = normalizeStoreProfiles(raw);
  const current = await readStoreProfiles(db);
  const payload = { nome: STORE_PROFILES_RECORD_NAME, estoque_id: null, unidade_rendimento: "configuracao", custo_ingredientes: 0, custo_embalagem: 0, custo_mao_obra: 0, custo_operacional: 0, margem_percentual: 0, preco_sugerido: 0, preco_venda: 0, ativo_vitrine: false, observacoes: `${STORE_PROFILES_PREFIX}${JSON.stringify(profiles)}` };
  const query = current.id ? db.from("precificacao_produtos").update(payload).eq("id", current.id) : db.from("precificacao_produtos").insert(payload);
  const { error } = await query;
  if (error) throw error;
  return profiles;
}
