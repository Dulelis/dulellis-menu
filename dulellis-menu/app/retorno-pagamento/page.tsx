import Link from "next/link";
import { CheckCircle2, Clock3, CreditCard, XCircle } from "lucide-react";

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

type RetornoPagamentoPageProps = {
  searchParams: Promise<{
    transaction_id?: string;
    status?: string;
  }>;
};

export default async function RetornoPagamentoPage({ searchParams }: RetornoPagamentoPageProps) {
  const params = await searchParams;
  const transactionId = params.transaction_id ?? "";
  const status = params.status ?? "";
  const info = getStatusInfo(status);

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

        <Link
          href="/"
          className="block w-full text-center bg-pink-600 text-white py-3 rounded-2xl font-black uppercase tracking-wider text-sm"
        >
          Voltar para o cardápio
        </Link>
      </section>
    </main>
  );
}

