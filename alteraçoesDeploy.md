# ALTERAÇÕES PARA DEPLOY
# ============================================================
# Este arquivo é um LEMBRETE pessoal de tudo que foi alterado
# durante o desenvolvimento. Antes de fazer o deploy em produção,
# execute cada item desta lista na ordem indicada.
# ============================================================

Data de criação: 18/04/2026
Projeto: SaaS Multitenant — Módulo TV + Xibo

---

## ✅ NOVAS ALTERAÇÕES (20/04/2026) — FINANCEIRO + WHATSAPP

## ✅ NOVAS ALTERAÇÕES (20/04/2026) — ESTABILIZAÇÃO FRONT + CATÁLOGO VENDAS

### Catálogo de vendas (card do produto + carrinho)
- Card de produto atualizado para selecionar quantidade no próprio card (mínimo 1 e máximo 99).
- Botão **Comprar agora** passou a usar a quantidade selecionada ao gerar mensagem do WhatsApp.
- Botão **Adicionar ao carrinho** passou a enviar a quantidade selecionada.
- Carrinho com proteção de limite por item: máximo 99 unidades por produto.
- Fallback de imagem melhorado:
  - Novo arquivo: `apps/frontend/public/images/sem-foto-produto.svg`
  - Usado no card e no drawer do carrinho quando faltar foto ou URL quebrar.

### Correções técnicas para estabilidade
- Backend (financeiro): corrigido erro de runtime
  - `CreateCommitmentSchema.partial is not a function`
  - Ajuste aplicado em `apps/backend/src/modules/financeiro/financeiro.schema.ts` com schema base reutilizável para create/update.
- Frontend (admin IA): corrigido erro de tipo que quebrava build
  - Arquivo: `apps/frontend/src/app/admin/ia/page.tsx`
  - Ajuste em `getExecutionStatus(...)` para aceitar `Record<string, unknown>` sem cast inválido.

### Observação operacional (desenvolvimento local)
- Foi necessário limpar cache do Next (`.next`) e reiniciar o frontend em alguns ciclos por corrupção de chunks no hot reload.
- Em caso de erro `Cannot find module './xxx.js'`, repetir:
  1. parar frontend
  2. apagar `apps/frontend/.next`
  3. iniciar novamente

---

### Financeiro (segunda camada + histórico mensal)
- Novo endpoint: `GET /financeiro/dashboard?months=6`
- Novo endpoint: `POST /financeiro/importacoes/extrato-csv`
- Novo endpoint: `POST /financeiro/historico/snapshot`
- Novo endpoint: `GET /financeiro/historico`
- Novo endpoint: `GET /financeiro/relatorios/mensal?format=json|csv`
- Novas tabelas por tenant:
  - `financial_commitments`
  - `financial_occurrences`
  - `financial_payments`
  - `financial_monthly_history`
- Novas colunas em `transactions`:
  - `supplier`
  - `cost_center`

### Vendas/WhatsApp (correção do "�" e foto no pedido)
- Símbolo de item alterado de caractere especial para ASCII:
  - de `▶` para `-`
- Mensagem enviada para o WhatsApp agora inclui link de foto do produto:
  - `Foto: https://...`
- Arquivo alterado:
  - `apps/frontend/src/modules/vendas/lib/whatsapp.ts`

### Variável nova recomendada para produção (WhatsApp imagem)
```env
NEXT_PUBLIC_WHATSAPP_MEDIA_BASE_URL="https://api.seudominio.com"
```

> Importante: se usar `localhost` no link de imagem, o WhatsApp não consegue
> gerar preview para outros dispositivos.

---

## ✅ O QUE FOI FEITO (resumo geral)

- Módulo de TV expandido com sistema de planos (3, 5, 10 TVs ou Custom)
- Integração com Xibo CMS via API JSON (server-to-server, sem CORS)
- Painel frontend com páginas de Plano e Inventário de Dispositivos
- 5 erros de backend corrigidos

---

## 📦 1. BANCO DE DADOS — RODAR MIGRAÇÕES NOS TENANTS EXISTENTES

> ⚠️ OBRIGATÓRIO antes de subir o backend em produção.
> Para novos tenants criados DEPOIS do deploy, o provisioner já inclui tudo.

### Migração 1 — Plano de TVs e device_role
Cria a tabela `tenant_tv_plan` e adiciona a coluna `device_role` em `tv_devices`
para todos os tenants já existentes no banco.

```bash
cd apps/backend
npm run db:migrate:tv-plan
```

**O que faz:**
- Cria `tenant_tv_plan` com plan_tier, plan_mode, max_client_tvs etc.
- Adiciona coluna `device_role VARCHAR(20) DEFAULT 'CLIENT'` em `tv_devices`
- Adiciona constraint `tv_devices_device_role_check` separada (correção de bug)
- Insere linha default `(CUSTOM, SELF, max_client_tvs=5)` se ainda não existir

---

### Migração 2 — Tabela de anúncios da plataforma (Xibo)
Cria a tabela `xibo_platform_ads` em cada schema de tenant.

```bash
cd apps/backend
npm run db:migrate:xibo-ads
```

**O que faz:**
- Cria `xibo_platform_ads` com titulo, video_url, duracao_segundos, thumb_url, ativo
- Cria índice parcial `idx_xibo_platform_ads_ativo` para queries de anúncios ativos

---

## 🔑 2. VARIÁVEIS DE AMBIENTE — ADICIONAR NO SERVIDOR

Adicionar as variáveis abaixo no `.env` de produção (uma por tenant ativo):

```env
# Gere cada token com:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

XIBO_API_TOKEN_<UUID_DO_TENANT_SEM_HIFENS>="token_gerado_aqui"
```

**Como pegar o UUID do tenant:**
- Acesse o painel `/admin/tenants` e copie o ID do tenant
- Remova os hifens do UUID: `550e8400-e29b-41d4-a716-446655440000` → `550e8400e29b41d4a716446655440000`

**Exemplo no `.env`:**
```env
XIBO_API_TOKEN_550e8400e29b41d4a716446655440000="a3f9e1b2c4d5..."
```

**Onde usar esse token no Xibo CMS:**
```
DataSets > Add DataSet > Remote
  URL: https://seusite.com/api/v1/xibo/products?token=SEU_TOKEN
  URL: https://seusite.com/api/v1/xibo/platform-ad?token=SEU_TOKEN
  Método: GET
```

---

## 🖥️ 3. NOVAS ROTAS DO BACKEND

Rotas adicionadas neste ciclo de desenvolvimento:

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/tv/plan` | Plano do tenant (tier, modo, limites, uso atual) |
| GET | `/api/v1/xibo/products?token=` | JSON de produtos ativos para Xibo DataSet |
| GET | `/api/v1/xibo/platform-ad?token=` | JSON de anúncios da plataforma para Xibo |

---

## 🌐 4. NOVAS PÁGINAS DO FRONTEND

| Página | Rota | Descrição |
|--------|------|-----------|
| Plano de TVs | `/{slug}/tv/planos` | Mostra tier, modo, barra de uso, botão upgrade |
| Inventário de TVs | `/{slug}/tv/dispositivos` | Tabela com badge CLIENT/PLATFORM_ADS |

---

## 🐛 5. BUGS CORRIGIDOS (não precisam de ação no deploy, já estão no código)

| # | Onde | Problema | Correção |
|---|------|----------|----------|
| 1 | `prisma/migrate-tenant-tv-plan.ts` | `ALTER TABLE ADD COLUMN IF NOT EXISTS` com CHECK inline falha no PostgreSQL | Separado em dois statements: `ADD COLUMN` e depois `ADD CONSTRAINT IF NOT EXISTS` |
| 2 | `tv.schema.ts` + `tv.repository.ts` | `device_role` não estava no schema Zod nem no INSERT | Adicionado campo `device_role` com default `CLIENT` em ambos |
| 3 | `xiboData.service.ts` | DDL (`CREATE TABLE`, `CREATE INDEX`) dentro de `listXiboPlatformAds` — executava a cada GET | DDL removido; agora só existe nas migrações |
| 4 | `fastify.d.ts` + `xiboTenantResolver.service.ts` | `XiboTenantContext` definida em `routes/xibo/` e importada por `core/types/` (dependência invertida) | Interface movida para `core/types/xibo.types.ts` |
| 5 | `.env.example` | Variáveis `XIBO_API_TOKEN_*` não documentadas | Criado `.env.example` com seção completa e instruções |

---

## 📋 6. CHECKLIST PRÉ-DEPLOY

- [ ] Docker / PostgreSQL acessível no servidor de produção
- [ ] `.env` de produção atualizado com `XIBO_API_TOKEN_*` para cada tenant
- [ ] Rodar `npm run db:migrate:tv-plan` no servidor de produção
- [ ] Rodar `npm run db:migrate:xibo-ads` no servidor de produção
- [ ] Testar `GET /api/v1/xibo/products?token=SEU_TOKEN` retorna JSON
- [ ] Testar `GET /api/v1/xibo/platform-ad?token=SEU_TOKEN` retorna JSON
- [ ] Testar `GET /tv/plan` retorna plano do tenant
- [ ] Verificar página `/{slug}/tv/planos` no frontend
- [ ] Verificar página `/{slug}/tv/dispositivos` no frontend
- [ ] Configurar DataSets no Xibo CMS apontando para os endpoints acima

---

## 📁 7. ARQUIVOS NOVOS (não existiam antes)

```
apps/backend/
  src/core/types/xibo.types.ts          ← interface XiboTenantContext
  src/modules/tv/tvLimitService.ts      ← getTvLimit + getTvPlan
  src/modules/tv/tv.limit.middleware.ts ← checkTvLimit middleware
  src/routes/xibo/
    xiboToken.service.ts
    xiboTenantResolver.service.ts
    xiboAuth.middleware.ts
    xiboData.service.ts
    xibo.controller.ts
    xibo.routes.ts
    *.test.ts                            ← testes unitários Vitest
  prisma/migrate-tenant-tv-plan.ts
  prisma/migrate-xibo-platform-ads.ts
  .env.example                           ← NOVO: documentação de variáveis
  vitest.config.ts

apps/frontend/
  src/modules/tv/TvPlanPanel.tsx
  src/modules/tv/TvDevicesTable.tsx
  src/app/[slug]/tv/planos/page.tsx
  src/app/[slug]/tv/dispositivos/page.tsx
```

---

## 📝 OBSERVAÇÕES IMPORTANTES

- **O Fastify NÃO manda comandos para o Xibo.** Ele apenas entrega JSON.
  Quem monta layout e decide quando tocar é o Xibo CMS via Campaign/Schedule.
- **Não foi alterado o CORS** — a integração Xibo é server-to-server.
- **Não foi criado scheduler** — o Xibo faz polling respeitando o `Cache-Control: max-age=300`.
- Os 20% de tempo de tela da parceria são configurados via Campaign no Xibo, não no código.
