# Plano de melhorias do App Dulelis

Auditoria realizada em **19/07/2026**. Este documento serve como lista de acompanhamento para executar as melhorias aos poucos, com validação e publicação controlada.

## Legenda

- `[ ]` Pendente
- `[~]` Em andamento
- `[x]` Concluído
- `[!]` Bloqueado ou exige decisão

## Estado da aplicação na auditoria

- Build de produção concluído com sucesso.
- ESLint concluído sem erros.
- TypeScript concluído sem erros.
- Não foram encontrados testes automatizados.
- Não foi encontrada uma rotina de CI no GitHub.
- A auditoria de dependências encontrou 6 vulnerabilidades de produção: 3 altas e 3 moderadas.
- A tela administrativa possui aproximadamente 8.776 linhas.
- A página principal do cliente possui aproximadamente 4.427 linhas.
- Foram encontrados aproximadamente 100 usos de `alert` e `confirm`.
- Nenhuma alteração funcional foi feita durante a auditoria.

---

## Fase 1 — Segurança urgente

### 1. Atualizar dependências vulneráveis

**Prioridade:** urgente  
**Status:** [~] Em andamento

- [x] Criar uma branch específica para as atualizações.
- [x] Atualizar Next.js de 16.1.6 para uma versão corrigida, inicialmente 16.2.10 ou superior compatível.
- [x] Atualizar `eslint-config-next` junto com o Next.js.
- [x] Atualizar Nodemailer para uma versão corrigida.
- [ ] Planejar a migração do SDK do Mercado Pago 2.x para 3.x.
- [~] Atualizar dependências transitivas vulneráveis, incluindo `uuid`, `postcss` e `ws`.
- [x] Executar lint, TypeScript e build depois de cada grupo de atualizações.
- [ ] Testar login administrativo, checkout, retorno do pagamento e webhook.
- [ ] Publicar primeiro em ambiente de teste antes da produção.

**Atualização em 21/07/2026:** Next.js e `eslint-config-next` foram atualizados para 16.2.11, React para 19.2.8 e Nodemailer para 9.0.3. As correções compatíveis reduziram a auditoria de 12 para 5 alertas. Permanecem alertas internos de `postcss`/`sharp` no Next.js mais recente e de `uuid` no Mercado Pago 2.x; serão tratados sem usar a correção forçada incompatível. TypeScript, ESLint e build de produção foram aprovados.

### 2. Proteger a exclusão geral da vitrine

**Prioridade:** urgente  
**Status:** [~] Em andamento  
**Arquivo atual:** `app/api/admin/reset-vitrine/route.ts`

- [x] Validar a origem da requisição no servidor.
- [x] Exigir que o administrador digite uma confirmação específica.
- [x] Exigir novamente a senha administrativa.
- [x] Registrar data, usuário, IP, ação e quantidade de registros removidos.
- [x] Criar backup antes da exclusão.
- [x] Evitar exclusões simultâneas parciais usando uma operação transacional.
- [x] Informar claramente que clientes, pedidos e tokens serão removidos.
- [ ] Avaliar exclusão lógica ou arquivamento em vez de exclusão definitiva.

**Atualização em 21/07/2026:** o reset passou a exigir a frase `EXCLUIR CLIENTES E PEDIDOS` e nova confirmação da senha administrativa. A API valida sessão e origem, limita tentativas e chama a função transacional definida em `sql/upgrade_admin_security_operations.sql`, que cria backup e log de auditoria antes da exclusão. O recurso permanece bloqueado com erro orientativo enquanto o SQL não for instalado no Supabase.

**Instalação confirmada em 21/07/2026:** as tabelas `admin_reset_backups` e `admin_audit_logs` foram verificadas no Supabase por consulta somente leitura. A função destrutiva não foi executada durante a validação para preservar os dados reais.

**Configuração de publicação em 21/07/2026:** `ADMIN_SESSION_SECRET` foi configurado com valores aleatórios separados nos ambientes Development, Preview e Production da Vercel.

### 3. Restringir a API administrativa genérica

**Prioridade:** urgente  
**Status:** [~] Em andamento  
**Arquivo atual:** `app/api/admin/db/route.ts`

- [x] Adicionar validação de origem para operações de escrita.
- [x] Aplicar rate limit às operações administrativas.
- [~] Validar payloads com esquemas definidos no servidor.
- [~] Permitir somente colunas específicas para cada tabela e operação.
- [~] Impedir alteração genérica de valores financeiros e status críticos.
- [ ] Criar rotas específicas para produtos, configurações, clientes, pedidos e precificação.
- [ ] Registrar histórico das alterações administrativas.
- [ ] Remover a rota genérica depois da migração das telas.

**Atualização em 21/07/2026:** foram adicionados limite de tamanho, limite de frequência, validação estrutural, filtros somente por `id`, limites para operações em lote e bloqueios específicos para pedidos. A tabela de clientes foi removida da lista genérica. A migração gradual para rotas específicas continua pendente.

### 4. Fortalecer a proteção do navegador

**Prioridade:** alta  
**Status:** [ ] Pendente  
**Arquivo atual:** `next.config.ts`

- [ ] Completar a política CSP com `default-src`, `script-src`, `style-src`, `img-src` e `connect-src`.
- [ ] Incluir somente os domínios necessários do Supabase, Mercado Pago, impressão e imagens.
- [ ] Testar a política em modo de relatório antes de bloquear recursos.
- [ ] Confirmar que checkout, PWA, imagens e painel continuam funcionando.

---

## Fase 2 — Integridade financeira e de pedidos

### 5. Criar um extrato real de créditos dos clientes

**Prioridade:** urgente  
**Status:** [ ] Pendente

Hoje o saldo é derivado dos dados de cancelamento dos pedidos. Deve existir um livro-caixa próprio de créditos e débitos.

- [ ] Criar tabela de movimentações de crédito.
- [ ] Registrar crédito gerado por cancelamento.
- [ ] Registrar crédito utilizado no delivery.
- [ ] Vincular cada movimentação ao cliente e ao pedido de origem.
- [ ] Vincular o débito ao novo pedido no qual o crédito foi usado.
- [ ] Incluir valor, data, motivo, origem, responsável e identificador de idempotência.
- [ ] Calcular o saldo pelo extrato, sem permitir edição direta do total.
- [ ] Permitir ajuste administrativo somente com justificativa e auditoria.
- [ ] Mostrar o extrato para o administrador.
- [ ] Mostrar saldo e uso do crédito para o cliente.
- [ ] Permitir uso parcial ou total no checkout do delivery.
- [ ] Impedir utilização duplicada em pagamentos concorrentes.
- [ ] Testar cancelamento, crédito, pagamento misto e estorno.

### 6. Formalizar a fila de impressão

**Prioridade:** alta  
**Status:** [ ] Pendente

- [ ] Criar status `aguardando`, `enviando`, `impresso` e `falha`.
- [ ] Registrar número de tentativas.
- [ ] Registrar data da última tentativa.
- [ ] Registrar quem imprimiu ou reimprimiu.
- [ ] Exigir motivo para reimpressão quando necessário.
- [ ] Garantir idempotência para não imprimir automaticamente duas vezes.
- [ ] Manter na fila pedidos pagos que ainda não foram impressos.
- [ ] Criar alerta visual para falhas.
- [ ] Separar claramente comprovantes de `DELIVERY` e `ENCOMENDA`.

### 7. Consolidar regras de estoque, pagamento e cancelamento

**Prioridade:** alta  
**Status:** [ ] Pendente

- [ ] Confirmar que todas as migrações das funções atômicas estão aplicadas na produção.
- [ ] Remover fallbacks temporários não atômicos depois da confirmação.
- [ ] Testar reserva simultânea da última unidade.
- [ ] Testar expiração e devolução da reserva.
- [ ] Testar webhook repetido do Mercado Pago.
- [ ] Validar tempo máximo aceitável do timestamp da assinatura do webhook.
- [ ] Testar pagamento pendente, aprovado, rejeitado e cancelado.
- [ ] Garantir que somente pedidos pagos e confirmados entrem na impressão.

---

## Fase 3 — Banco de dados, auditoria e infraestrutura

### 8. Organizar as migrações do Supabase

**Prioridade:** alta  
**Status:** [ ] Pendente

- [ ] Colocar as alterações SQL em uma sequência formal de migrações.
- [ ] Registrar a versão aplicada em cada ambiente.
- [ ] Criar procedimento de backup antes de migrações críticas.
- [ ] Conferir diferenças entre banco local, produção e arquivos SQL.
- [ ] Remover consultas alternativas usadas somente para esquemas antigos.
- [ ] Criar índices para cliente, pedido, status, data e fila de impressão.
- [ ] Validar RLS após cada migração.
- [ ] Documentar como reverter cada migração crítica.

### 9. Criar histórico de auditoria administrativa

**Prioridade:** alta  
**Status:** [ ] Pendente

- [ ] Registrar criação, edição, cancelamento, restauração e exclusão.
- [ ] Registrar alterações de preço, crédito, pagamento, estoque e configuração.
- [ ] Guardar valor anterior e valor novo quando aplicável.
- [ ] Guardar usuário, data, IP, motivo e entidade afetada.
- [ ] Criar tela para consulta por período, usuário e tipo de ação.
- [ ] Impedir alteração ou exclusão dos registros de auditoria pelo painel comum.

### 10. Garantir rate limit centralizado

**Prioridade:** alta  
**Status:** [ ] Pendente  
**Arquivo atual:** `lib/rate-limit.ts`

- [ ] Confirmar `UPSTASH_REDIS_REST_URL` na Vercel.
- [ ] Confirmar `UPSTASH_REDIS_REST_TOKEN` na Vercel.
- [ ] Testar o rate limit em mais de uma instância.
- [ ] Criar monitoramento quando o serviço centralizado falhar.
- [ ] Definir limites separados para login, recuperação de senha, pedidos, fotos e pagamento.
- [ ] Avaliar se operações críticas devem falhar de forma fechada quando o limitador estiver indisponível.

### 11. Observabilidade e alertas

**Prioridade:** média/alta  
**Status:** [ ] Pendente

- [ ] Registrar erros do frontend e das APIs em uma ferramenta centralizada.
- [ ] Criar alertas para falha de webhook, pagamento, impressão e e-mail.
- [ ] Monitorar tempo de resposta das rotas principais.
- [ ] Monitorar volume de consultas e erros do Supabase.
- [ ] Criar identificador de correlação para acompanhar um pedido entre checkout, webhook e impressão.
- [ ] Evitar registrar senhas, tokens, dados completos de pagamento ou informações pessoais sensíveis.

---

## Fase 4 — Desempenho e organização do código

### 12. Reduzir atualizações automáticas e polling

**Prioridade:** alta  
**Status:** [ ] Pendente

- [ ] Usar realtime como mecanismo principal.
- [ ] Usar polling somente como fallback.
- [ ] Aumentar intervalos de segurança para 30–60 segundos quando possível.
- [ ] Pausar consultas quando a aba estiver oculta.
- [ ] Aplicar backoff quando houver erro ou perda de conexão.
- [ ] Evitar recarregar dados enquanto o administrador está editando um formulário.
- [ ] Atualizar somente o registro alterado em vez de recarregar tudo.
- [ ] Isolar o relógio da loja para não renderizar a página inteira a cada segundo.

### 13. Dividir a carga do painel administrativo

**Prioridade:** alta  
**Status:** [ ] Pendente  
**Arquivo atual:** `app/api/admin/data/route.ts`

- [ ] Criar endpoint separado para cada área do painel.
- [ ] Carregar somente os dados da aba aberta.
- [ ] Paginar clientes, pedidos, entregas e histórico.
- [ ] Adicionar filtros de data, status e pesquisa no servidor.
- [ ] Selecionar somente as colunas necessárias.
- [ ] Criar consultas resumidas para os indicadores do painel geral.
- [ ] Definir estratégia de cache para dados pouco alterados.

### 14. Modularizar as telas grandes

**Prioridade:** alta  
**Status:** [ ] Pendente

- [ ] Separar a página do cliente em autenticação, vitrine, carrinho, checkout, acompanhamento e perfil.
- [ ] Separar o painel em agenda, configurações, produtos, precificação, clientes, pedidos, impressão e relatórios.
- [ ] Extrair hooks de dados e regras de negócio.
- [ ] Extrair componentes de formulário reutilizáveis.
- [ ] Reduzir o uso de `any` e criar tipos de domínio compartilhados.
- [ ] Evitar que uma alteração em uma área provoque renderização do painel inteiro.

### 15. Otimizar imagens e recursos

**Prioridade:** média  
**Status:** [ ] Pendente

- [ ] Converter `public/logo.png` para formato otimizado.
- [ ] Gerar tamanhos adequados para celular e desktop.
- [ ] Revisar imagens que usam `<img>` diretamente.
- [ ] Definir dimensões para evitar mudança de layout durante o carregamento.
- [ ] Comprimir imagens enviadas pelo painel.
- [ ] Revisar cache do service worker após cada alteração de recursos.

---

## Fase 5 — Privacidade e experiência do cliente

### 16. Proteger fotos de referência dos bolos

**Prioridade:** alta  
**Status:** [ ] Pendente  
**Arquivo atual:** `app/api/public/preorders/reference-image/route.ts`

- [ ] Mover fotos de referência para bucket privado.
- [ ] Gerar links assinados com validade limitada.
- [ ] Validar o conteúdo real do arquivo, não somente o MIME informado.
- [ ] Limitar tamanho, formato e dimensões.
- [ ] Comprimir a imagem antes ou depois do envio.
- [ ] Excluir foto quando o cliente remover a referência.
- [ ] Excluir imagens órfãs de pedidos abandonados.
- [ ] Definir prazo de retenção para fotos de pedidos finalizados ou cancelados.
- [ ] Confirmar que a foto aparece somente na encomenda de bolo.

### 17. Substituir `alert` e `confirm`

**Prioridade:** média/alta  
**Status:** [ ] Pendente

- [ ] Criar componente padrão de notificação.
- [ ] Criar modal padrão de confirmação.
- [ ] Exibir erros próximos aos campos correspondentes.
- [ ] Adicionar estado `Salvando...` aos botões.
- [ ] Bloquear cliques duplicados durante operações.
- [ ] Manter dados digitados quando uma requisição falhar.
- [ ] Usar mensagens claras para sucesso, erro e conexão offline.

### 18. Melhorar acessibilidade

**Prioridade:** média  
**Status:** [ ] Pendente

- [ ] Testar navegação somente pelo teclado.
- [ ] Garantir foco visível nos controles.
- [ ] Associar labels a todos os campos.
- [ ] Anunciar mensagens importantes com regiões acessíveis.
- [ ] Revisar contraste de textos e botões.
- [ ] Aumentar áreas de toque pequenas no celular.
- [ ] Testar zoom de 200% e fontes maiores.
- [ ] Adicionar textos alternativos adequados às imagens.
- [ ] Validar a ordem de títulos e pontos de navegação.

### 19. Melhorar resiliência offline e PWA

**Prioridade:** média  
**Status:** [ ] Pendente

- [ ] Revisar a estratégia de cache do service worker.
- [ ] Garantir que dados antigos sejam identificados como desatualizados.
- [ ] Não armazenar respostas com informações sensíveis.
- [ ] Mostrar claramente quando o aplicativo estiver offline.
- [ ] Criar atualização segura quando uma nova versão for publicada.
- [ ] Testar instalação e atualização no Android e iPhone.

---

## Fase 6 — Testes e publicação segura

### 20. Criar testes automatizados

**Prioridade:** urgente  
**Status:** [ ] Pendente

- [ ] Escolher ferramentas para testes unitários, integração e navegador.
- [ ] Testar reserva e devolução de estoque.
- [ ] Testar concorrência pela última unidade.
- [ ] Testar cadastro, login e recuperação de senha.
- [ ] Testar pagamento aprovado, pendente, rejeitado e duplicado.
- [ ] Testar webhook repetido e assinatura inválida.
- [ ] Testar cancelamento, reagendamento e geração de crédito.
- [ ] Testar uso parcial e total do crédito no delivery.
- [ ] Testar pedido pago entrando na fila de impressão.
- [ ] Testar restauração de pedido cancelado para a agenda.
- [ ] Testar foto de referência somente para bolo.
- [ ] Testar permissões e ações administrativas destrutivas.

### 21. Configurar CI no GitHub

**Prioridade:** alta  
**Status:** [ ] Pendente

- [ ] Executar lint em cada push e pull request.
- [ ] Executar verificação do TypeScript.
- [ ] Executar testes automatizados.
- [ ] Executar build de produção.
- [ ] Executar auditoria de dependências.
- [ ] Bloquear publicação quando uma verificação crítica falhar.
- [ ] Usar ambiente de preview da Vercel antes da produção.

### 22. Criar procedimento de publicação

**Prioridade:** alta  
**Status:** [ ] Pendente

- [ ] Fazer backup do banco quando a alteração afetar dados.
- [ ] Criar commit pequeno e descritivo para cada grupo de mudanças.
- [ ] Publicar primeiro em preview.
- [ ] Executar checklist manual de cliente e administrador.
- [ ] Confirmar checkout e webhook com pagamento de teste.
- [ ] Confirmar impressão de delivery e encomenda.
- [ ] Publicar em produção.
- [ ] Monitorar erros imediatamente após a publicação.
- [ ] Manter plano de reversão para mudanças críticas.

---

## Ordem recomendada para começar

1. Atualizar Next.js e demais dependências vulneráveis.
2. Proteger a exclusão geral e a API administrativa genérica.
3. Criar testes dos fluxos críticos antes de alterações financeiras maiores.
4. Criar o extrato real de créditos e integrar seu uso ao delivery.
5. Formalizar fila de impressão, estoque e pagamentos.
6. Reduzir atualizações automáticas e dividir a carga do painel.
7. Organizar migrações e auditoria administrativa.
8. Modularizar as telas grandes.
9. Proteger as fotos e melhorar privacidade.
10. Melhorar mensagens, acessibilidade, PWA e imagens.

## Registro de andamento

| Data | Item | Alteração | Testes executados | Commit/publicação |
|---|---|---|---|---|
| 19/07/2026 | Auditoria inicial | Plano criado, sem alteração funcional | Build, ESLint, TypeScript e auditoria de dependências | Não publicado |
