"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft,
  Bike,
  CheckCircle2,
  ChevronRight,
  Hash,
  Loader2,
  Minus,
  Phone,
  Plus,
  ShoppingBag,
  User,
  X,
} from "lucide-react";

const LOJA_LAT = -26.8941;
const LOJA_LNG = -48.6538;
const DISTANCE_MULTIPLIER = 1.3;
const DEFAULT_CITY = "Navegantes";
const CIDADE_ATENDIDA = "Navegantes";
const CATEGORIAS = ["Todos", "Doces", "Bolos", "Salgados", "Bebidas"];
const FORMAS_PAGAMENTO = ["Pix", "Dinheiro", "Cartao de Debito", "Cartao de Credito"];
const CHAVE_PIX = "47988347100";
const FORMAS_CARTAO = ["Cartao de Debito", "Cartao de Credito"];

type Cliente = {
  nome: string;
  whatsapp: string;
  cep: string;
  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
  observacao: string;
  data_aniversario: string;
};

type ClienteRow = Partial<Cliente> & {
  id?: number;
  created_at?: string;
  whatsapp?: string | null;
  cep?: string | number | null;
};

type Produto = {
  id: number;
  nome: string;
  categoria: string;
  preco: number;
  quantidade: number;
  imagem_url?: string | null;
};

type ItemCarrinho = Produto & {
  qtd: number;
};

type TaxaEntregaRow = {
  bairro: string;
  taxa: number | string;
};

type CepApiResponse = {
  address?: string;
  district?: string;
  city?: string;
  lat?: string;
  lng?: string;
};

const CLIENTE_INICIAL: Cliente = {
  nome: "",
  whatsapp: "",
  cep: "",
  endereco: "",
  numero: "",
  bairro: "",
  cidade: DEFAULT_CITY,
  observacao: "",
  data_aniversario: "",
};

function normalizarNumero(valor: string) {
  return valor.replace(/\D/g, "");
}

function normalizarTexto(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function calcularDistanciaKm(lat: number, lng: number) {
  const R = 6371;
  const dLat = ((lat - LOJA_LAT) * Math.PI) / 180;
  const dLon = ((lng - LOJA_LNG) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((LOJA_LAT * Math.PI) / 180) *
      Math.cos((lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c * DISTANCE_MULTIPLIER;
}

export default function ClientePage() {
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [taxas, setTaxas] = useState<TaxaEntregaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [processandoCartao, setProcessandoCartao] = useState(false);
  const [abaCarrinho, setAbaCarrinho] = useState(false);
  const [passo, setPasso] = useState(1);
  const [categoriaAtiva, setCategoriaAtiva] = useState("Todos");
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [buscandoCliente, setBuscandoCliente] = useState(false);
  const [clienteEncontrado, setClienteEncontrado] = useState(false);
  const [distanciaKm, setDistanciaKm] = useState<number | null>(null);
  const [taxaEntrega, setTaxaEntrega] = useState<number>(0);
  const [msgTaxa, setMsgTaxa] = useState("Aguardando endereço...");
  const [cliente, setCliente] = useState<Cliente>(CLIENTE_INICIAL);
  const [formaPagamento, setFormaPagamento] = useState("");
  const [pixCopiado, setPixCopiado] = useState(false);

  const subtotal = useMemo(
    () => carrinho.reduce((acc, i) => acc + i.preco * i.qtd, 0),
    [carrinho],
  );
  const totalGeral = useMemo(() => subtotal + taxaEntrega, [subtotal, taxaEntrega]);

  const carregarDadosIniciais = useCallback(async () => {
    try {
      setLoading(true);

      const [{ data: resProdutos, error: errProd }, { data: resTaxas, error: errTax }] =
        await Promise.all([
          supabase.from("estoque").select("*").order("nome"),
          supabase.from("taxas_entrega").select("*"),
        ]);

      if (errProd || errTax) {
        throw new Error("Erro ao conectar com Supabase");
      }

      setProdutos((resProdutos ?? []) as Produto[]);
      setTaxas((resTaxas ?? []) as TaxaEntregaRow[]);
    } catch (e) {
      console.error("Erro Supabase:", e);
      alert("Erro ao carregar cardápio. Verifique sua conexão.");
    } finally {
      setLoading(false);
    }
  }, []);

  const executarBuscaCep = useCallback(
    async (valor: string) => {
      const cepLimpo = normalizarNumero(valor).slice(0, 8);
      setCliente((prev) => ({ ...prev, cep: cepLimpo }));

      if (cepLimpo.length !== 8) return;

      setBuscandoCep(true);
      try {
        const res = await fetch(`https://cep.awesomeapi.com.br/json/${cepLimpo}`);
        if (!res.ok) throw new Error("Falha ao consultar CEP");

        const data = (await res.json()) as CepApiResponse;

        if (data.address) {
          setCliente((prev) => ({
            ...prev,
            endereco: data.address ?? prev.endereco,
            bairro: data.district ?? prev.bairro,
            cidade: data.city ?? prev.cidade,
          }));
        }

        const cidadeCep = data.city ?? cliente.cidade;
        const atendeCidade =
          normalizarTexto(cidadeCep) === normalizarTexto(CIDADE_ATENDIDA);

        if (!atendeCidade) {
          setDistanciaKm(null);
          setTaxaEntrega(0);
          setMsgTaxa("Entrega somente em Navegantes. Outras localidades: verificar disponibilidade.");
          return;
        }

        if (data.lat && data.lng) {
          const distReal = calcularDistanciaKm(Number(data.lat), Number(data.lng));
          setDistanciaKm(distReal);

          const taxasOrdenadas = taxas
            .map((t) => {
              const match = t.bairro.match(/\d+/);
              return { ...t, kmLimite: match ? Number.parseInt(match[0], 10) : 999 };
            })
            .sort((a, b) => a.kmLimite - b.kmLimite);

          const encontrada = taxasOrdenadas.find((t) => distReal <= t.kmLimite);

          if (encontrada) {
            const valorTaxa = Number(encontrada.taxa) || 0;
            setTaxaEntrega(valorTaxa);
            setMsgTaxa(`Entrega: R$ ${valorTaxa.toFixed(2)} (${distReal.toFixed(1)} km)`);
          } else {
            setTaxaEntrega(0);
            setMsgTaxa(`Distância: ${distReal.toFixed(1)} km. Consultar taxa.`);
          }
        } else {
          setDistanciaKm(null);
          setTaxaEntrega(0);
          setMsgTaxa("Não foi possível calcular o frete por este CEP.");
        }
      } catch {
        setDistanciaKm(null);
        setTaxaEntrega(0);
        setMsgTaxa("Erro ao calcular frete.");
      } finally {
        setBuscandoCep(false);
      }
    },
    [cliente.cidade, taxas],
  );

  const executarBuscaCliente = useCallback(
    async (zap: string) => {
      setBuscandoCliente(true);
      try {
        // Primeiro tenta busca exata (rápida) pelo número normalizado.
        const { data: exato, error: erroExato } = await supabase
          .from("clientes")
          .select("*")
          .eq("whatsapp", zap)
          .maybeSingle();

        if (erroExato) throw erroExato;

        let clienteEncontradoDb: ClienteRow | null = exato as ClienteRow | null;

        // Fallback para dados antigos salvos com máscara de telefone.
        if (!clienteEncontradoDb) {
          const sufixo = zap.slice(-8);
          const { data: candidatos, error: erroCandidatos } = await supabase
            .from("clientes")
            .select("*")
            .ilike("whatsapp", `%${sufixo}%`)
            .order("created_at", { ascending: false })
            .limit(30);

          if (erroCandidatos) throw erroCandidatos;

          clienteEncontradoDb =
            ((candidatos as ClienteRow[] | null) ?? []).find(
              (c) => normalizarNumero(String(c.whatsapp ?? "")) === zap,
            ) ?? null;
        }

        if (!clienteEncontradoDb) {
          setClienteEncontrado(false);
          return;
        }

        const cepNormalizado = normalizarNumero(String(clienteEncontradoDb.cep ?? "")).slice(0, 8);

        setCliente((prev) => ({
          ...prev,
          nome: String(clienteEncontradoDb.nome ?? ""),
          whatsapp: zap,
          cep: cepNormalizado,
          endereco: String(clienteEncontradoDb.endereco ?? ""),
          numero: String(clienteEncontradoDb.numero ?? ""),
          bairro: String(clienteEncontradoDb.bairro ?? ""),
          cidade: String(clienteEncontradoDb.cidade ?? DEFAULT_CITY),
          observacao: String(clienteEncontradoDb.observacao ?? ""),
          data_aniversario: String(clienteEncontradoDb.data_aniversario ?? ""),
        }));
        setClienteEncontrado(true);

        if (cepNormalizado.length === 8) {
          await executarBuscaCep(cepNormalizado);
        }
      } catch {
        setClienteEncontrado(false);
      } finally {
        setBuscandoCliente(false);
      }
    },
    [executarBuscaCep],
  );

  useEffect(() => {
    carregarDadosIniciais();
  }, [carregarDadosIniciais]);

  useEffect(() => {
    const zapLimpo = normalizarNumero(cliente.whatsapp);
    if (zapLimpo.length >= 10) {
      const timer = setTimeout(() => {
        executarBuscaCliente(zapLimpo);
      }, 500);
      return () => clearTimeout(timer);
    }

    setClienteEncontrado(false);
  }, [cliente.whatsapp, executarBuscaCliente]);

  const adicionarAoCarrinho = useCallback(
    (produto: Produto | ItemCarrinho) => {
      setCarrinho((prevCarrinho) => {
        const produtoOriginal = produtos.find((i) => i.id === produto.id);
        if (!produtoOriginal) return prevCarrinho;

        const existente = prevCarrinho.find((i) => i.id === produto.id);

        if (existente) {
          if (existente.qtd >= produtoOriginal.quantidade) {
            alert("Limite de estoque!");
            return prevCarrinho;
          }

          return prevCarrinho.map((i) =>
            i.id === produto.id ? { ...i, qtd: i.qtd + 1 } : i,
          );
        }

        return [...prevCarrinho, { ...produtoOriginal, qtd: 1 }];
      });
    },
    [produtos],
  );

  const removerDoCarrinho = useCallback((id: number) => {
    setCarrinho((prevCarrinho) => {
      const item = prevCarrinho.find((i) => i.id === id);
      if (!item) return prevCarrinho;
      if (item.qtd > 1) {
        return prevCarrinho.map((i) => (i.id === id ? { ...i, qtd: i.qtd - 1 } : i));
      }
      return prevCarrinho.filter((i) => i.id !== id);
    });
  }, []);
  const limparCarrinho = useCallback(() => {
    setCarrinho([]);
    setAbaCarrinho(false);
    setPasso(1);
    setFormaPagamento("");
    setPixCopiado(false);
  }, []);
  const selecionarFormaPagamento = useCallback(async (forma: string) => {
    setFormaPagamento(forma);

    if (forma !== "Pix") {
      setPixCopiado(false);
      return;
    }

    try {
      await navigator.clipboard.writeText(CHAVE_PIX);
      setPixCopiado(true);
      setTimeout(() => setPixCopiado(false), 1800);
    } catch {
      setPixCopiado(false);
      alert("Nao foi possivel copiar a chave Pix automaticamente.");
    }
  }, []);

  const finalizarPedido = useCallback(async () => {
    if (!carrinho.length) return;

    setLoading(true);
    try {
      let avisoPagamento = "";
      const whatsappLimpo = normalizarNumero(cliente.whatsapp);
      const payloadCliente = { ...cliente, whatsapp: whatsappLimpo };

      const { data: clienteExistente, error: erroBuscaCliente } = await supabase
        .from("clientes")
        .select("id")
        .eq("whatsapp", whatsappLimpo)
        .single();

      if (erroBuscaCliente && erroBuscaCliente.code !== "PGRST116") {
        throw erroBuscaCliente;
      }

      if (!clienteExistente) {
        const { error: erroInsertCliente } = await supabase
          .from("clientes")
          .insert([payloadCliente]);
        if (erroInsertCliente) throw erroInsertCliente;
      } else {
        const { error: erroUpdateCliente } = await supabase
          .from("clientes")
          .update(payloadCliente)
          .eq("whatsapp", whatsappLimpo);
        if (erroUpdateCliente) throw erroUpdateCliente;
      }

      const { error: erroPedido } = await supabase.from("pedidos").insert([
        {
          cliente_nome: payloadCliente.nome,
          whatsapp: payloadCliente.whatsapp,
          itens: carrinho,
          total: totalGeral,
        },
      ]);

      if (erroPedido) throw erroPedido;

      if (FORMAS_CARTAO.includes(formaPagamento)) {
        setProcessandoCartao(true);
        const respostaPagamento = await fetch("/api/pagamento/cartao", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            formaPagamento,
            total: totalGeral,
            cliente: {
              nome: payloadCliente.nome,
              whatsapp: payloadCliente.whatsapp,
            },
            itens: carrinho.map((item) => ({
              id: item.id,
              nome: item.nome,
              qtd: item.qtd,
              preco: item.preco,
            })),
          }),
        });

        if (!respostaPagamento.ok) {
          const corpoBruto = await respostaPagamento.text();
          let erroPagamento: { error?: string; endpoint?: string } | null = null;

          try {
            erroPagamento = corpoBruto
              ? (JSON.parse(corpoBruto) as { error?: string; endpoint?: string })
              : null;
          } catch {
            erroPagamento = null;
          }

          const endpointErro = erroPagamento?.endpoint ?? "nao informado";
          avisoPagamento =
            `Integracao de cartao indisponivel (${endpointErro}). Cobrar no recebimento.`;

          console.warn("Falha pagamento cartao:", {
            status: respostaPagamento.status,
            statusText: respostaPagamento.statusText,
            endpoint: endpointErro,
            error: erroPagamento?.error ?? "sem detalhe",
            body: corpoBruto || "vazio",
          });
        }
      }

      const pagamentoTexto = formaPagamento;

      const msg =
        `Pedido Dulelis\n\n` +
        `Cliente: ${payloadCliente.nome}\n` +
        `Endereco: ${payloadCliente.endereco}, ${payloadCliente.numero}\n\n` +
        `Pagamento: ${pagamentoTexto}\n\n` +
        (avisoPagamento ? `Aviso: ${avisoPagamento}\n\n` : "") +
        `Itens:\n${carrinho.map((i) => `${i.qtd}x ${i.nome}`).join("\n")}\n\n` +
        `Total: R$ ${totalGeral.toFixed(2)}`;

      window.open(
        `https://wa.me/5547988400002?text=${encodeURIComponent(msg)}`,
        "_blank",
      );

      setCarrinho([]);
      setAbaCarrinho(false);
      setPasso(1);
      setCliente(CLIENTE_INICIAL);
      setClienteEncontrado(false);
      setDistanciaKm(null);
      setTaxaEntrega(0);
      setMsgTaxa("Aguardando endereço...");
      setFormaPagamento("");
      setPixCopiado(false);

      await carregarDadosIniciais();
    } catch (error) {
      console.error("Erro ao finalizar pedido:", error);
      const mensagem = error instanceof Error ? error.message : "Erro ao finalizar pedido.";
      alert(mensagem);
    } finally {
      setProcessandoCartao(false);
      setLoading(false);
    }
  }, [carrinho, carregarDadosIniciais, cliente, formaPagamento, totalGeral]);

  const produtosFiltrados = useMemo(
    () =>
      produtos
        .filter((p) => p.quantidade > 0)
        .filter((p) => categoriaAtiva === "Todos" || p.categoria === categoriaAtiva),
    [categoriaAtiva, produtos],
  );
  const quantidadesCarrinho = useMemo(
    () =>
      carrinho.reduce<Record<number, number>>((acc, item) => {
        acc[item.id] = item.qtd;
        return acc;
      }, {}),
    [carrinho],
  );

  const formOk = Boolean(
    cliente.nome &&
      normalizarNumero(cliente.whatsapp).length >= 10 &&
      cliente.cep &&
      cliente.endereco &&
      cliente.numero,
  );

  return (
    <div className="min-h-screen bg-[#FDFCFD] pb-24 font-sans text-slate-900">
      <header className="p-10 text-center bg-white border-b border-pink-50 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-200 via-pink-500 to-pink-200"></div>
        <h1 className="text-5xl font-black text-pink-600 italic tracking-tighter drop-shadow-sm">
          DULELIS
        </h1>
        <p className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.4em] mt-2">
          Confeitaria Artesanal
        </p>
      </header>

      <div className="flex gap-3 overflow-x-auto py-5 px-6 no-scrollbar sticky top-0 bg-white/80 backdrop-blur-xl z-40 border-b border-pink-50/50">
        {CATEGORIAS.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategoriaAtiva(cat)}
            className={`px-7 py-2.5 rounded-full font-black text-[10px] whitespace-nowrap transition-all uppercase tracking-widest border-2 ${categoriaAtiva === cat ? "bg-pink-600 border-pink-600 text-white shadow-lg" : "bg-white border-slate-100 text-slate-400"}`}
          >
            {cat}
          </button>
        ))}
      </div>

      <main className="max-w-xl mx-auto p-6 grid gap-5">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-pink-500" size={40} />
          </div>
        ) : (
          produtosFiltrados.map((prod) => (
            <div
              key={prod.id}
              className="group flex items-center gap-5 p-4 rounded-[2.5rem] border bg-white border-pink-50 shadow-sm transition-all active:scale-[0.98]"
            >
              <div className="w-24 h-24 rounded-[1.8rem] bg-slate-50 overflow-hidden shrink-0 border border-pink-50/50">
                {prod.imagem_url ? (
                  <Image
                    src={prod.imagem_url}
                    className="w-full h-full object-cover"
                    alt={prod.nome}
                    width={96}
                    height={96}
                    sizes="96px"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-pink-100 font-black italic text-[10px]">
                    DULELIS
                  </div>
                )}
              </div>
              <div className="flex-1">
                <span className="text-[8px] font-black text-pink-400 uppercase tracking-widest bg-pink-50 px-2 py-0.5 rounded-full">
                  {prod.categoria}
                </span>
                <h3 className="font-black text-slate-800 text-lg mt-1">{prod.nome}</h3>
                <p className="text-pink-600 font-black text-xl">R$ {Number(prod.preco).toFixed(2)}</p>
              </div>
              <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                <button
                  type="button"
                  onClick={() => removerDoCarrinho(prod.id)}
                  className="text-pink-600 p-2"
                >
                  <Minus size={18} />
                </button>
                <span className="font-black text-sm w-6 text-center">
                  {quantidadesCarrinho[prod.id] ?? 0}
                </span>
                <button
                  type="button"
                  onClick={() => adicionarAoCarrinho(prod)}
                  className="bg-pink-600 text-white p-2 rounded-xl shadow-lg shadow-pink-100"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>
          ))
        )}
      </main>

      {carrinho.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[94%] max-w-md bg-slate-900 text-white p-5 rounded-[3rem] shadow-2xl flex justify-between items-center z-50">
          <div className="flex items-center gap-4 ml-2">
            <div className="bg-pink-600 p-3 rounded-2xl relative">
              <ShoppingBag size={20} />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-1">
                Total
              </p>
              <p className="font-black text-2xl text-pink-500">R$ {subtotal.toFixed(2)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAbaCarrinho(true)}
            className="bg-pink-600 px-8 py-5 rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-lg shadow-pink-900/20 active:scale-95 transition-all"
          >
            Finalizar
          </button>
        </div>
      )}

      {abaCarrinho && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[60] flex items-end sm:items-center sm:justify-center">
          <div className="bg-white w-full max-w-lg rounded-t-[3.5rem] sm:rounded-[3.5rem] p-8 max-h-[95vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-3xl font-black italic text-slate-800">
                {passo === 1 ? "Quase lá!" : "Resumo"}
              </h3>
              <button
                type="button"
                onClick={() => setAbaCarrinho(false)}
                className="bg-slate-50 p-3 rounded-full text-slate-300"
              >
                <X />
              </button>
            </div>

            {passo === 1 ? (
              <div className="space-y-4">
                <div className="relative">
                  <div className="absolute inset-y-0 left-5 flex items-center text-slate-300">
                    <Phone size={20} />
                  </div>
                  <input
                    placeholder="WhatsApp *"
                    className="w-full p-5 pl-14 rounded-3xl bg-slate-50 border-2 border-transparent focus:border-pink-200 focus:bg-white focus:outline-none font-bold"
                    value={cliente.whatsapp}
                    onChange={(e) =>
                      setCliente((prev) => ({ ...prev, whatsapp: e.target.value }))
                    }
                  />
                  {buscandoCliente && (
                    <Loader2
                      className="absolute right-5 top-5 animate-spin text-pink-500"
                      size={20}
                    />
                  )}
                </div>

                {clienteEncontrado && (
                  <div className="bg-green-50 text-green-700 p-4 rounded-3xl flex items-center gap-3">
                    <div className="bg-white p-1 rounded-full">
                      <CheckCircle2 size={18} />
                    </div>
                    <p className="text-[10px] font-black uppercase">Cadastro encontrado!</p>
                  </div>
                )}

                <div className="relative">
                  <div className="absolute inset-y-0 left-5 flex items-center text-slate-300">
                    <User size={20} />
                  </div>
                  <input
                    placeholder="Seu Nome Completo *"
                    className="w-full p-5 pl-14 rounded-3xl bg-slate-50 border-2 border-transparent focus:border-pink-200 focus:bg-white focus:outline-none font-bold"
                    value={cliente.nome}
                    onChange={(e) => setCliente((prev) => ({ ...prev, nome: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-5 flex items-center text-slate-300">
                      <Hash size={18} />
                    </div>
                    <input
                      placeholder="CEP *"
                      maxLength={8}
                      value={cliente.cep}
                      className="w-full p-5 pl-14 rounded-3xl bg-slate-50 border-2 border-transparent focus:border-pink-200 focus:bg-white focus:outline-none font-bold"
                      onChange={(e) => executarBuscaCep(e.target.value)}
                    />
                    {buscandoCep && (
                      <Loader2
                        className="absolute right-4 top-5 animate-spin text-pink-500"
                        size={20}
                      />
                    )}
                  </div>
                  <input
                    placeholder="Cidade"
                    value={cliente.cidade}
                    className="w-full p-5 rounded-3xl bg-slate-50 border-none font-bold text-slate-400"
                    disabled
                  />
                </div>

                <div
                  className={`p-5 rounded-[2rem] border-2 transition-all flex items-center gap-4 ${distanciaKm !== null ? "bg-blue-50 border-blue-200" : "bg-slate-50 border-slate-100"}`}
                >
                  <div
                    className={`p-3 rounded-2xl ${distanciaKm !== null ? "bg-blue-500 text-white" : "bg-slate-200 text-slate-400"}`}
                  >
                    <Bike size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-blue-400 tracking-tighter">
                      Entrega
                    </p>
                    <p
                      className={`text-sm font-black ${distanciaKm !== null ? "text-blue-700" : "text-slate-500"}`}
                    >
                      {msgTaxa}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  <input
                    placeholder="Rua *"
                    value={cliente.endereco}
                    className="col-span-3 w-full p-5 rounded-3xl bg-slate-50 border-2 border-transparent focus:border-pink-200 focus:bg-white focus:outline-none font-bold"
                    onChange={(e) =>
                      setCliente((prev) => ({ ...prev, endereco: e.target.value }))
                    }
                  />
                  <input
                    placeholder="Nº *"
                    value={cliente.numero}
                    className="w-full p-5 rounded-3xl bg-slate-50 border-2 border-transparent focus:border-pink-200 focus:bg-white focus:outline-none font-bold text-center"
                    onChange={(e) =>
                      setCliente((prev) => ({ ...prev, numero: e.target.value }))
                    }
                  />
                </div>

                <input
                  placeholder="Bairro *"
                  value={cliente.bairro}
                  className="w-full p-5 rounded-3xl bg-slate-50 border-2 border-transparent focus:border-pink-200 focus:bg-white focus:outline-none font-bold"
                  onChange={(e) => setCliente((prev) => ({ ...prev, bairro: e.target.value }))}
                />

                <button
                  type="button"
                  onClick={() => setPasso(2)}
                  disabled={!formOk}
                  className={`w-full p-6 rounded-[2.2rem] font-black uppercase text-xl mt-4 flex items-center justify-center gap-3 transition-all ${formOk ? "bg-pink-600 text-white shadow-xl shadow-pink-100" : "bg-slate-100 text-slate-300"}`}
                >
                  Próximo Passo <ChevronRight size={24} />
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="max-h-56 overflow-y-auto space-y-3 p-4 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                  {carrinho.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between items-center bg-white p-4 rounded-3xl shadow-sm border border-slate-50"
                    >
                      <div className="flex-1">
                        <p className="font-black text-slate-800 text-sm">{item.nome}</p>
                        <p className="text-[10px] font-black text-pink-400">
                          R$ {item.preco.toFixed(2)} un
                        </p>
                      </div>
                      <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                        <button
                          type="button"
                          onClick={() => removerDoCarrinho(item.id)}
                          className="text-pink-600"
                        >
                          <Minus size={16} />
                        </button>
                        <span className="font-black text-sm w-4 text-center">{item.qtd}</span>
                        <button
                          type="button"
                          onClick={() => adicionarAoCarrinho(item)}
                          className="text-pink-600"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-slate-900 text-white p-8 rounded-[3rem] shadow-2xl">
                  <div className="space-y-3 relative">
                    <div className="flex justify-between text-xs font-bold text-slate-400">
                      <span>Subtotal</span>
                      <span>R$ {subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold text-blue-400 border-b border-white/10 pb-3">
                      <span>Taxa de Entrega</span>
                      <span>R$ {taxaEntrega.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-end pt-3">
                      <div>
                        <p className="text-[10px] uppercase font-black text-pink-500 tracking-[0.2em]">
                          Valor Total
                        </p>
                        <p className="text-4xl font-black">R$ {totalGeral.toFixed(2)}</p>
                      </div>
                      <CheckCircle2 className="text-green-500 mb-1" size={32} />
                    </div>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-[2.2rem] border border-slate-100">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
                    Forma de Pagamento
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {FORMAS_PAGAMENTO.map((forma) => (
                      <button
                        key={forma}
                        type="button"
                        onClick={() => void selecionarFormaPagamento(forma)}
                        className={`p-3 rounded-2xl text-xs font-black uppercase tracking-wide border-2 transition-all ${formaPagamento === forma ? "bg-pink-600 border-pink-600 text-white" : "bg-slate-50 border-slate-100 text-slate-500"}`}
                      >
                        {forma === "Pix"
                          ? pixCopiado
                            ? "Pix Copiado!"
                            : "Pix Copia e Cola"
                          : forma}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={finalizarPedido}
                  disabled={!formaPagamento || processandoCartao}
                  className={`w-full p-7 rounded-[2.5rem] font-black uppercase shadow-xl tracking-widest text-xl flex items-center justify-center gap-3 ${formaPagamento ? "bg-green-500 text-white" : "bg-slate-100 text-slate-300 shadow-none"}`}
                >
                  {processandoCartao ? "Processando Cartao..." : "Enviar para o WhatsApp"}
                </button>
                <button
                  type="button"
                  onClick={limparCarrinho}
                  className="w-full bg-slate-100 text-slate-500 p-5 rounded-[2.2rem] font-black uppercase text-sm tracking-widest"
                >
                  Limpar Carrinho
                </button>
                <button
                  type="button"
                  onClick={() => setPasso(1)}
                  className="w-full flex items-center justify-center gap-2 text-slate-400 font-bold text-[10px] uppercase p-2 tracking-widest"
                >
                  <ArrowLeft size={14} /> Alterar Dados
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
