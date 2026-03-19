"use client";

import { useEffect, useState } from "react";
import { Bike, Loader2, MapPin, Navigation, PackageCheck } from "lucide-react";

type Entregador = {
  id: number;
  nome?: string | null;
  whatsapp?: string | null;
  modelo_moto?: string | null;
  placa_moto?: string | null;
  cor_moto?: string | null;
};

type Entrega = {
  id?: number;
  entregador_id?: number | null;
  status?: string | null;
  aceito_em?: string | null;
  concluido_em?: string | null;
  acerto_status?: string | null;
  observacao?: string | null;
};

type PedidoEntrega = {
  id?: number;
  cliente_nome?: string | null;
  endereco?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  cep?: string | null;
  ponto_referencia?: string | null;
  total?: number | null;
  taxa_entrega?: number | null;
  maps_url?: string | null;
};

type ApiResponse = {
  ok?: boolean;
  error?: string;
  data?: {
    pedido?: PedidoEntrega | null;
    entregadores?: Entregador[];
    entrega?: Entrega | null;
  };
};

type Props = {
  pedidoId: number;
};

export default function EntregaPageClient({ pedidoId }: Props) {
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [pedido, setPedido] = useState<PedidoEntrega | null>(null);
  const [entrega, setEntrega] = useState<Entrega | null>(null);
  const [entregadores, setEntregadores] = useState<Entregador[]>([]);
  const [entregadorId, setEntregadorId] = useState<number>(0);
  const [codigoTelefone, setCodigoTelefone] = useState("");

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      setCarregando(true);
      setErro("");
      try {
        const res = await fetch(`/api/public/delivery?pedido=${pedidoId}`, { cache: "no-store" });
        const json = (await res.json().catch(() => ({}))) as ApiResponse;
        if (!res.ok || json.ok === false || !json.data?.pedido) {
          throw new Error(json.error || "Nao foi possivel carregar os dados da entrega.");
        }
        if (!ativo) return;
        setPedido(json.data.pedido);
        setEntrega(json.data.entrega || null);
        setEntregadores(json.data.entregadores || []);
        setEntregadorId(Number(json.data.entrega?.entregador_id || json.data.entregadores?.[0]?.id || 0));
      } catch (error) {
        if (!ativo) return;
        setErro(error instanceof Error ? error.message : "Falha ao carregar a entrega.");
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    if (pedidoId > 0) {
      void carregar();
    } else {
      setCarregando(false);
      setErro("Pedido invalido.");
    }

    return () => {
      ativo = false;
    };
  }, [pedidoId]);

  const entregadorAtual =
    entregadores.find((item) => Number(item.id) === Number(entrega?.entregador_id || entregadorId)) || null;
  const entregaAceita = Boolean(entrega?.aceito_em);
  const entregaFinalizada = String(entrega?.status || "").trim().toLowerCase() === "finalizada";

  async function aceitarEntrega() {
    if (!entregadorId) {
      setErro("Selecione um entregador.");
      return;
    }
    if (codigoTelefone.replace(/\D/g, "").length !== 4) {
      setErro("Digite os 4 ultimos numeros do telefone do entregador.");
      return;
    }

    setSalvando(true);
    setErro("");
    setSucesso("");
    try {
      const res = await fetch("/api/public/delivery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "accept",
          pedido_id: pedidoId,
          entregador_id: entregadorId,
          phone_suffix: codigoTelefone,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        data?: { entrega?: Entrega | null; entregador?: { nome?: string | null } | null };
      };
      if (!res.ok || json.ok === false || !json.data?.entrega) {
        throw new Error(json.error || "Nao foi possivel aceitar a entrega.");
      }
      setEntrega(json.data.entrega);
      setSucesso(
        json.data.entregador?.nome
          ? `Entrega aceita por ${json.data.entregador.nome}.`
          : "Entrega aceita com sucesso.",
      );
      setCodigoTelefone("");
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao aceitar entrega.");
    } finally {
      setSalvando(false);
    }
  }

  async function finalizarEntrega() {
    setSalvando(true);
    setErro("");
    setSucesso("");
    try {
      const res = await fetch("/api/public/delivery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "finish", pedido_id: pedidoId }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        data?: { entrega?: Entrega | null };
      };
      if (!res.ok || json.ok === false || !json.data?.entrega) {
        throw new Error(json.error || "Nao foi possivel finalizar a entrega.");
      }
      setEntrega(json.data.entrega);
      setSucesso("Entrega finalizada com sucesso.");
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao finalizar entrega.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#ffe7d6,_#fff8f1_55%,_#ffffff)] px-4 py-8 text-slate-900">
      <section className="mx-auto max-w-xl rounded-[2rem] border border-orange-200 bg-white/95 p-6 shadow-[0_25px_80px_-35px_rgba(234,88,12,0.45)] backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
            <Bike size={24} />
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-orange-500">Entrega</p>
            <h1 className="text-2xl font-black text-slate-900">Aceite do entregador</h1>
          </div>
        </div>

        {carregando ? (
          <div className="flex min-h-60 items-center justify-center">
            <Loader2 className="animate-spin text-orange-500" size={28} />
          </div>
        ) : erro ? (
          <div className="mt-6 rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm font-bold text-rose-700">
            {erro}
          </div>
        ) : pedido ? (
          <div className="mt-6 space-y-5">
            <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">Pedido</p>
                  <p className="mt-1 text-2xl font-black text-slate-900">#{pedido.id}</p>
                </div>
                <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-right">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Total</p>
                  <p className="text-lg font-black text-emerald-700">R$ {Number(pedido.total || 0).toFixed(2)}</p>
                </div>
              </div>
              <p className="mt-4 text-sm font-black text-slate-800">{pedido.cliente_nome || "Cliente"}</p>
              <div className="mt-3 flex items-start gap-2 text-sm font-medium text-slate-700">
                <MapPin size={16} className="mt-0.5 shrink-0 text-orange-500" />
                <div>
                  <p>{[pedido.endereco, pedido.numero].filter(Boolean).join(", ") || "Endereco nao informado"}</p>
                  <p>{[pedido.bairro, pedido.cidade].filter(Boolean).join(" - ") || "Local nao informado"}</p>
                  <p>CEP: {pedido.cep || "Nao informado"}</p>
                  <p>Ponto: {pedido.ponto_referencia || "Nao informado"}</p>
                </div>
              </div>
              {pedido.maps_url ? (
                <a
                  href={pedido.maps_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black uppercase tracking-widest text-white transition-colors hover:bg-slate-800"
                >
                  <Navigation size={16} />
                  Abrir no Maps
                </a>
              ) : null}
            </div>

            <div className="rounded-[1.75rem] border border-orange-200 bg-orange-50 p-5">
              <p className="text-[11px] font-black uppercase tracking-[0.25em] text-orange-600">Entregador</p>
              <p className="mt-1 text-sm font-bold text-slate-600">
                {entregaAceita
                  ? "Entrega ja assumida. Finalize quando concluir."
                  : "Selecione quem vai assumir a entrega e confirme com os 4 ultimos digitos do telefone."}
              </p>

              {!entregaAceita ? (
                <>
                  <select
                    className="mt-4 w-full rounded-2xl border border-orange-200 bg-white px-4 py-4 font-bold text-slate-700 outline-none"
                    value={entregadorId}
                    onChange={(event) => setEntregadorId(Number(event.target.value))}
                  >
                    <option value={0}>Selecione um entregador</option>
                    {entregadores.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nome}
                        {item.modelo_moto ? ` - ${item.modelo_moto}` : ""}
                        {item.placa_moto ? ` (${item.placa_moto})` : ""}
                      </option>
                    ))}
                  </select>
                  <input
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="4 ultimos numeros do telefone"
                    className="mt-3 w-full rounded-2xl border border-orange-200 bg-white px-4 py-4 font-black tracking-[0.35em] text-slate-700 outline-none"
                    value={codigoTelefone}
                    onChange={(event) => setCodigoTelefone(event.target.value.replace(/\D/g, "").slice(0, 4))}
                  />
                </>
              ) : null}

              {entregadorAtual ? (
                <div className="mt-4 rounded-2xl border border-white/70 bg-white/90 p-4 text-sm font-medium text-slate-700">
                  <p className="font-black text-slate-900">{entregadorAtual.nome || "Entregador"}</p>
                  <p>{entregadorAtual.whatsapp || "WhatsApp nao informado"}</p>
                  <p>
                    {[entregadorAtual.modelo_moto, entregadorAtual.cor_moto, entregadorAtual.placa_moto]
                      .filter(Boolean)
                      .join(" • ") || "Moto nao informada"}
                  </p>
                </div>
              ) : null}

              {sucesso ? (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
                  {sucesso}
                </div>
              ) : null}

              {entrega?.aceito_em ? (
                <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">
                  Entrega registrada em {new Date(String(entrega.aceito_em)).toLocaleString("pt-BR")}
                  {entregaFinalizada && entrega?.concluido_em
                    ? ` e finalizada em ${new Date(String(entrega.concluido_em)).toLocaleString("pt-BR")}.`
                    : entrega?.acerto_status === "acertado"
                      ? " e ja consta como acertada."
                      : "."}
                </div>
              ) : null}

              {entrega?.observacao ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600">
                  <strong className="text-slate-900">Ponto final:</strong> {entrega.observacao}
                </div>
              ) : null}

              {!entregaAceita ? (
                <button
                  type="button"
                  onClick={() => void aceitarEntrega()}
                  disabled={salvando || !entregadores.length}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-600 px-4 py-4 text-sm font-black uppercase tracking-widest text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {salvando ? <Loader2 className="animate-spin" size={16} /> : <PackageCheck size={16} />}
                  Aceitar entrega
                </button>
              ) : null}

              {entregaAceita && !entregaFinalizada ? (
                <button
                  type="button"
                  onClick={() => void finalizarEntrega()}
                  disabled={salvando}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-4 text-sm font-black uppercase tracking-widest text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {salvando ? <Loader2 className="animate-spin" size={16} /> : <PackageCheck size={16} />}
                  Finalizar entrega
                </button>
              ) : null}

              {!entregadores.length ? (
                <p className="mt-4 text-sm font-bold text-rose-600">
                  Nenhum entregador ativo cadastrado no admin.
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
