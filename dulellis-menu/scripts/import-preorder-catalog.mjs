import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

function loadEnv(fileName) {
  const filePath = path.join(root, fileName);
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(
    fs.readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1).replace(/^['"]|['"]$/g, "")];
      }),
  );
}

const env = { ...loadEnv(".env"), ...loadEnv(".env.local"), ...process.env };
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) throw new Error("Credenciais do Supabase ausentes.");

const catalogPath = path.join(root, "data", "catalogo-encomendas-2026.json");
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

async function request(relativeUrl, options = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${relativeUrl}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(body?.message || body?.error || `Supabase retornou ${response.status}.`);
  return body;
}

const existing = await request("estoque?select=id,nome,opcoes_encomenda");
const bySourceKey = new Map();
const byName = new Map();
for (const product of existing) {
  const sourceKey = product?.opcoes_encomenda?.origem_catalogo;
  if (sourceKey) bySourceKey.set(String(sourceKey), product);
  byName.set(String(product.nome || "").trim().toLocaleLowerCase("pt-BR"), product);
}

let inserted = 0;
let updated = 0;
for (const product of catalog.produtos) {
  const sourceKey = `cardapio-site-2026:${product.nome}`;
  const payload = {
    nome: product.nome,
    descricao: product.descricao,
    categoria: product.categoria,
    preco: product.preco,
    quantidade: 0,
    disponivel_delivery: false,
    disponivel_encomenda: true,
    prazo_minimo_encomenda_horas: 48,
    limite_por_encomenda: null,
    opcoes_encomenda: {
      origem_catalogo: sourceKey,
      unidade: product.unidade || "unidade",
      quantidade_minima: Math.max(1, Number(product.minimo || 1)),
      incremento_quantidade: 1,
      campos: Array.isArray(product.opcoes) ? product.opcoes : [],
    },
  };
  const current = bySourceKey.get(sourceKey) || byName.get(product.nome.trim().toLocaleLowerCase("pt-BR"));
  if (current?.id) {
    await request(`estoque?id=eq.${encodeURIComponent(current.id)}`, { method: "PATCH", body: JSON.stringify(payload) });
    updated += 1;
  } else {
    await request("estoque", { method: "POST", body: JSON.stringify([payload]) });
    inserted += 1;
  }
}

const imported = await request(`estoque?select=id,nome,categoria,preco,opcoes_encomenda&disponivel_encomenda=eq.true&order=categoria.asc,nome.asc`);
console.log(JSON.stringify({ ok: true, catalogo: catalog.produtos.length, inseridos: inserted, atualizados: updated, habilitados_encomenda: imported.length }, null, 2));
