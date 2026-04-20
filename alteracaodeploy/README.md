# Alteracoes para Deploy

Data: 20/04/2026

## Financeiro - Novas funcionalidades

- Adicionado dashboard financeiro previsto x realizado.
- Adicionados campos `supplier` e `cost_center` em transacoes e compromissos.
- Adicionada importacao de extrato CSV no financeiro.
- Adicionada classificacao opcional por IA (Ollama) durante importacao CSV.
- Adicionado historico mensal persistido em `financial_monthly_history`.
- Adicionados endpoints de historico e relatorio mensal (JSON/CSV).

## Rotas novas do financeiro

- `GET /financeiro/dashboard`
- `POST /financeiro/importacoes/extrato-csv`
- `POST /financeiro/historico/snapshot`
- `GET /financeiro/historico`
- `GET /financeiro/relatorios/mensal`

## Banco de dados (tenant)

- Tabela nova: `financial_commitments`
- Tabela nova: `financial_occurrences`
- Tabela nova: `financial_payments`
- Tabela nova: `financial_monthly_history`
- Coluna nova em `transactions`: `supplier`
- Coluna nova em `transactions`: `cost_center`

## Vendas/WhatsApp - Correcoes

- Removido caractere especial que aparecia como `?` no WhatsApp.
- Mensagens de pedido agora incluem link de foto quando disponivel.
- Ajustado gerador de link em `apps/frontend/src/modules/vendas/lib/whatsapp.ts`.

## Variaveis de ambiente recomendadas

- `NEXT_PUBLIC_WHATSAPP_MEDIA_BASE_URL=https://api.seudominio.com`
- `IA_PROVIDER=ollama` (opcional)
- `OLLAMA_BASE_URL=http://localhost:11434` (ou servidor Ollama)
- `OLLAMA_MODEL=llama3.1:8b` (ou modelo configurado)

## Observacoes de deploy

- Reiniciar backend apos subir alteracoes para registrar rotas novas.
- Garantir que frontend aponta para backend correto (`NEXT_PUBLIC_API_URL`).
- Para preview de imagem no WhatsApp, usar URL publica (nao localhost).

## Atualizacao final (20/04/2026)

- Commit enviado para `main` com os ajustes funcionais de financeiro, vendas e estabilidade do frontend.
- Commit adicional de seguranca enviado para `main` com `npm audit fix` (sem breaking change) no backend e frontend.
- Build validado com sucesso:
  - `apps/backend`: `npm run build`
  - `apps/frontend`: `npm run build`

### Pendencias de seguranca (ainda abertas, exigem upgrade breaking)

- Backend:
  - `@fastify/jwt`/`fast-jwt` (critica) requer upgrade major para `@fastify/jwt@10`.
  - `node-ssdp`/`ip` (alta) requer upgrade major.
- Frontend:
  - `next` (alta) requer upgrade major para v16+.

> Recomendacao: executar esses upgrades em branch separada com bateria de testes antes de publicar em producao.
