# Plano mestre — Delivery e Encomendas Dulelis

Este documento acompanha a evolução do projeto para um único app com clientes compartilhados e duas jornadas: delivery imediato e encomendas agendadas.

## Etapas

- [x] Etapa 1 — Criar modelo de banco para clientes compartilhados, tipos de pedido, agendamento e capacidade. **Concluída e verificada no Supabase em 13/07/2026**
- [x] Etapa 2 — Centralizar e proteger no backend as regras de horário, taxa, estoque e encomendas. **Concluída e verificada no Supabase em 13/07/2026**
- [x] Etapa 3 — Reorganizar a estrutura do app e criar a entrada Delivery / Encomendas. **Concluída em 13/07/2026**
- [x] Etapa 4 — Construir o fluxo completo da página de encomendas. **Concluída e verificada ponta a ponta em 13/07/2026**
- [x] Etapa 5 — Adaptar pagamentos, acompanhamento e notificações para os dois tipos. **Concluída e verificada em 13/07/2026**
- [x] Etapa 6 — Criar agenda de produção e filas separadas no painel administrativo. **Concluída e verificada em 13/07/2026**
- [x] Etapa 7 — Migrar encomendas existentes, se houver fonte de dados disponível. **Concluída sem importação: nenhuma fonte migrável encontrada em 13/07/2026**
- [x] Etapa 8 — Testar integralmente, corrigir pendências e preparar publicação. **Concluída e publicada em 13/07/2026**

## Decisões de arquitetura

- Uma única tabela de clientes e uma única autenticação.
- A tabela `pedidos` continuará como registro central, diferenciando `delivery` de `encomenda`.
- Dados de nome, telefone e endereço permanecem copiados no pedido para preservar o histórico, mesmo quando o cliente atualizar seu cadastro.
- Delivery e encomendas terão horários, disponibilidade e capacidade independentes.
- Regras críticas serão validadas no servidor; a interface apenas apresentará o resultado.
- O painel terá uma fila imediata de delivery e uma agenda futura de produção.

## Registro de conclusão

Cada etapa só será marcada como concluída após implementação, verificação técnica e atualização deste documento.

## Progresso técnico atual

- Etapa 1: migração executada; estrutura nova, RPCs e colunas de compatibilidade (`pedidos.observacao` e `pedidos.troco_para`) verificadas diretamente no Supabase.
- Etapa 2: validação de horário no servidor implementada e verificada para horário normal, antes da abertura, loja desativada e funcionamento após a meia-noite.
- Etapa 2: cálculo de taxa por CEP movido para o servidor; o valor enviado pelo navegador deixou de ser a fonte de verdade.
- Etapa 2: checkout de um pedido existente agora confirma que o pedido pertence ao cliente autenticado.
- Etapa 2: reserva de estoque por cliente implementada com validade de 30 minutos, devolução automática de reservas expiradas e consumo na criação do pedido; migração e RPCs verificadas no Supabase.
- Etapa 2: validação de intervalos da agenda e revalidação de capacidade ao reativar encomendas foram adicionadas ao backend e ao gatilho do banco; horário inválido foi recusado diretamente pelo Supabase sem criar pedido de teste.
- Etapa 3: seletor Delivery/Encomendas criado nas duas jornadas; a rota `/encomendas` foi renderizada localmente com HTTP 200.
- Etapa 4: catálogo, personalizações, agenda, entrega/retirada, login/cadastro compartilhado e envio da encomenda já foram implementados; a validação ponta a ponta aguarda a migração no Supabase e produtos habilitados.
- Etapa 4: o painel agora também cadastra produtos exclusivos de encomenda e permite configurar visualmente tamanhos, sabores e outros campos de personalização.
- Etapa 4: 37 produtos do arquivo `cardapio.site/index.html` foram normalizados, importados no Supabase e verificados pela API pública, com unidades, preços, sabores e quantidades mínimas preservados.
- Etapa 4: catálogo público ganhou navegação por categorias e exibição correta de unidade de venda e quantidade mínima.
- Etapa 4: teste ponta a ponta criou conta compartilhada, recuperou sessão, criou uma encomenda real de retirada e confirmou sua presença em “Minhas encomendas”; pedido e cliente temporários foram removidos após a validação.
- Etapa 6: detalhes do evento, sabores e personalizações passaram a aparecer na agenda administrativa para orientar a produção.
- Etapa 5: checkout de sinal validado com geração de preferência do Mercado Pago; tentativa por outra conta retornou 403 e tentativa de pagar encomenda cancelada retornou 409, sem cobranças realizadas e com limpeza dos dados temporários.
- Etapa 5: pagamento integral agora respeita a configuração administrativa; encomenda cancelada não exibe ações de pagamento e o retorno do Mercado Pago direciona ao acompanhamento da encomenda.
- Etapa 5: RPC atômica e idempotente validada diretamente no Supabase: sinal de R$ 40 aplicado, repetição do mesmo pagamento ignorada, saldo de R$ 120 quitado e dois eventos financeiros únicos registrados; dados temporários removidos.
- Etapa 6: fila principal do painel passou a excluir encomendas; a agenda separada ganhou aviso visual e notificação do navegador para novos pedidos.
- Etapa 6: teste administrativo confirmou login e HTTP 200 no painel, pedido presente somente na agenda de encomendas e ausente da fila do delivery; dados temporários removidos.
- Etapa 7: planilhas e arquivos locais candidatos foram auditados sem alterar os originais; havia apenas um registro antigo de 09/02/2026, sem itens e sem dados suficientes para classificá-lo como encomenda. O Supabase não possuía encomendas reais ou futuras para migrar.
- Etapa 8: TypeScript, ESLint e build otimizado do Next.js passaram; o build gerou com sucesso as 40 rotas da aplicação.
- Etapa 8: `logo.png` e os oito ícones PWA/Admin foram restaurados do histórico do Git e serão mantidos provisoriamente até a revisão visual.
- Etapa 8: integração publicada pela automação ativa do repositório em 13/07/2026; domínio público verificado com HTTP 200 na página inicial, em `/encomendas`, na API pública do catálogo e nos arquivos visuais. A agenda `/admin/encomendas` redireciona visitantes sem sessão para o login, como esperado.
