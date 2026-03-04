import { CheckCircle2, Clock3, CreditCard, XCircle } from "lucide-react";
import RetornoActions from "./RetornoActions";
import { getServiceSupabase } from "@/lib/server-supabase";

const WHATSAPP_LOJA = "5547988347100";

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
};

function normalizarNumero(value: string): string {
  return String(value || "").replace(/\D/g, "");
}

function whatsappEquivalente(a: string, b: string): boolean {
  const wa = normalizarNumero(a);
  const wb = normalizarNumero(b);
  if (!wa || !wb) return false;
  if (wa === wb) return true;
  return wa.slice(-10) === wb.slice(-10);
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

async function buscarResumoPedidoPorReferencia(referencia: string): Promise<PedidoResumo | null> {
  const ref = String(referencia || "").trim();
  if (!ref) return null;

  const supabase = getServiceSupabase();
  if (!supabase) return null;

  const { data: pedido, error: erroPedido } = await supabase
    .from("pedidos")
    .select("id,total,cliente_nome,whatsapp,itens,forma_pagamento,pagamento_referencia,created_at")
    .eq("pagamento_referencia", ref)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (erroPedido || !pedido) return null;

  const whatsapp = String(pedido.whatsapp || "").trim();
  const clienteNome = String(pedido.cliente_nome || "").trim();
  const formaPagamento = String(pedido.forma_pagamento || "Pix/Cartao").trim();
  const itens = parseItensPedido((pedido as { itens?: unknown }).itens);
  const total = Number(pedido.total || 0);

  let enderecoCompleto = "";
  let pontoReferencia = "";
  const whatsappNormalizado = normalizarNumero(whatsapp);
  if (whatsappNormalizado.length >= 10) {
    const { data: clienteExato } = await supabase
      .from("clientes")
      .select("whatsapp,endereco,numero,ponto_referencia,created_at")
      .eq("whatsapp", whatsappNormalizado)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let cliente = clienteExato as
      | { whatsapp?: string | null; endereco?: string | null; numero?: string | null; ponto_referencia?: string | null }
      | null;

    if (!cliente) {
      const sufixo = whatsappNormalizado.slice(-8);
      const { data: candidatos } = await supabase
        .from("clientes")
        .select("whatsapp,endereco,numero,ponto_referencia,created_at")
        .ilike("whatsapp", `%${sufixo}%`)
        .order("created_at", { ascending: false })
        .limit(30);

      cliente =
        ((candidatos || []) as Array<{
          whatsapp?: string | null;
          endereco?: string | null;
          numero?: string | null;
          ponto_referencia?: string | null;
        }>).find((c) => whatsappEquivalente(String(c.whatsapp || ""), whatsappNormalizado)) || null;
    }

    if (!cliente) {
      const { data: clienteCru } = await supabase
        .from("clientes")
        .select("whatsapp,endereco,numero,ponto_referencia,created_at")
        .eq("whatsapp", whatsapp)
        .order("created_at", { ascending: false })
        .limit(1)
      .maybeSingle();
      cliente = (clienteCru || null) as
        | { whatsapp?: string | null; endereco?: string | null; numero?: string | null; ponto_referencia?: string | null }
        | null;
    }

    if (cliente) {
      const enderecoBruto = String(cliente.endereco || "").trim();
      const numero = String(cliente.numero || "").trim();
      const pontoDireto = String(cliente.ponto_referencia || "").trim();
      const pontoExtraido = extrairPontoReferenciaDeEndereco(enderecoBruto);
      const enderecoLimpo = limparEnderecoDePontoReferencia(enderecoBruto);
      enderecoCompleto = [enderecoLimpo, numero].filter(Boolean).join(", ").trim();
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
        : "- Itens nao informados";

    return (
      `Pedido Dulelis\n\n` +
      `Cliente: ${pedido.clienteNome || fallback.clienteNome || "Cliente"}\n` +
      `Endereco: ${pedido.enderecoCompleto || "Nao informado"}\n` +
      `Ponto de Referencia: ${pedido.pontoReferencia || "Nao informado"}\n` +
      `Pagamento: ${pedido.formaPagamento || "Pix/Cartao"}\n\n` +
      `Itens:\n${itensFormatados}\n\n` +
      `Total: R$ ${pedido.total.toFixed(2)}\n` +
      `Referencia do pedido: ${pedido.referencia}\n` +
      (fallback.transactionId ? `Transacao: ${fallback.transactionId}\n` : "") +
      `Status do pagamento: ${fallback.status || "indisponivel"}.\n` +
      `Pode confirmar meu pedido, por favor?`
    );
  }

  return [
    fallback.clienteNome ? `Ola, sou ${fallback.clienteNome.replace(/\+/g, " ").trim()}.` : "Ola!",
    `${fallback.tituloStatus}.`,
    fallback.status ? `Status do pagamento: ${fallback.status}.` : "",
    fallback.transactionId ? `Transacao: ${fallback.transactionId}.` : "",
    fallback.referencia ? `Referencia do pedido: ${fallback.referencia}.` : "",
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
        <RetornoActions
          whatsappLink={whatsappLink}
          refCode={referencia}
          autoRedirect={aprovado}
        />
      </section>
    </main>
  );
}


