"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Package, Users, PlusCircle, Minus, Plus, 
  Trash2, Pencil, X, Loader2, Camera, Image as ImageIcon, 
  Phone, MapPin, Cake, MessageSquare, TrendingUp, DollarSign, ShoppingBag, Printer, Award, Map
} from 'lucide-react';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('estoque');
  const [loading, setLoading] = useState(false);
  const [estoque, setEstoque] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [taxas, setTaxas] = useState<any[]>([]); 
  
  const [uploading, setUploading] = useState(false);
  const [mostrarModalEstoque, setMostrarModalEstoque] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);

  const [mostrarModalTaxa, setMostrarModalTaxa] = useState(false);
  const [editandoTaxaId, setEditandoTaxaId] = useState<number | null>(null);
  
  // Agora o padrão começa em 2km
  const [novaTaxa, setNovaTaxa] = useState({ bairro: 'Até 2km', taxa: 0 });

  const [novoItem, setNovoItem] = useState({ 
    nome: '', quantidade: 0, preco: 0, descricao: '', imagem_url: '', categoria: 'Doces' 
  });

  const carregarDados = async () => {
    setLoading(true);
    const resEst = await supabase.from('estoque').select('*').order('nome');
    const resCli = await supabase.from('clientes').select('*').order('created_at', { ascending: false });
    const resPed = await supabase.from('pedidos').select('*').order('created_at', { ascending: false });
    
    // Carrega as taxas ordenadas pelo valor para ficar bonito na tela
    const resTaxas = await supabase.from('taxas_entrega').select('*').order('taxa'); 
    
    setEstoque(resEst.data || []);
    setClientes(resCli.data || []);
    setPedidos(resPed.data || []);
    setTaxas(resTaxas.data || []);
    setLoading(false);
  };

  useEffect(() => { carregarDados(); }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0) return;
      setUploading(true);
      const file = e.target.files[0];
      const fileName = `${Math.random()}.${file.name.split('.').pop()}`;
      const { error: uploadError } = await supabase.storage.from('fotos-produtos').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('fotos-produtos').getPublicUrl(fileName);
      setNovoItem({ ...novoItem, imagem_url: data.publicUrl });
    } catch (error: any) {
      alert('Erro no upload: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const salvarProduto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editandoId) {
      await supabase.from('estoque').update(novoItem).eq('id', editandoId);
    } else {
      await supabase.from('estoque').insert([novoItem]);
    }
    fecharModal();
    carregarDados();
  };

  const abrirEdicao = (item: any) => {
    setNovoItem({ nome: item.nome, quantidade: item.quantidade, preco: item.preco, descricao: item.descricao || '', imagem_url: item.imagem_url || '', categoria: item.categoria || 'Doces' });
    setEditandoId(item.id);
    setMostrarModalEstoque(true);
  };

  const fecharModal = () => {
    setMostrarModalEstoque(false);
    setEditandoId(null);
    setNovoItem({ nome: '', quantidade: 0, preco: 0, descricao: '', imagem_url: '', categoria: 'Doces' });
  };

  const mudarQtd = async (id: number, atual: number, mudanca: number) => {
    await supabase.from('estoque').update({ quantidade: Math.max(0, atual + mudanca) }).eq('id', id);
    carregarDados();
  };

  const excluir = async (tabela: string, id: number) => {
    if(confirm("Deseja excluir permanentemente?")) {
      await supabase.from(tabela).delete().eq('id', id);
      carregarDados();
    }
  };

  // --- FUNÇÕES DE TAXAS DE ENTREGA ---
  const salvarTaxa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editandoTaxaId) {
      await supabase.from('taxas_entrega').update(novaTaxa).eq('id', editandoTaxaId);
    } else {
      await supabase.from('taxas_entrega').insert([novaTaxa]);
    }
    fecharModalTaxa();
    carregarDados();
  };

  const abrirEdicaoTaxa = (t: any) => {
    setNovaTaxa({ bairro: t.bairro, taxa: t.taxa });
    setEditandoTaxaId(t.id);
    setMostrarModalTaxa(true);
  };

  const fecharModalTaxa = () => {
    setMostrarModalTaxa(false);
    setEditandoTaxaId(null);
    setNovaTaxa({ bairro: 'Até 2km', taxa: 0 }); // Retorna para 2km
  };

  // Lógica dos Relatórios
  const mesAtual = new Date().getMonth();
  const anoAtual = new Date().getFullYear();
  const nomesMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  
  const pedidosDoMes = pedidos.filter(p => {
    if (!p.created_at) return false;
    const dataPedido = new Date(p.created_at);
    return dataPedido.getMonth() === mesAtual && dataPedido.getFullYear() === anoAtual;
  });

  const faturamentoTotal = pedidosDoMes.reduce((acc, p) => acc + (Number(p.total) || 0), 0);
  
  const vendasPorProduto: Record<string, { qtd: number, valor: number }> = {};
  const comprasPorCliente: Record<string, { nome: string, qtdPedidos: number, valorGasto: number }> = {};
  
  pedidosDoMes.forEach(pedido => {
    let itensArray = pedido.itens;
    if (typeof itensArray === 'string') {
      try { itensArray = JSON.parse(itensArray); } catch (e) { itensArray = []; }
    }
    if (Array.isArray(itensArray)) {
      itensArray.forEach(item => {
        if (!item.nome) return;
        if (!vendasPorProduto[item.nome]) vendasPorProduto[item.nome] = { qtd: 0, valor: 0 };
        vendasPorProduto[item.nome].qtd += (Number(item.qtd) || 0);
        vendasPorProduto[item.nome].valor += ((Number(item.preco) || 0) * (Number(item.qtd) || 0));
      });
    }

    const zap = pedido.whatsapp || 'sem-numero';
    if (!comprasPorCliente[zap]) {
      comprasPorCliente[zap] = { nome: pedido.cliente_nome || 'Cliente sem nome', qtdPedidos: 0, valorGasto: 0 };
    }
    comprasPorCliente[zap].qtdPedidos += 1;
    comprasPorCliente[zap].valorGasto += (Number(pedido.total) || 0);
  });

  const rankingProdutos = Object.entries(vendasPorProduto).map(([nome, dados]) => ({ nome, ...dados })).sort((a, b) => b.qtd - a.qtd);
  const rankingClientes = Object.values(comprasPorCliente).sort((a, b) => b.valorGasto - a.valorGasto);

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans print:bg-white">
      <aside className="w-64 bg-slate-900 text-white p-6 hidden lg:block print:hidden">
        <h2 className="text-2xl font-black text-pink-500 italic mb-10 text-center tracking-tighter">DULELIS</h2>
        <nav className="space-y-2">
          <button onClick={() => setActiveTab('estoque')} className={`flex items-center gap-3 w-full p-4 rounded-2xl transition-all ${activeTab === 'estoque' ? 'bg-pink-600 shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}> <Package size={20}/> Estoque / Cardápio </button>
          <button onClick={() => setActiveTab('clientes')} className={`flex items-center gap-3 w-full p-4 rounded-2xl transition-all ${activeTab === 'clientes' ? 'bg-pink-600 shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}> <Users size={20}/> Lista de Clientes </button>
          <button onClick={() => setActiveTab('taxas')} className={`flex items-center gap-3 w-full p-4 rounded-2xl transition-all ${activeTab === 'taxas' ? 'bg-pink-600 shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}> <Map size={20}/> Taxas de Entrega </button>
          <button onClick={() => setActiveTab('relatorios')} className={`flex items-center gap-3 w-full p-4 rounded-2xl transition-all ${activeTab === 'relatorios' ? 'bg-pink-600 shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}> <TrendingUp size={20}/> Relatórios & Vendas </button>
        </nav>
      </aside>

      <main className="flex-1 p-8 overflow-y-auto h-screen print:h-auto print:p-0 print:overflow-visible">
        <header className="flex justify-between items-center mb-8 print:hidden">
          <h1 className="text-3xl font-black text-slate-800">
            {activeTab === 'estoque' && 'Produtos'}
            {activeTab === 'clientes' && 'Clientes'}
            {activeTab === 'taxas' && 'Raio de Entrega (km)'}
            {activeTab === 'relatorios' && 'Fechamento do Mês'}
          </h1>
          
          {activeTab === 'estoque' && (
            <button onClick={() => { fecharModal(); setMostrarModalEstoque(true); }} className="bg-pink-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg hover:bg-pink-700 transition-all"> 
              <PlusCircle size={20} /> Novo Doce 
            </button>
          )}

          {activeTab === 'taxas' && (
            <button onClick={() => { fecharModalTaxa(); setMostrarModalTaxa(true); }} className="bg-pink-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg hover:bg-pink-700 transition-all"> 
              <PlusCircle size={20} /> Adicionar Raio 
            </button>
          )}
        </header>

        {activeTab === 'estoque' && (
          <div className="grid gap-4">
            {estoque.map(item => (
              <div key={item.id} className="bg-white p-4 rounded-[2rem] shadow-sm border border-slate-100 flex items-center gap-4">
                <div className="w-20 h-20 rounded-2xl bg-slate-100 overflow-hidden flex-shrink-0">
                  {item.imagem_url ? <img src={item.imagem_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-300"><ImageIcon size={24}/></div>}
                </div>
                <div className="flex-1">
                  <h3 className="font-black text-slate-800">{item.nome}</h3>
                  <span className="text-[10px] bg-pink-50 text-pink-600 px-2 py-0.5 rounded-full font-bold uppercase">{item.categoria}</span>
                  <p className="text-pink-600 font-bold">R$ {Number(item.preco).toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-100">
                  <button onClick={() => mudarQtd(item.id, item.quantidade, -1)} className="p-1 hover:text-red-500"><Minus size={18}/></button>
                  <span className="font-black text-lg w-8 text-center">{item.quantidade}</span>
                  <button onClick={() => mudarQtd(item.id, item.quantidade, 1)} className="p-1 hover:text-green-500"><Plus size={18}/></button>
                </div>
                <div className="flex items-center gap-2 ml-4 border-l border-slate-100 pl-4">
                  <button onClick={() => abrirEdicao(item)} className="text-slate-300 hover:text-blue-500 transition-colors" title="Editar Produto"><Pencil size={20}/></button>
                  <button onClick={() => excluir('estoque', item.id)} className="text-slate-300 hover:text-red-500 transition-colors" title="Excluir Produto"><Trash2 size={20}/></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TELA DE TAXAS DE ENTREGA (NOVO VISUAL COM RAIO AO LADO DO BOTÃO) */}
        {activeTab === 'taxas' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {taxas.map(t => (
              <div key={t.id} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm relative flex items-center justify-between">
                 <div className="flex-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Valor da Taxa</p>
                    <p className="text-pink-600 font-black text-2xl">R$ {Number(t.taxa).toFixed(2)}</p>
                 </div>
                 
                 {/* A MÁGICA VISUAL ESTÁ AQUI: DISTÂNCIA + BOTÕES */}
                 <div className="flex items-center gap-2 border-l border-slate-100 pl-4">
                    <span className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-xl font-black text-xs whitespace-nowrap mr-1 flex items-center gap-1">
                      <MapPin size={14} className="text-pink-500" /> {t.bairro}
                    </span>
                    <button onClick={() => abrirEdicaoTaxa(t)} className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-blue-500 transition-colors"><Pencil size={18}/></button>
                    <button onClick={() => excluir('taxas_entrega', t.id)} className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
                 </div>
              </div>
            ))}
            {taxas.length === 0 && (
              <div className="col-span-full text-center py-20 text-slate-400 font-medium italic">
                Nenhum raio de entrega cadastrado ainda.
              </div>
            )}
          </div>
        )}

        {activeTab === 'clientes' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {clientes.map(c => (
              <div key={c.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative flex flex-col">
                 <button onClick={() => excluir('clientes', c.id)} className="absolute top-6 right-6 text-slate-200 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
                 <h3 className="font-black text-xl text-slate-800 border-b border-slate-50 pb-3 mb-4 pr-8">{c.nome}</h3>
                 <div className="space-y-4 text-sm flex-1">
                    <div className="space-y-2">
                      <p className="flex items-center gap-3 text-slate-700 font-medium"><Phone size={16} className="text-green-500"/> {c.whatsapp || 'Não informado'}</p>
                      {c.data_aniversario && <p className="flex items-center gap-3 text-slate-700 font-medium"><Cake size={16} className="text-pink-400"/> Niver: {new Date(c.data_aniversario).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</p>}
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                      <p className="flex items-start gap-3 font-black text-slate-800"><MapPin size={16} className="text-pink-500 mt-0.5 shrink-0"/> <span>{c.endereco}, {c.numero}</span></p>
                      <div className="ml-7 text-xs text-slate-500 space-y-1 font-medium"><p>Bairro: <span className="text-slate-700">{c.bairro || '-'}</span></p><p>Cidade: <span className="text-slate-700">{c.cidade || 'Navegantes'}</span></p><p>CEP: <span className="text-slate-700">{c.cep || 'Não informado'}</span></p></div>
                    </div>
                    {c.observacao && <div className="bg-pink-50/50 p-4 rounded-2xl border border-pink-100"><p className="flex items-start gap-2 text-pink-700 text-xs italic font-medium"><MessageSquare size={14} className="mt-0.5 shrink-0"/> "{c.observacao}"</p></div>}
                 </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'relatorios' && (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-xl font-black text-slate-500 uppercase tracking-widest print:text-black">Resumo de {nomesMeses[mesAtual]} / {anoAtual}</h2>
              <button onClick={() => window.print()} className="bg-slate-800 text-white px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg hover:bg-slate-700 transition-all print:hidden"><Printer size={20} /> Imprimir Relatório</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-pink-500 to-pink-600 p-8 rounded-[2.5rem] shadow-xl text-white relative overflow-hidden print:shadow-none print:border print:border-slate-300 print:text-black print:from-white print:to-white">
                <DollarSign size={100} className="absolute -right-4 -bottom-4 text-white/10 rotate-12 print:hidden" />
                <p className="font-bold text-pink-100 uppercase tracking-widest text-sm mb-2 print:text-slate-500">Faturamento Total</p>
                <p className="text-5xl font-black">R$ {faturamentoTotal.toFixed(2)}</p>
              </div>
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 relative overflow-hidden print:shadow-none print:border-slate-300">
                <ShoppingBag size={100} className="absolute -right-4 -bottom-4 text-slate-50 rotate-12 print:hidden" />
                <p className="font-bold text-slate-400 uppercase tracking-widest text-sm mb-2">Pedidos Realizados</p>
                <p className="text-5xl font-black text-slate-800">{pedidosDoMes.length}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 print:shadow-none print:border-slate-300">
                 <h3 className="font-black text-xl text-slate-800 mb-6 flex items-center gap-3"><TrendingUp className="text-pink-500 print:text-black"/> Produtos Mais Vendidos</h3>
                 {rankingProdutos.length > 0 ? (
                   <div className="space-y-4">
                     {rankingProdutos.map((prod, index) => (
                       <div key={index} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 print:bg-white print:border-b print:rounded-none">
                         <div className="flex items-center gap-4"><div className={`w-10 h-10 rounded-full flex items-center justify-center font-black shrink-0 print:bg-transparent print:border print:border-slate-300 print:text-black ${index === 0 ? 'bg-yellow-100 text-yellow-600' : index === 1 ? 'bg-slate-200 text-slate-600' : index === 2 ? 'bg-orange-100 text-orange-600' : 'bg-white text-slate-400'}`}>{index + 1}º</div><div><p className="font-black text-slate-800 text-[15px] leading-tight">{prod.nome}</p><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{prod.qtd} unidades</p></div></div>
                         <div className="text-right"><p className="font-black text-green-600 text-[15px] print:text-black">R$ {prod.valor.toFixed(2)}</p></div>
                       </div>
                     ))}
                   </div>
                 ) : <p className="text-slate-400 italic text-center py-6 text-sm">Nenhuma venda registrada ainda.</p>}
              </div>
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 print:shadow-none print:border-slate-300">
                 <h3 className="font-black text-xl text-slate-800 mb-6 flex items-center gap-3"><Award className="text-yellow-500 print:text-black"/> Clientes VIP (Mês)</h3>
                 {rankingClientes.length > 0 ? (
                   <div className="space-y-4">
                     {rankingClientes.map((cliente, index) => (
                       <div key={index} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 print:bg-white print:border-b print:rounded-none">
                         <div className="flex items-center gap-4"><div className={`w-10 h-10 rounded-full flex items-center justify-center font-black shrink-0 print:bg-transparent print:border print:border-slate-300 print:text-black ${index === 0 ? 'bg-yellow-100 text-yellow-600' : index === 1 ? 'bg-slate-200 text-slate-600' : index === 2 ? 'bg-orange-100 text-orange-600' : 'bg-white text-slate-400'}`}>{index + 1}º</div><div><p className="font-black text-slate-800 text-[15px] leading-tight">{cliente.nome}</p><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{cliente.qtdPedidos} pedido(s)</p></div></div>
                         <div className="text-right"><p className="font-black text-green-600 text-[15px] print:text-black">R$ {cliente.valorGasto.toFixed(2)}</p></div>
                       </div>
                     ))}
                   </div>
                 ) : <p className="text-slate-400 italic text-center py-6 text-sm">Nenhum cliente registrado neste mês.</p>}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL DE PRODUTOS */}
      {mostrarModalEstoque && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 print:hidden">
          <div className="bg-white p-8 rounded-[3rem] w-full max-w-md shadow-2xl overflow-y-auto max-h-[90vh]">
            <h2 className="text-2xl font-black mb-6 italic text-slate-800">{editandoId ? 'Editar Produto' : 'Novo Produto'}</h2>
            <form onSubmit={salvarProduto} className="space-y-4">
              <label className="w-full h-40 rounded-3xl bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer overflow-hidden hover:bg-slate-100 transition-all">
                {novoItem.imagem_url ? <img src={novoItem.imagem_url} className="w-full h-full object-cover" /> : <div className="text-center">{uploading ? <Loader2 className="animate-spin text-pink-500"/> : <><Camera className="mx-auto text-slate-400 mb-2" size={32}/><span className="text-xs font-bold text-slate-400 uppercase">Subir Foto</span></>}</div>}
                <input type="file" className="hidden" accept="image/*" onChange={handleUpload} disabled={uploading} />
              </label>
              <input placeholder="Nome do Doce" className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700" required value={novoItem.nome} onChange={e => setNovoItem({...novoItem, nome: e.target.value})} />
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase tracking-widest">Categoria</label>
                <select className="w-full p-4 rounded-2xl bg-slate-100 border-none font-bold text-slate-700 focus:ring-2 focus:ring-pink-500 outline-none" value={novoItem.categoria} onChange={e => setNovoItem({...novoItem, categoria: e.target.value})}>
                  <option value="Doces">🍬 Doces</option><option value="Bolos">🎂 Bolos</option><option value="Salgados">🥟 Salgados</option><option value="Bebidas">🥤 Bebidas</option>
                </select>
              </div>
              <textarea placeholder="Descrição (Ex: Massa de chocolate com recheio de ninho)" className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 font-medium text-slate-700" rows={2} value={novoItem.descricao} onChange={e => setNovoItem({...novoItem, descricao: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 ml-2 uppercase">Qtd Estoque</label><input type="number" className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 font-medium text-slate-700" required value={novoItem.quantidade} onChange={e => setNovoItem({...novoItem, quantidade: Number(e.target.value)})} /></div>
                <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 ml-2 uppercase">Preço R$</label><input type="number" step="0.01" className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 font-medium text-slate-700" required value={novoItem.preco} onChange={e => setNovoItem({...novoItem, preco: Number(e.target.value)})} /></div>
              </div>
              <button type="submit" disabled={uploading} className="w-full bg-pink-600 text-white p-5 rounded-[2rem] font-black uppercase shadow-lg shadow-pink-100 disabled:opacity-50 mt-4 transition-transform active:scale-95">{editandoId ? 'Salvar Alterações' : 'Salvar no Cardápio'}</button>
              <button type="button" onClick={fecharModal} className="w-full text-slate-400 font-bold text-[10px] uppercase p-2">Cancelar</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE TAXAS DE ENTREGA (AGORA DE 2 EM 2 KM) */}
      {mostrarModalTaxa && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 print:hidden">
          <div className="bg-white p-8 rounded-[3rem] w-full max-w-md shadow-2xl">
            <h2 className="text-2xl font-black mb-6 italic text-slate-800">{editandoTaxaId ? 'Editar Taxa' : 'Nova Taxa'}</h2>
            <form onSubmit={salvarTaxa} className="space-y-4">
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase tracking-widest">Distância (Raio de Entrega)</label>
                <select 
                  className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-bold text-slate-700 outline-none" 
                  value={novaTaxa.bairro} 
                  onChange={e => setNovaTaxa({...novaTaxa, bairro: e.target.value})}
                >
                  <option value="Até 2km">📍 Até 2 km</option>
                  <option value="Até 4km">📍 Até 4 km</option>
                  <option value="Até 6km">📍 Até 6 km</option>
                  <option value="Até 8km">📍 Até 8 km</option>
                  <option value="Até 10km">📍 Até 10 km</option>
                  <option value="Até 12km">📍 Até 12 km</option>
                  <option value="Até 14km">📍 Até 14 km</option>
                  <option value="Até 16km">📍 Até 16 km</option>
                  <option value="Até 18km">📍 Até 18 km</option>
                  <option value="Até 20km">📍 Até 20 km</option>
                  <option value="Acima de 20km">📍 Acima de 20 km (Sob Consulta)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 ml-2 uppercase tracking-widest">Valor da Taxa R$</label>
                <input type="number" step="0.01" className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-pink-500 font-medium text-slate-700" required value={novaTaxa.taxa} onChange={e => setNovaTaxa({...novaTaxa, taxa: Number(e.target.value)})} />
              </div>

              <button type="submit" className="w-full bg-pink-600 text-white p-5 rounded-[2rem] font-black uppercase shadow-lg shadow-pink-100 mt-4 transition-transform active:scale-95">{editandoTaxaId ? 'Salvar Alterações' : 'Cadastrar Taxa'}</button>
              <button type="button" onClick={fecharModalTaxa} className="w-full text-slate-400 font-bold text-[10px] uppercase p-2">Cancelar</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}