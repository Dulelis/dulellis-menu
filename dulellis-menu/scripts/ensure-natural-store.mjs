// Run with: node --env-file=.env.local scripts/ensure-natural-store.mjs
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const id = 1000001;
const { data: existing, error: readError } = await db.from("configuracoes_loja").select("id").eq("id", id).maybeSingle();
if (readError) throw readError;
if (!existing) {
  const { data: delivery, error } = await db.from("configuracoes_loja").select("cidade_atendida,tempo_preparo_min,tempo_preparo_max,tempo_entrega_min,tempo_entrega_max").eq("id", 1).single();
  if (error) throw error;
  const { error: insertError } = await db.from("configuracoes_loja").insert({
    ...delivery, id, hora_abertura: "08:00", hora_fechamento: "18:00",
    dias_semana: ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"],
    categorias_produtos: ["Produtos naturais"], ativo: false,
  });
  if (insertError) throw insertError;
  console.log("Configuração independente criada. Vendas pausadas até definir e ativar o horário.");
} else console.log("Configuração de Produtos Naturais já existe; preferências preservadas.");
