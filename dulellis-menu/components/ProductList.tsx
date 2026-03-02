'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface ProductListProps {
  onAdicionar: (produto: any) => void
}

export default function ProductList({ onAdicionar }: ProductListProps) {
  const [produtos, setProdutos] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    async function carregarProdutos() {
      try {
        // Buscamos tudo da tabela 'produtos'
        const { data, error } = await supabase.from('produtos').select('*')
        
        if (error) {
          console.error('Erro no Supabase:', error.message)
        } else {
          setProdutos(data || [])
        }
      } catch (err) {
        console.error('Erro de conex\u00E3o:', err)
      } finally {
        setCarregando(false)
      }
    }
    carregarProdutos()
  }, [])

  if (carregando) {
    return (
      <div className="flex justify-center p-20">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-500"></div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {produtos.length === 0 ? (
        <p className="text-center col-span-full text-gray-400">Nenhum doce encontrado no card\u00E1pio.</p>
      ) : (
        produtos.map((item: any, index: number) => {
          // LOGICA DE DETECCAO AUTOMATICA DE PRECO
          // Ele tenta encontrar o valor em qualquer uma dessas colunas:
          const precoEncontrado = item.preco ?? item.valor ?? item.Preco ?? item.Valor ?? 0;

          return (
            <div 
              key={item.id || index} 
              className="bg-white border border-pink-100 rounded-3xl p-5 flex flex-col shadow-sm hover:shadow-xl transition-all duration-300"
            >
              {item.imagem_url && (
                <img 
                  src={item.imagem_url} 
                  alt={item.nome} 
                  className="w-full h-48 object-cover rounded-2xl mb-4" 
                />
              )}
              
              <h3 className="text-xl font-bold text-gray-800">{item.nome || 'Doce sem nome'}</h3>
              <p className="text-gray-500 text-sm mt-2 flex-grow">
                {item.descricao || 'Feito com ingredientes selecionados.'}
              </p>
              
              <div className="flex justify-between items-center mt-6">
                <div className="flex flex-col">
                  <span className="text-xs text-gray-400 font-bold uppercase">Pre\u00E7o</span>
                  <span className="text-2xl font-black text-pink-600">
                    R$ {Number(precoEncontrado).toFixed(2).replace('.', ',')}
                  </span>
                </div>
                
                <button 
                  onClick={() => onAdicionar({ ...item, preco: precoEncontrado })}
                  className="bg-pink-500 text-white font-bold px-6 py-3 rounded-2xl hover:bg-pink-600 active:scale-95 transition-all shadow-lg shadow-pink-100"
                >
                  Adicionar
                </button>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
