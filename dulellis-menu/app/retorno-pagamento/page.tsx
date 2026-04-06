import { CheckCircle2, Clock3, CreditCard, MapPin, XCircle } from "lucide-react";
import RetornoActions from "./RetornoActions";
import { getServiceSupabase } from "@/lib/server-supabase";

const WHATSAPP_LOJA = "5547988347100";
const LOJA_ENDERECO_RETIRADA = "Rua Manoel Felício Adriano, 532";
const LOJA_BAIRRO_RETIRADA = "Centro";
const LOJA_CIDADE_UF_RETIRADA = "Navegantes - SC";
const LOJA_CEP_RETIRADA = "88370-314";
const LOJA_ENDERECO_RETIRADA_RESUMO = [
  LOJA_ENDERECO_RETIRADA,
  LOJA_BAIRRO_RETIRADA,
  LOJA_CIDADE_UF_RETIRADA,
  `CEP ${LOJA_CEP_RETIRADA}`,
].join(", ");
const LOJA_LINK_MAPS_RETIRADA = "https://maps.app.goo.gl/Vu3gjbNE1GDicuhR7";

function getStatusInfo(status: string) {
  const normalizado = status.trim().toLowerCase();

  if (["paid", "approved", "pago", "authorized"].includes(normalizado)) {
    return {
      titulo: "Pagamento confirmado",
      descricao: "Recebemos seu pagamento com sucesso.",
      cor: "text-green-600",
      card: "bg-green-50 border-green-200",
      Icone: CheckCircle2,
    };
  }

  if (["pending", "in_process", "aguardando", "waiting"].includes(normalizado)) {
    return {
      titulo: "Pagamento em análise",
      descricao: "Seu pagamento está em processamento.",
      cor: "text-amber-600",
      card: "bg-amber-50 border-amber-200",
      Icone: Clock3,
    };
  }

  if (["rejected", "cancelled", "canceled", "failed", "negado"].includes(normalizado)) {
    return {
      titulo: "Pagamento não aprovado",
      descricao: "Tente novamente com outro método de pagamento.",
      cor: "text-rose-600",
      card: "bg-rose-50 border-rose-200",
      Icone: XCircle,
    };
  }

  return {
    titulo: "Retorno do pagamento",
    descricao: "Recebemos o retorno da transação.",
    cor: "text-slate-700",
    card: "bg-slate-50 border-slate-200",
    Icone: CreditCard,
  };
}

type PedidoItem = {
  nome: string;
  qtd: number;
};

type PedidoResumo = {
  clienteNome: string;
  referencia: string;
  total: number;
  formaPagamento: string;
  whatsapp: string;
  itens: PedidoItem[];
  enderecoCompleto: string;
  pontoReferencia: string;
  retiradaNoBalcao: boolean;
};

type ClienteEndereco = {
  whatsapp?: string | null;
  endereco?: string | null;
  numero?: string | null;
  ponto_referencia?: string | null;
  created_at?: string | null;
};

function normalizarNumero(value: string): string {
  return String(value || "").replace(/\D/g, "");
}

function normalizarTexto(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function pedidoEhRetiradaNoBalcao(observacao?: string | null) {
  return normalizarTexto(String(observacao || "")).includes("tipo de entrega: retirar no balcao");
}

function whatsappEquivalente(a: string, b: string): boolean {
  const wa = normalizarNumero(a);
  const wb = normalizarNumero(b);
  if (!wa || !wb) return false;
  if (wa === wb) return true;
  return wa.slice(-10) === wb.slice(-10);
}

function formatarCep(cep: string) {
  const digits = normalizarNumero(cep).slice(0, 8);
  if (digits.length !== 8) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function limparEnderecoDePontoReferencia(endereco: string) {
  return String(endereco || "")
    .replace(/\s*-\s*ponto\s+de\s+refer(?:e|ê)ncia:\s*.+$/i, "")
    .replace(/\s*ponto\s+de\s+refer(?:e|ê)ncia:\s*.+$/i, "")
    .trim();
}

function extrairPontoReferenciaDeEndereco(endereco: string) {
  const texto = String(endereco || "");
  const match = texto.match(/ponto\s+de\s+refer(?:e|ê)ncia:\s*(.+)$/i);
  return String(match?.[1] || "").trim();
}

function montarEnderecoCompleto(endereco: string, numero: string, bairro: string, cidade: string, cep: string) {
  const enderecoPrincipal = [endereco, numero].filter(Boolean).join(", ").trim();
  const cepFormatado = formatarCep(cep);

  return [enderecoPrincipal, bairro, cidade, cepFormatado ? `CEP ${cepFormatado}` : ""]
    .filter(Boolean)
    .join(" - ");
}

function parseItensPedido(raw: unknown): PedidoItem[] {
  let base: unknown = raw;
  if (typeof base === "string") {
    try {
      base = JSON.parse(base);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(base)) return [];
  return base
    .map((item) => {
      const obj = (item || {}) as { nome?: unknown; qtd?: unknown };
      return {
        nome: String(obj.nome || "Item").trim() || "Item",
        qtd: Math.max(1, Number(obj.qtd || 1)),
      };
    })
    .filter((item) => item.nome.length > 0);
}

async function buscarClientesComSchemaFlexivel(
  supabase: NonNullable<ReturnType<typeof getServiceSupabase>>,
  filtro:
    | { tipo: "eq"; coluna: "whatsapp"; valor: string }
    | { tipo: "ilike"; coluna: "whatsapp" | "nome"; valor: string },
  limite = 30,
) {
  const tentativasSelect = [
    "whatsapp,endereco,numero,ponto_referencia,created_at",
    "whatsapp,endereco,numero,created_at",
    "whatsapp,endereco,created_at",
  ];

  for (const selectCols of tentativasSelect) {
    let query = supabase
      .from("clientes")
      .select(selectCols)
      .order("created_at", { ascending: false })
      .limit(limite);

    if (filtro.tipo === "eq") {
      query = query.eq(filtro.coluna, filtro.valor);
    } else {
      query = query.ilike(filtro.coluna, filtro.valor);
    }

    const { data, error } = await query;
    if (!error) {
      return (Array.isArray(data) ? data : []) as ClienteEndereco[];
    }
  }

  return [] as ClienteEndereco[];
}

async function buscarResumoPedidoPorReferencia(referencia: string): Promise<PedidoResumo | null> {
  const ref = String(referencia || "").trim();
  if (!ref) return null;

  const supabase = getServiceSupabase();
  if (!supabase) return null;

  const tentativasSelectPedido = [
    "id,total,cliente_nome,whatsapp,itens,forma_pagamento,pagamento_referencia,observacao,endereco,numero,bairro,cidade,cep,ponto_referencia,created_at",
    "id,total,cliente_nome,whatsapp,itens,forma_pagamento,pagamento_referencia,observacao,endereco,numero,bairro,cidade,ponto_referencia,created_at",
    "id,total,cliente_nome,whatsapp,itens,forma_pagamento,pagamento_referencia,observacao,created_at",
    "id,total,cliente_nome,whatsapp,itens,forma_pagamento,pagamento_referencia,created_at",
  ];

  let pedido = null as Record<string, unknown> | null;
  for (const selectCols of tentativasSelectPedido) {
    const { data, error } = await supabase
      .from("pedidos")
      .select(selectCols)
      .eq("pagamento_referencia", ref)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      pedido = data as unknown as Record<string, unknown>;
      break;
    }
  }

  if (!pedido) return null;

  const whatsapp = String(pedido.whatsapp || "").trim();
  const clienteNome = String(pedido.cliente_nome || "").trim();
  const formaPagamento = String(pedido.forma_pagamento || "Pix").trim();
  const itens = parseItensPedido(pedido.itens);
  const total = Number(pedido.total || 0);
  const retiradaNoBalcao = pedidoEhRetiradaNoBalcao(String(pedido.observacao || ""));

  let enderecoCompleto = retiradaNoBalcao ? LOJA_ENDERECO_RETIRADA_RESUMO : "";
  let pontoReferencia = "";

  if (!retiradaNoBalcao) {
    const enderecoBrutoPedido = String(pedido.endereco || "").trim();
    const numeroPedido = String(pedido.numero || "").trim();
    const bairroPedido = String(pedido.bairro || "").trim();
    const cidadePedido = String(pedido.cidade || "").trim();
    const cepPedido = String(pedido.cep || "").trim();
    const pontoDiretoPedido = String(pedido.ponto_referencia || "").trim();

    if (enderecoBrutoPedido) {
      const pontoExtraidoPedido = extrairPontoReferenciaDeEndereco(enderecoBrutoPedido);
      const enderecoLimpoPedido = limparEnderecoDePontoReferencia(enderecoBrutoPedido);
      enderecoCompleto = montarEnderecoCompleto(
        enderecoLimpoPedido,
        numeroPedido,
        bairroPedido,
        cidadePedido,
        cepPedido,
      );
      pontoReferencia = pontoDiretoPedido || pontoExtraidoPedido;
    }
  }

  const whatsappNormalizado = normalizarNumero(whatsapp);
  if (!retiradaNoBalcao && !enderecoCompleto && whatsappNormalizado.length >= 10) {
    const exatos = await buscarClientesComSchemaFlexivel(
      supabase,
      { tipo: "eq", coluna: "whatsapp", valor: whatsappNormalizado },
      5,
    );
    let cliente: ClienteEndereco | null = exatos[0] || null;

    if (!cliente) {
      const sufixo = whatsappNormalizado.slice(-8);
      const candidatos = await buscarClientesComSchemaFlexivel(
        supabase,
        { tipo: "ilike", coluna: "whatsapp", valor: `%${sufixo}%` },
        30,
      );

      cliente =
        (candidatos || []).find((c) => whatsappEquivalente(String(c.whatsapp || ""), whatsappNormalizado)) || null;
    }

    if (!cliente) {
      const nomeBusca = String(clienteNome || "").trim();
      if (nomeBusca) {
        const porNome = await buscarClientesComSchemaFlexivel(
          supabase,
          { tipo: "ilike", coluna: "nome", valor: `%${nomeBusca}%` },
          10,
        );
        cliente = porNome[0] || null;
      }
    }

    if (cliente) {
      const enderecoBruto = String(cliente.endereco || "").trim();
      const numero = String(cliente.numero || "").trim();
      const pontoDireto = String(cliente.ponto_referencia || "").trim();
      const pontoExtraido = extrairPontoReferenciaDeEndereco(enderecoBruto);
      const enderecoLimpo = limparEnderecoDePontoReferencia(enderecoBruto);
      enderecoCompleto = montarEnderecoCompleto(enderecoLimpo, numero, "", "", "");
      pontoReferencia = pontoDireto || pontoExtraido;
    }
  }

  return {
    clienteNome,
    referencia: String(pedido.pagamento_referencia || ref),
    total: Number.isFinite(total) ? total : 0,
    formaPagamento,
    whatsapp,
    itens,
    enderecoCompleto,
    pontoReferencia,
    retiradaNoBalcao,
  };
}

function montarMensagemWhatsappPadraoPedido(
  pedido: PedidoResumo | null,
  fallback: {
    clienteNome: string;
    tituloStatus: string;
    status: string;
    transactionId: string;
    referencia: string;
  },
) {
  if (pedido) {
    const itensFormatados =
      pedido.itens.length > 0
        ? pedido.itens.map((i) => `- ${i.qtd}x ${i.nome}`).join("\n")
        : "- Itens não informados";
    const linhaRecebimento = pedido.retiradaNoBalcao
      ? `Retirada no balcão: ${pedido.enderecoCompleto || LOJA_ENDERECO_RETIRADA_RESUMO}\n`
      : `Endereço: ${pedido.enderecoCompleto || "Não informado"}\n`;
    const linhaPontoReferencia =
      pedido.retiradaNoBalcao || !pedido.pontoReferencia
        ? ""
        : `Ponto de referência: ${pedido.pontoReferencia}\n`;

    return (
      `Pedido Dulelis\n\n` +
      `Cliente: ${pedido.clienteNome || fallback.clienteNome || "Cliente"}\n` +
      linhaRecebimento +
      linhaPontoReferencia +
      `Pagamento: ${pedido.formaPagamento || "Pix"}\n\n` +
      `Itens:\n${itensFormatados}\n\n` +
      `Total: R$ ${pedido.total.toFixed(2)}\n` +
      `Referência do pedido: ${pedido.referencia}\n` +
      (fallback.transactionId ? `Transação: ${fallback.transactionId}\n` : "") +
      `Status do pagamento: ${fallback.status || "indisponível"}.\n` +
      `Pode confirmar meu pedido, por favor?`
    );
  }

  return [
    fallback.clienteNome ? `Olá, sou ${fallback.clienteNome.replace(/\+/g, " ").trim()}.` : "Olá!",
    `${fallback.tituloStatus}.`,
    fallback.status ? `Status do pagamento: ${fallback.status}.` : "",
    fallback.transactionId ? `Transação: ${fallback.transactionId}.` : "",
    fallback.referencia ? `Referência do pedido: ${fallback.referencia}.` : "",
    "Pode confirmar meu pedido, por favor?",
  ]
    .filter(Boolean)
    .join(" ");
}

type RetornoPagamentoPageProps = {
  searchParams: Promise<{
    transaction_id?: string;
    status?: string;
    ref?: string;
    cliente_nome?: string;
  }>;
};

export default async function RetornoPagamentoPage({ searchParams }: RetornoPagamentoPageProps) {
  const params = await searchParams;
  const transactionId = params.transaction_id ?? "";
  const status = params.status ?? "";
  const referencia = params.ref ?? "";
  const clienteNome = String(params.cliente_nome || "").trim();
  const info = getStatusInfo(status);
  const aprovado = ["paid", "approved", "pago", "authorized"].includes(status.trim().toLowerCase());
  const statusNormalizado = status.trim();
  const pedidoResumo = await buscarResumoPedidoPorReferencia(referencia);
  const mensagemWhatsapp = montarMensagemWhatsappPadraoPedido(pedidoResumo, {
    clienteNome,
    tituloStatus: info.titulo,
    status: statusNormalizado,
    transactionId,
    referencia,
  });
  const whatsappLink = `https://wa.me/${WHATSAPP_LOJA}?text=${encodeURIComponent(mensagemWhatsapp)}`;

  return (
    <main className="min-h-screen bg-[#FDFCFD] text-slate-900 flex items-center justify-center p-6">
      <section className={`w-full max-w-md rounded-3xl border p-7 shadow-sm ${info.card}`}>
        <div className="flex items-center gap-3 mb-4">
          <info.Icone className={info.cor} size={28} />
          <h1 className={`text-xl font-black ${info.cor}`}>{info.titulo}</h1>
        </div>

        <p className="text-sm text-slate-700 mb-5">{info.descricao}</p>
        {transactionId ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1">
              Código da transação
            </p>
            <p className="text-sm font-mono break-all text-slate-700">{transactionId}</p>
          </div>
        ) : null}
        {pedidoResumo ? (
          <div
            className={`rounded-2xl border p-4 mb-5 ${
              pedidoResumo.retiradaNoBalcao ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"
            }`}
          >
            <p
              className={`text-[11px] font-bold uppercase tracking-widest ${
                pedidoResumo.retiradaNoBalcao ? "text-emerald-700" : "text-slate-400"
              }`}
            >
              {pedidoResumo.retiradaNoBalcao ? "Retirada no balcão" : "Recebimento"}
            </p>
            <p className="mt-2 text-sm font-bold text-slate-800">
              {pedidoResumo.enderecoCompleto || "Endereço não informado"}
            </p>
            {pedidoResumo.retiradaNoBalcao ? (
              <>
                <p className="mt-2 text-xs font-medium text-slate-600">
                  Seu pedido será separado na loja para retirada.
                </p>
                <a
                  href={LOJA_LINK_MAPS_RETIRADA}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-white px-3 py-2 text-[11px] font-black uppercase tracking-widest text-emerald-700 transition-colors hover:bg-emerald-100"
                >
                  <MapPin size={14} />
                  Abrir retirada no Maps
                </a>
              </>
            ) : pedidoResumo.pontoReferencia ? (
              <p className="mt-2 text-xs font-medium text-slate-600">
                Ponto de referência: {pedidoResumo.pontoReferencia}
              </p>
            ) : null}
          </div>
        ) : null}
        <RetornoActions
          whatsappLink={whatsappLink}
          refCode={referencia}
          autoRedirect={aprovado && !pedidoResumo?.retiradaNoBalcao}
          retiradaNoBalcao={Boolean(pedidoResumo?.retiradaNoBalcao)}
        />
      </section>
    </main>
  );
}
