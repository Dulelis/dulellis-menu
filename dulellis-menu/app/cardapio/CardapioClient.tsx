"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ExternalLink, Instagram, Loader2, MessageCircle, RefreshCw, Share2 } from "lucide-react";

type ProdutoCardapio = {
  id: number;
  nome: string;
  descricao?: string | null;
  categoria: string;
  preco: number | string;
  imagem_url?: string | null;
};

type CardapioResponse = {
  ok?: boolean;
  produtos?: ProdutoCardapio[];
  error?: string;
};

const WHATSAPP_NUMERO = "5547988400002";
const INSTAGRAM_URL = "https://www.instagram.com/dulelis_confeitaria/";

function formatarPreco(valor: number | string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(Number(valor) || 0);
}

function urlCardapio() {
  if (typeof window === "undefined") return "https://dulelisdelivery.com.br/cardapio";
  return new URL("/cardapio", window.location.origin).toString();
}

export function CardapioClient() {
  const [produtos, setProdutos] = useState<ProdutoCardapio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [linkCopiado, setLinkCopiado] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const resposta = await fetch("/api/public/cardapio", { cache: "no-store" });
      const json = (await resposta.json().catch(() => ({}))) as CardapioResponse;
      if (!resposta.ok || json.ok === false) {
        throw new Error(json.error || "Não foi possível carregar o cardápio.");
      }
      setProdutos(Array.isArray(json.produtos) ? json.produtos : []);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível carregar o cardápio.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const secoes = useMemo(() => {
    const agrupados = new Map<string, ProdutoCardapio[]>();
    produtos.forEach((produto) => {
      const categoria = String(produto.categoria || "Outros").trim() || "Outros";
      agrupados.set(categoria, [...(agrupados.get(categoria) || []), produto]);
    });
    return Array.from(agrupados.entries())
      .map(([categoria, itens]) => [
        categoria,
        [...itens].sort((a, b) =>
          a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base", numeric: true }),
        ),
      ] as const)
      .sort(([a], [b]) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
  }, [produtos]);

  const copiarLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(urlCardapio());
      setLinkCopiado(true);
      window.setTimeout(() => setLinkCopiado(false), 2200);
    } catch {
      window.prompt("Copie o link do cardápio:", urlCardapio());
    }
  }, []);

  const compartilhar = useCallback(async () => {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "Cardápio Dulelis Confeitaria",
          text: "Confira o cardápio de encomendas da Dulelis Confeitaria!",
          url: urlCardapio(),
        });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await copiarLink();
  }, [copiarLink]);

  const mensagemPedido = encodeURIComponent(
    `Olá! Vi o cardápio da Dulelis e gostaria de fazer uma encomenda.\n\n${urlCardapio()}`,
  );

  return (
    <main className="min-h-screen bg-[#fffdf9] text-[#4b3428] [font-family:var(--font-cardapio-texto)]">
      <header className="relative overflow-hidden border-b border-[#d4a574]/30 bg-[#1a1a2e] px-4 py-10 text-center text-white sm:py-14">
        <div className="pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full bg-[#c2185b]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-12 h-64 w-64 rounded-full bg-[#d4a574]/20 blur-3xl" />
        <div className="relative mx-auto max-w-4xl">
          <img src="/logo.png" alt="Dulelis Confeitaria" className="mx-auto h-24 w-24 rounded-full bg-white object-contain p-2 shadow-2xl sm:h-28 sm:w-28" />
          <p className="mt-6 text-xs font-black uppercase tracking-[0.32em] text-[#d4a574]">Confeitaria &amp; Cia</p>
          <h1 className="mt-2 text-4xl font-bold sm:text-6xl [font-family:var(--font-cardapio-titulo)]">Nosso cardápio</h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm font-bold leading-6 text-white/70 sm:text-base">
            Doces e salgados artesanais preparados com carinho para seus momentos especiais.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <a href={`https://wa.me/${WHATSAPP_NUMERO}?text=${mensagemPedido}`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-sm font-black text-white shadow-lg transition-transform hover:-translate-y-0.5">
              <MessageCircle size={18} /> Fazer pedido no WhatsApp
            </a>
            <button type="button" onClick={() => void compartilhar()} className="inline-flex items-center justify-center gap-2 rounded-full border border-[#d4a574]/50 bg-white/10 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-white/20">
              {linkCopiado ? <Check size={18} /> : <Share2 size={18} />}
              {linkCopiado ? "Link copiado" : "Compartilhar cardápio"}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        {carregando ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-4 text-[#c2185b]">
            <Loader2 className="animate-spin" size={34} />
            <p className="text-sm font-black uppercase tracking-widest">Carregando cardápio</p>
          </div>
        ) : erro ? (
          <div className="mx-auto max-w-xl rounded-3xl border border-red-200 bg-red-50 p-8 text-center">
            <p className="font-bold text-red-700">{erro}</p>
            <button type="button" onClick={() => void carregar()} className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#1a1a2e] px-5 py-3 text-sm font-black text-white">
              <RefreshCw size={17} /> Tentar novamente
            </button>
          </div>
        ) : secoes.length === 0 ? (
          <div className="mx-auto max-w-xl rounded-3xl border border-[#d4a574]/30 bg-white p-8 text-center shadow-sm">
            <h2 className="text-2xl font-bold text-[#c2185b] [font-family:var(--font-cardapio-titulo)]">Cardápio em atualização</h2>
            <p className="mt-3 text-sm font-bold leading-6 text-[#795f52]">Estamos preparando nossas opções. Fale conosco pelo WhatsApp para consultar as delícias disponíveis.</p>
          </div>
        ) : (
          <div className="space-y-12">
            {secoes.map(([categoria, itens]) => (
              <section key={categoria}>
                <div className="mb-6 flex items-center gap-4">
                  <div className="h-px flex-1 bg-[#d4a574]/40" />
                  <h2 className="text-center text-2xl font-bold text-[#c2185b] sm:text-3xl [font-family:var(--font-cardapio-titulo)]">{categoria}</h2>
                  <div className="h-px flex-1 bg-[#d4a574]/40" />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {itens.map((produto) => (
                    <article key={produto.id} className="overflow-hidden rounded-3xl border border-[#d4a574]/30 bg-white shadow-[0_12px_35px_rgba(97,58,32,0.08)]">
                      {produto.imagem_url ? <img src={produto.imagem_url} alt={produto.nome} className="h-48 w-full object-cover" /> : null}
                      <div className="p-6">
                        <div className="flex items-start justify-between gap-4">
                          <h3 className="text-xl font-bold leading-tight text-[#c2185b] [font-family:var(--font-cardapio-titulo)]">{produto.nome}</h3>
                          <span className="shrink-0 text-lg font-black text-[#a46e2f]">{formatarPreco(produto.preco)}</span>
                        </div>
                        {produto.descricao ? <p className="mt-3 text-sm font-bold leading-6 text-[#795f52]">{produto.descricao}</p> : null}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <footer className="border-t border-[#d4a574]/30 bg-[#1a1a2e] px-4 py-9 text-center text-white">
        <p className="text-xl font-bold text-[#d4a574] [font-family:var(--font-cardapio-titulo)]">Dulelis Confeitaria</p>
        <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
          <a href={`https://wa.me/${WHATSAPP_NUMERO}?text=${mensagemPedido}`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-sm font-black"><MessageCircle size={17} /> WhatsApp</a>
          <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#f09433] via-[#dc2743] to-[#bc1888] px-5 py-3 text-sm font-black"><Instagram size={17} /> Instagram <ExternalLink size={14} /></a>
        </div>
        <p className="mt-6 text-xs font-bold text-white/50">© {new Date().getFullYear()} Dulelis — Doces e Salgados Artesanais</p>
      </footer>
    </main>
  );
}
