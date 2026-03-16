'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Cake, ChevronLeft, ShoppingBag, TrendingUp } from 'lucide-react';

type Pedido = {
  id: number;
  cliente_nome?: string | null;
  whatsapp?: string | null;
  total?: number | string | null;
  created_at?: string | null;
};

type Cliente = {
  id: number;
  nome?: string | null;
  whatsapp?: string | null;
  data_aniversario?: string | null;
};

export default function AdminVendasPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    const carregar = async () => {
      setLoading(true);
      setErro('');
      try {
        const res = await fetch('/api/admin/data', { cache: 'no-store' });
        const json = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          data?: { pedidos?: Pedido[]; clientes?: Cliente[] };
        };
        if (!res.ok || json.ok === false) {
          throw new Error(json.error || 'Falha ao carregar dados de vendas.');
        }
        setPedidos(json.data?.pedidos || []);
        setClientes(json.data?.clientes || []);
      } catch (error) {
        setErro(error instanceof Error ? error.message : 'Falha ao carregar dados.');
      } finally {
        setLoading(false);
      }
    };

    void carregar();
  }, []);

  const agora = new Date();
  const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime();
  const inicioSemana = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - agora.getDay()).getTime();
  const mesAtual = agora.getMonth();

  const pedidosDaSemana = useMemo(
    () =>
      pedidos.filter((pedido) => {
        const data = pedido.created_at ? new Date(pedido.created_at).getTime() : 0;
        return data >= inicioSemana;
      }),
    [inicioSemana, pedidos],
  );

  const pedidosDeHoje = useMemo(
    () =>
      pedidos.filter((pedido) => {
        const data = pedido.created_at ? new Date(pedido.created_at).getTime() : 0;
        return data >= inicioHoje;
      }),
    [inicioHoje, pedidos],
  );

  const faturamentoSemana = useMemo(
    () => pedidosDaSemana.reduce((acc, pedido) => acc + (Number(pedido.total) || 0), 0),
    [pedidosDaSemana],
  );

  const aniversariantesMes = useMemo(
    () =>
      clientes.filter((cliente) => {
        const data = String(cliente.data_aniversario || '').slice(0, 10);
        if (!data) return false;
        return new Date(`${data}T00:00:00`).getMonth() === mesAtual;
      }),
    [clientes, mesAtual],
  );

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Subpasta Vendas</p>
            <h1 className="text-3xl font-black text-slate-900">Visoes complementares</h1>
            <p className="mt-1 text-sm font-bold text-slate-500">Semana, aniversariantes e acesso rapido aos relatorios.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin?tab=vendas" className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm transition-colors hover:bg-slate-50">
              <ChevronLeft size={18} /> Voltar para vendas do dia
            </Link>
            <Link href="/admin?tab=relatorios" className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white shadow-sm transition-colors hover:bg-slate-800">
              <TrendingUp size={18} /> Abrir relatorios
            </Link>
          </div>
        </div>

        {erro ? (
          <div className="rounded-[2rem] border border-rose-200 bg-rose-50 p-5 text-sm font-bold text-rose-700">
            {erro}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <section className="rounded-[2rem] border border-blue-200 bg-blue-50 p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-widest text-slate-600">Vendas da Semana</p>
              <TrendingUp size={18} className="text-blue-600" />
            </div>
            <p className="mt-3 text-3xl font-black text-slate-900">{pedidosDaSemana.length}</p>
            <p className="mt-1 text-sm font-black text-green-600">R$ {faturamentoSemana.toFixed(2)}</p>
          </section>

          <section className="rounded-[2rem] border border-pink-200 bg-pink-50 p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-widest text-slate-600">Pedidos de Hoje</p>
              <ShoppingBag size={18} className="text-pink-600" />
            </div>
            <p className="mt-3 text-3xl font-black text-slate-900">{pedidosDeHoje.length}</p>
            <p className="mt-1 text-sm font-bold text-slate-500">Operacional mantido na tela principal.</p>
          </section>

          <section className="rounded-[2rem] border border-yellow-200 bg-yellow-50 p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-widest text-slate-600">Aniversariantes do Mes</p>
              <Cake size={18} className="text-yellow-600" />
            </div>
            <p className="mt-3 text-3xl font-black text-slate-900">{aniversariantesMes.length}</p>
            <p className="mt-1 text-sm font-bold text-slate-500">Clientes para acao comercial do mes.</p>
          </section>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-slate-900">Ultimos 10 pedidos da semana</h2>
            <div className="mt-4 space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {loading ? (
                <p className="py-10 text-center text-sm font-bold text-slate-400">Carregando vendas...</p>
              ) : pedidosDaSemana.length > 0 ? (
                pedidosDaSemana.slice(0, 10).map((pedido) => (
                  <div key={pedido.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-sm font-black text-slate-900">{pedido.cliente_nome || 'Cliente sem nome'}</p>
                    <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-slate-500">{pedido.whatsapp || 'sem numero'}</p>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-black text-green-600">R$ {Number(pedido.total || 0).toFixed(2)}</p>
                      <p className="text-[11px] font-bold text-slate-400">
                        {pedido.created_at ? new Date(pedido.created_at).toLocaleString('pt-BR') : 'Data nao informada'}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-10 text-center text-sm font-bold text-slate-400">Sem vendas registradas nesta semana.</p>
              )}
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-slate-900">Aniversariantes do mes</h2>
            <div className="mt-4 space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {loading ? (
                <p className="py-10 text-center text-sm font-bold text-slate-400">Carregando clientes...</p>
              ) : aniversariantesMes.length > 0 ? (
                aniversariantesMes.map((cliente) => (
                  <div key={cliente.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-sm font-black text-slate-900">{cliente.nome || 'Cliente sem nome'}</p>
                    <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-slate-500">{cliente.whatsapp || 'sem numero'}</p>
                    <p className="mt-3 text-sm font-bold text-pink-600">
                      {cliente.data_aniversario
                        ? new Date(`${String(cliente.data_aniversario).slice(0, 10)}T00:00:00`).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
                        : 'Data nao informada'}
                    </p>
                  </div>
                ))
              ) : (
                <p className="py-10 text-center text-sm font-bold text-slate-400">Sem aniversariantes neste mes.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
