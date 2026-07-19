import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/admin-request";
import { getServiceSupabase } from "@/lib/server-supabase";
import { enforceSameOriginForWrite } from "@/lib/request-security";

const PRODUCTION_STATUSES = new Set([
  "aguardando_confirmacao",
  "confirmada",
  "em_producao",
  "pronta",
  "finalizada",
]);

function schemaMissing(message?: string) {
  const normalized = String(message || "").toLowerCase();
  return normalized.includes("does not exist") || normalized.includes("could not find") || normalized.includes("schema cache");
}

async function authorized(request: NextRequest) {
  if (!(await isAdminRequestAuthorized(request))) {
    return NextResponse.json({ ok: false, error: "Nao autorizado." }, { status: 401 });
  }
  return null;
}

export async function GET(request: NextRequest) {
  const authError = await authorized(request);
  if (authError) return authError;
  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ ok: false, error: "Supabase nao configurado." }, { status: 500 });

  const [config, orders, products, blocks, capacities] = await Promise.all([
    supabase.from("configuracoes_encomendas").select("*").order("id").limit(1).maybeSingle(),
    supabase
      .from("pedidos")
      .select("id,cliente_id,cliente_nome,whatsapp,itens,total,taxa_entrega,forma_pagamento,status_pedido,status_pagamento,tipo_recebimento,agendado_para,status_producao,valor_sinal,saldo_restante,detalhes_encomenda,observacao,created_at")
      .eq("tipo_pedido", "encomenda")
      .order("agendado_para", { ascending: true })
      .limit(500),
    supabase
      .from("estoque")
      .select("id,nome,descricao,categoria,preco,imagem_url,quantidade,disponivel_encomenda,prazo_minimo_encomenda_horas,limite_por_encomenda,opcoes_encomenda")
      .order("categoria")
      .order("nome"),
    supabase.from("bloqueios_encomendas").select("*").order("inicio", { ascending: true }),
    supabase.from("capacidade_encomendas").select("*").order("data", { ascending: true }),
  ]);
  const error = config.error || orders.error || products.error || blocks.error || capacities.error;
  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error: schemaMissing(error.message)
          ? "Execute sql/upgrade_delivery_encomendas_foundation.sql no Supabase."
          : error.message,
      },
      { status: schemaMissing(error.message) ? 503 : 500 },
    );
  }
  return NextResponse.json({
    ok: true,
    data: {
      config: config.data || null,
      encomendas: orders.data || [],
      produtos: products.data || [],
      bloqueios: blocks.data || [],
      capacidades: capacities.data || [],
    },
  });
}

export async function POST(request: NextRequest) {
  const authError = await authorized(request);
  if (authError) return authError;
  const originError = enforceSameOriginForWrite(request);
  if (originError) return originError;
  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ ok: false, error: "Supabase nao configurado." }, { status: 500 });

  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    id?: number;
    payload?: Record<string, unknown>;
  };
  const action = String(body.action || "");
  const id = Number(body.id || 0);
  const payload = body.payload || {};
  try {
    if (action === "order_cancel") {
      const motivo = String(payload.motivo || "").trim();
      if (!Number.isInteger(id) || id <= 0 || !motivo) {
        return NextResponse.json({ ok: false, error: "Informe o motivo do cancelamento." }, { status: 400 });
      }
      const { data: current, error: readError } = await supabase
        .from("pedidos")
        .select("detalhes_encomenda")
        .eq("id", id)
        .eq("tipo_pedido", "encomenda")
        .maybeSingle();
      if (readError) throw readError;
      if (!current) return NextResponse.json({ ok: false, error: "Encomenda nao encontrada." }, { status: 404 });
      const details = current.detalhes_encomenda && typeof current.detalhes_encomenda === "object"
        ? current.detalhes_encomenda as Record<string, unknown>
        : {};
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("pedidos")
        .update({
          status_producao: "cancelada",
          status_pedido: "cancelado",
          detalhes_encomenda: {
            ...details,
            cancelamento: { motivo: motivo.slice(0, 1000), cancelado_em: now, atualizado_em: now },
          },
        })
        .eq("id", id)
        .eq("tipo_pedido", "encomenda")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      await supabase.from("pedido_eventos").insert([{
        pedido_id: id,
        tipo: "encomenda_cancelada",
        descricao: `Encomenda cancelada. Motivo: ${motivo.slice(0, 300)}`,
        dados: { motivo: motivo.slice(0, 1000) },
        criado_por: "admin",
      }]);
      return NextResponse.json({ ok: true, data });
    }

    if (action === "order_restore") {
      if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json({ ok: false, error: "Encomenda invalida." }, { status: 400 });
      }
      const { data, error } = await supabase
        .from("pedidos")
        .update({ status_producao: "aguardando_confirmacao", status_pedido: "aguardando_aceite" })
        .eq("id", id)
        .eq("tipo_pedido", "encomenda")
        .eq("status_producao", "cancelada")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json({ ok: false, error: "Item cancelado nao encontrado." }, { status: 404 });
      await supabase.from("pedido_eventos").insert([{
        pedido_id: id,
        tipo: "encomenda_restaurada",
        descricao: "Encomenda restaurada para a agenda.",
        dados: { status_producao: "aguardando_confirmacao" },
        criado_por: "admin",
      }]);
      return NextResponse.json({ ok: true, data });
    }

    if (action === "order_cancelled_update") {
      const motivo = String(payload.motivo || "").trim();
      if (!Number.isInteger(id) || id <= 0 || !motivo) {
        return NextResponse.json({ ok: false, error: "O motivo do cancelamento e obrigatorio." }, { status: 400 });
      }
      const schedule = new Date(String(payload.agendado_para || ""));
      if (!Number.isFinite(schedule.getTime())) {
        return NextResponse.json({ ok: false, error: "Informe uma data valida." }, { status: 400 });
      }
      const rawItems = Array.isArray(payload.itens) ? payload.itens : [];
      const items = rawItems.flatMap((raw) => {
        if (!raw || typeof raw !== "object") return [];
        const item = raw as Record<string, unknown>;
        const nome = String(item.nome || "").trim();
        const qtd = Math.max(0, Number(item.qtd || 0));
        const preco = Math.max(0, Number(item.preco || 0));
        if (!nome || !Number.isFinite(qtd) || !Number.isFinite(preco)) return [];
        return [{ ...item, nome, qtd, preco }];
      });
      const { data: current, error: readError } = await supabase
        .from("pedidos")
        .select("detalhes_encomenda,taxa_entrega,status_producao")
        .eq("id", id)
        .eq("tipo_pedido", "encomenda")
        .maybeSingle();
      if (readError) throw readError;
      if (!current || current.status_producao !== "cancelada") {
        return NextResponse.json({ ok: false, error: "A encomenda nao esta cancelada." }, { status: 409 });
      }
      const details = current.detalhes_encomenda && typeof current.detalhes_encomenda === "object"
        ? current.detalhes_encomenda as Record<string, unknown>
        : {};
      const previousCancellation = details.cancelamento && typeof details.cancelamento === "object" && !Array.isArray(details.cancelamento)
        ? details.cancelamento as Record<string, unknown>
        : {};
      const total = items.reduce((sum, item) => sum + Number(item.qtd) * Number(item.preco), 0) + Number(current.taxa_entrega || 0);
      const { data, error } = await supabase
        .from("pedidos")
        .update({
          cliente_nome: String(payload.cliente_nome || "").trim(),
          whatsapp: String(payload.whatsapp || "").trim(),
          agendado_para: schedule.toISOString(),
          tipo_recebimento: String(payload.tipo_recebimento || "retirada") === "entrega" ? "entrega" : "retirada",
          itens: items,
          total: Math.round(total * 100) / 100,
          observacao: String(payload.observacao || "").trim(),
          detalhes_encomenda: {
            ...details,
            cancelamento: {
              ...previousCancellation,
              motivo: motivo.slice(0, 1000),
              atualizado_em: new Date().toISOString(),
            },
          },
        })
        .eq("id", id)
        .eq("tipo_pedido", "encomenda")
        .eq("status_producao", "cancelada")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      await supabase.from("pedido_eventos").insert([{
        pedido_id: id,
        tipo: "encomenda_cancelada_editada",
        descricao: "Dados da encomenda cancelada atualizados.",
        dados: { motivo: motivo.slice(0, 1000) },
        criado_por: "admin",
      }]);
      return NextResponse.json({ ok: true, data });
    }

    if (action === "order_status") {
      const status = String(payload.status_producao || "");
      if (!Number.isInteger(id) || id <= 0 || !PRODUCTION_STATUSES.has(status)) {
        return NextResponse.json({ ok: false, error: "Status invalido." }, { status: 400 });
      }
      const statusPedido = status === "cancelada"
        ? "cancelado"
        : status === "finalizada"
          ? "finalizado"
          : status === "pronta"
            ? "saiu_entrega"
            : status === "em_producao"
              ? "em_preparo"
              : status === "confirmada"
                ? "recebido"
                : "aguardando_aceite";
      const { data, error } = await supabase
        .from("pedidos")
        .update({ status_producao: status, status_pedido: statusPedido })
        .eq("id", id)
        .eq("tipo_pedido", "encomenda")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      await supabase.from("pedido_eventos").insert([{
        pedido_id: id,
        tipo: "status_producao_alterado",
        descricao: `Status de producao alterado para ${status}.`,
        dados: { status_producao: status, status_pedido: statusPedido },
        criado_por: "admin",
      }]);
      return NextResponse.json({ ok: true, data });
    }

    if (action === "config") {
      const clean = {
        ativo: payload.ativo !== false,
        antecedencia_minima_horas: Math.max(0, Number(payload.antecedencia_minima_horas || 0)),
        horizonte_maximo_dias: Math.max(1, Number(payload.horizonte_maximo_dias || 1)),
        hora_inicio: String(payload.hora_inicio || "08:00"),
        hora_fim: String(payload.hora_fim || "18:00"),
        intervalo_slot_minutos: Math.max(15, Number(payload.intervalo_slot_minutos || 60)),
        capacidade_padrao_por_slot: Math.max(1, Number(payload.capacidade_padrao_por_slot || 1)),
        dias_semana: Array.isArray(payload.dias_semana) ? payload.dias_semana : [],
        permite_entrega: payload.permite_entrega !== false,
        permite_retirada: payload.permite_retirada !== false,
        percentual_sinal: Math.min(100, Math.max(0, Number(payload.percentual_sinal ?? 50))),
        permite_pagamento_integral: payload.permite_pagamento_integral !== false,
      };
      const query = Number.isInteger(id) && id > 0
        ? supabase.from("configuracoes_encomendas").update(clean).eq("id", id)
        : supabase.from("configuracoes_encomendas").insert([clean]);
      const { data, error } = await query.select("*").maybeSingle();
      if (error) throw error;
      return NextResponse.json({ ok: true, data });
    }

    if (action === "product" || action === "product_create") {
      if (action === "product" && (!Number.isInteger(id) || id <= 0)) {
        return NextResponse.json({ ok: false, error: "Produto invalido." }, { status: 400 });
      }
      const name = String(payload.nome || "").trim();
      const price = Number(payload.preco);
      if (!name) return NextResponse.json({ ok: false, error: "Informe o nome do produto." }, { status: 400 });
      if (!Number.isFinite(price) || price < 0) {
        return NextResponse.json({ ok: false, error: "Informe um preco valido." }, { status: 400 });
      }
      const clean = {
        nome: name,
        descricao: String(payload.descricao || "").trim(),
        categoria: String(payload.categoria || "Encomendas").trim() || "Encomendas",
        preco: Math.round(price * 100) / 100,
        imagem_url: String(payload.imagem_url || "").trim() || null,
        disponivel_encomenda: payload.disponivel_encomenda === true,
        prazo_minimo_encomenda_horas: Math.max(0, Number(payload.prazo_minimo_encomenda_horas || 0)),
        limite_por_encomenda: Number(payload.limite_por_encomenda) > 0 ? Number(payload.limite_por_encomenda) : null,
        opcoes_encomenda:
          payload.opcoes_encomenda && typeof payload.opcoes_encomenda === "object"
            ? payload.opcoes_encomenda
            : {},
      };
      const query = action === "product_create"
        ? supabase.from("estoque").insert([{ ...clean, quantidade: 0 }])
        : supabase.from("estoque").update(clean).eq("id", id);
      const { data, error } = await query.select("*").maybeSingle();
      if (error) throw error;
      return NextResponse.json({ ok: true, data });
    }

    if (action === "block_create") {
      const inicio = new Date(String(payload.inicio || ""));
      const fim = new Date(String(payload.fim || ""));
      if (!Number.isFinite(inicio.getTime()) || !Number.isFinite(fim.getTime()) || fim <= inicio) {
        return NextResponse.json({ ok: false, error: "Periodo de bloqueio invalido." }, { status: 400 });
      }
      const { data, error } = await supabase.from("bloqueios_encomendas").insert([{
        inicio: inicio.toISOString(), fim: fim.toISOString(), motivo: String(payload.motivo || ""), ativo: true,
      }]).select("*").maybeSingle();
      if (error) throw error;
      return NextResponse.json({ ok: true, data });
    }

    if (action === "block_delete") {
      const { error } = await supabase.from("bloqueios_encomendas").delete().eq("id", id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (action === "capacity_save") {
      const clean = {
        data: String(payload.data || ""),
        hora_inicio: String(payload.hora_inicio || ""),
        hora_fim: String(payload.hora_fim || ""),
        capacidade_total: Math.max(0, Number(payload.capacidade_total || 0)),
        observacao: String(payload.observacao || ""),
        ativo: true,
      };
      const { data, error } = await supabase.from("capacidade_encomendas").upsert([clean], {
        onConflict: "data,hora_inicio,hora_fim",
      }).select("*").maybeSingle();
      if (error) throw error;
      return NextResponse.json({ ok: true, data });
    }

    if (action === "capacity_delete") {
      const { error } = await supabase.from("capacidade_encomendas").delete().eq("id", id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "Acao invalida." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Falha ao salvar." },
      { status: 500 },
    );
  }
}
