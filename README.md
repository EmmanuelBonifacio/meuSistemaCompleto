# 🏢 SaaS Multitenant System

> Plataforma modular de SaaS com isolamento total de dados por cliente, construída com **Node.js + Fastify + Prisma + PostgreSQL**, com suporte nativo a **Digital Signage via UPnP/DIAL**.

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura: Schema-per-Tenant](#arquitetura-schema-per-tenant)
3. [Stack Tecnológica](#stack-tecnológica)
4. [Pré-Requisitos](#pré-requisitos)
5. [Início Rápido (Docker)](#início-rápido-docker)
6. [Variáveis de Ambiente](#variáveis-de-ambiente)
7. [Módulos Disponíveis](#módulos-disponíveis)
   - [Gestão de Estoque](#gestão-de-estoque)
   - [Módulo Financeiro](#módulo-financeiro)
   - [Controle de Telas (Digital Signage)](#controle-de-telas-digital-signage)
8. [Painel de Administração](#painel-de-administração)
9. [Como Criar um Novo Módulo (Guia Lego)](#como-criar-um-novo-módulo-guia-lego)
10. [Como o TV Control Funciona](#como-o-tv-control-funciona)
11. [Como Testar o Controle de TV](#como-testar-o-controle-de-tv)
12. [Referência de API](#referência-de-api)
13. [Segurança](#segurança)
14. [Dicionário Técnico](#dicionário-técnico)

---

## Visão Geral

Este sistema foi projetado para empresas que precisam servir múltiplos clientes (tenants) com **completo isolamento de dados**, onde cada cliente tem seu próprio espaço no banco de dados e pode ativar ou desativar módulos de acordo com seu plano de assinatura.

**Casos de uso típicos:**

- Redes de franquias (cada loja é um tenant)
- WhiteLabel SaaS (você revende com a marca do cliente)
- Holding com múltiplas empresas em uma única plataforma
- Rede de hotéis/hospitais com gestão centralizada

---

## Arquitetura: Schema-per-Tenant

O padrão adotado é **Schema-per-Tenant no PostgreSQL**, onde cada cliente possui um schema (namespace) isolado dentro do mesmo banco de dados:

```
PostgreSQL Database: saas_db
│
├── public (gerenciado pelo Prisma — dados globais do sistema)
│   ├── tenants            ← cada linha = 1 cliente
│   ├── modules            ← catálogo: estoque, financeiro, tv, ...
│   ├── tenant_modules     ← quais módulos cada tenant tem ativos
│   └── admin_users        ← administradores da plataforma
│
├── tenant_empresa_a (criado dinamicamente ao provisionar)
│   ├── products           ← dados exclusivos da Empresa A
│   ├── transactions       ← dados exclusivos da Empresa A
│   └── tv_devices         ← dados exclusivos da Empresa A
│
├── tenant_empresa_b (completamente isolado da empresa_a)
│   ├── products           ← dados exclusivos da Empresa B
│   ├── transactions       ← dados exclusivos da Empresa B
│   └── tv_devices         ← dados exclusivos da Empresa B
│
└── tenant_empresa_c ...
```

**Como o isolamento é garantido:**

Cada requisição à API passa pelo `tenantMiddleware`, que:

1. Valida o JWT e extrai o `tenantId`
2. Busca o tenant no banco e verifica se está ativo
3. Armazena `schemaName` em `request.tenant`

Antes de cada query de módulo, o `withTenantSchema()` executa:

```sql
SET LOCAL search_path TO "tenant_empresa_a", public
```

A partir daí, `SELECT * FROM products` vai automaticamente para `tenant_empresa_a.products`. É **impossível** acessar dados de outro tenant acidentalmente.

---

## Stack Tecnológica

| Tecnologia       | Versão | Papel                                       |
| ---------------- | ------ | ------------------------------------------- |
| Node.js          | 18+    | Runtime                                     |
| Fastify          | v5     | Framework HTTP (plugin-based)               |
| TypeScript       | v5     | Type safety                                 |
| Prisma ORM       | v6     | Gerenciamento de schema public + migrations |
| PostgreSQL       | 15     | Banco de dados com schemas isolados         |
| @fastify/jwt     | v9     | Autenticação JWT (HS256)                    |
| Zod              | v3     | Validação de schemas de input               |
| node-ssdp        | v4     | Descoberta SSDP (módulo TV)                 |
| Docker / Compose |        | Ambiente de desenvolvimento                 |
| tsx              |        | Execução TypeScript em dev                  |
| pino-pretty      |        | Logs coloridos em desenvolvimento           |

---

## Pré-Requisitos

- **Docker Desktop** instalado e rodando
- **Node.js 18+** com npm
- **Git**

> ⚠️ Se você tiver um PostgreSQL local rodando na porta 5432, este projeto usa a porta **5433** para evitar conflito (configurado no `docker-compose.yml`).

---

## Início Rápido (Docker)

### 1. Clone e instale dependências

```bash
git clone <repo-url>
cd meuSistemaCompleto
npm install
```

### 2. Configure as variáveis de ambiente

```bash
# Copie o arquivo de exemplo
cp .env.example .env
```

Veja a seção [Variáveis de Ambiente](#variáveis-de-ambiente) para todos os valores necessários.

### 3. Suba os containers

```bash
docker-compose up -d
```

Isso inicia:

- **PostgreSQL 15** na porta `5433` (container: `saas_multitenant_db`)
- **pgAdmin 4** na porta `5050` (interface web opcional para o banco)

### 4. Execute as migrations

```bash
npm run db:migrate:dev
```

Isso cria as tabelas do schema `public` (tenants, modules, tenant_modules, admin_users) via Prisma.

### 5. Execute o seed

```bash
npm run db:seed
```

Isso popula o banco com:

- **5 módulos** no catálogo: estoque, financeiro, vendas, rh, tv
- **1 usuário admin** padrão: `admin@sistema.com` (senha: `admin123` — **mude em produção!**)

### 6. Inicie o servidor

```bash
npm run dev
```

O servidor sobe em `http://localhost:3000` com hot-reload automático.

### 7. Crie seu primeiro tenant

```bash
curl -X POST http://localhost:3000/dev/provisionar-tenant \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Minha Empresa",
    "slug": "minha-empresa",
    "moduleNames": ["estoque", "financeiro", "tv"]
  }'
```

### 8. Gere um token de acesso

```bash
curl -X POST http://localhost:3000/dev/token \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "<ID_RETORNADO_NO_PASSO_7>",
    "userId": "user-001"
  }'
```

Agora você pode usar o token em qualquer rota protegida: `Authorization: Bearer <token>`.

---

## Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
# Conexão com PostgreSQL (Prisma usa esta DATABASE_URL)
DATABASE_URL="postgresql://saas_user:saas_password@localhost:5433/saas_db?schema=public"

# Secret para assinar tokens JWT (mínimo 32 caracteres)
# Gere um valor seguro em produção: openssl rand -hex 32
JWT_SECRET="sua-chave-secreta-super-segura-de-pelo-menos-32-chars"

# Porta do servidor (default: 3000)
PORT=3000

# Ambiente (development | production | test)
NODE_ENV=development

# Expiração dos tokens de acesso
JWT_ACCESS_TOKEN_EXPIRATION=1h
```

> ⚠️ **NUNCA** comite o `.env` em repositórios públicos. Use `.env.example` com valores fictícios para documentação.

---

## Módulos Disponíveis

Cada módulo é um **plugin Fastify independente** que pode ser ativado ou desativado por tenant pelo painel Admin.

---

### Gestão de Estoque

**Rota base:** `/estoque`  
**Requer módulo:** `estoque`

Gerencia o inventário de produtos de cada tenant com suporte a paginação, busca e soft delete.

#### Endpoints

| Método   | URL                     | Descrição                                    |
| -------- | ----------------------- | -------------------------------------------- |
| `GET`    | `/estoque/produtos`     | Lista produtos com paginação e filtros       |
| `GET`    | `/estoque/produtos/:id` | Detalhes de um produto                       |
| `POST`   | `/estoque/produtos`     | Cadastra novo produto                        |
| `PATCH`  | `/estoque/produtos/:id` | Atualiza produto (somente campos fornecidos) |
| `DELETE` | `/estoque/produtos/:id` | Desativa produto (soft delete)               |

#### Query Parameters (GET /estoque/produtos)

| Parâmetro    | Tipo    | Padrão | Descrição                         |
| ------------ | ------- | ------ | --------------------------------- |
| `page`       | number  | 1      | Página atual                      |
| `limit`      | number  | 20     | Itens por página (máx 100)        |
| `search`     | string  | —      | Busca por nome (case-insensitive) |
| `onlyActive` | boolean | true   | Filtra apenas ativos              |

#### Exemplo de uso

```bash
# Cadastrar produto
curl -X POST http://localhost:3000/estoque/produtos \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Notebook Dell Inspiron",
    "description": "15 polegadas, 16GB RAM",
    "price": 3500.00,
    "quantity": 10,
    "sku": "NB-DELL-001"
  }'
```

---

### Módulo Financeiro

**Rota base:** `/financeiro`  
**Requer módulo:** `financeiro`

Gerencia transações financeiras (receitas e despesas) com resumo de fluxo de caixa.

#### Endpoints

| Método   | URL                          | Descrição                                        |
| -------- | ---------------------------- | ------------------------------------------------ |
| `GET`    | `/financeiro/transacoes`     | Lista transações com filtros e resumo financeiro |
| `GET`    | `/financeiro/transacoes/:id` | Detalhes de uma transação                        |
| `POST`   | `/financeiro/transacoes`     | Registra nova transação                          |
| `PATCH`  | `/financeiro/transacoes/:id` | Atualiza transação                               |
| `DELETE` | `/financeiro/transacoes/:id` | Remove transação (hard delete)                   |

#### Tipos de transação

- `receita` — entrada de dinheiro (vendas, recebimentos)
- `despesa` — saída de dinheiro (compras, pagamentos)

#### Exemplo de uso

```bash
# Registrar receita
curl -X POST http://localhost:3000/financeiro/transacoes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "receita",
    "amount": 1500.00,
    "description": "Venda de produto XYZ",
    "category": "Vendas",
    "transactionDate": "2026-01-15"
  }'

# Resumo financeiro retornado no GET /transacoes:
# {
#   "resumo": {
#     "totalReceitas": 5000.00,
#     "totalDespesas": 2000.00,
#     "saldo": 3000.00
#   }
# }
```

---

### Controle de Telas (Digital Signage)

**Rota base:** `/tv`  
**Requer módulo:** `tv`

Gerencia Smart TVs e monitores da rede local. Permite registrar dispositivos, enviar conteúdo via UPnP/DIAL e descobrir TVs automaticamente na rede.

**Limite:** máximo **5 dispositivos por tenant** (regra de negócio no `tv.repository.ts`).

#### Endpoints

| Método   | URL               | Descrição                                     |
| -------- | ----------------- | --------------------------------------------- |
| `GET`    | `/tv/devices`     | Lista TVs com status e slots disponíveis      |
| `GET`    | `/tv/devices/:id` | Detalhes de uma TV (inclui `current_content`) |
| `POST`   | `/tv/devices`     | Registra nova TV                              |
| `PATCH`  | `/tv/devices/:id` | Atualiza dados da TV                          |
| `DELETE` | `/tv/devices/:id` | Remove TV (libera slot)                       |
| `POST`   | `/tv/control`     | Envia conteúdo/URL para uma TV                |
| `GET`    | `/tv/discover`    | Varredura SSDP na rede local                  |

#### Campos do dispositivo

| Campo             | Tipo              | Descrição                                         |
| ----------------- | ----------------- | ------------------------------------------------- |
| `name`            | string            | Nome amigável (ex: "Recepção - TV 1")             |
| `ip_address`      | string            | IP na rede local (IPv4 ou IPv6, único por tenant) |
| `mac_address`     | string?           | Para Wake-on-LAN (formato AA:BB:CC:DD:EE:FF)      |
| `status`          | `online\|offline` | Atualizado após cada comando enviado              |
| `current_content` | string?           | Última URL enviada para a tela                    |
| `last_seen_at`    | timestamp?        | Timestamp do último comando bem-sucedido          |

#### Enviar conteúdo (POST /tv/control)

```bash
curl -X POST http://localhost:3000/tv/control \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "uuid-da-tv",
    "contentUrl": "http://192.168.1.10/dashboard/loja-01",
    "contentType": "web",
    "dialPort": 8008
  }'
```

**Tipos de conteúdo (`contentType`):**

| Tipo    | Protocolo usado         | Ideal para                          |
| ------- | ----------------------- | ----------------------------------- |
| `video` | UPnP AVTransport (SOAP) | Vídeos MP4, streams HLS, IPTV       |
| `image` | UPnP AVTransport (SOAP) | Imagens JPG/PNG/WEBP                |
| `web`   | DIAL Protocol (HTTP)    | Páginas HTML5, dashboards, apps web |

---

## Painel de Administração

**Rota base:** `/admin`  
**Requer:** JWT com `role: "ADMIN"`

O painel admin opera no schema `public` e gerencia **todos os tenants** da plataforma.

### Como obter token Admin (em desenvolvimento)

```bash
curl -X POST http://localhost:3000/dev/token \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "00000000-0000-0000-0000-000000000000",
    "userId": "admin-mestre",
    "role": "ADMIN"
  }'
```

### Endpoints Admin

| Método  | URL                             | Descrição                                       |
| ------- | ------------------------------- | ----------------------------------------------- |
| `GET`   | `/admin/stats`                  | Dashboard: totais, tenants por módulo           |
| `GET`   | `/admin/tenants`                | Lista todos os tenants (paginado + busca)       |
| `GET`   | `/admin/tenants/:id`            | Detalhes de um tenant com módulos               |
| `POST`  | `/admin/tenants`                | Cria + provisiona novo tenant                   |
| `PATCH` | `/admin/tenants/:id/suspend`    | Suspende tenant (bloqueia acesso imediatamente) |
| `PATCH` | `/admin/tenants/:id/reactivate` | Reativa tenant suspenso                         |
| `PATCH` | `/admin/tenants/:id/modules`    | Ativa/desativa módulo em tempo real             |

---

## Como Criar um Novo Módulo (Guia Lego)

O sistema foi projetado para que novos módulos sejam encaixados como **peças de Lego** sem modificar o código existente. Siga os passos:

### Passo 1 — Adicionar a tabela SQL ao provisioner

Em `src/core/tenant/tenant.provisioner.ts`, adicione o bloco SQL da nova tabela dentro da função `buildTenantSchemaSQL()`:

```typescript
// Dentro do array retornado por buildTenantSchemaSQL():

`CREATE TABLE IF NOT EXISTS "${schemaName}".pedidos (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  numero       VARCHAR(20) NOT NULL,
  valor_total  DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  status       VARCHAR(30) NOT NULL DEFAULT 'rascunho',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`,
```

> 🔑 Use sempre `"${schemaName}".nome_tabela` para garantir o isolamento.  
> 🛡️ Use sempre `CREATE TABLE IF NOT EXISTS` para idempotência.

### Passo 2 — Registrar o módulo no seed

Em `prisma/seed.ts`, adicione a entrada no array `modules`:

```typescript
{
  name: "vendas",           // identificador interno (lowercase, sem espaços)
  displayName: "Módulo de Vendas",
  description: "Pedidos, orçamentos e pipeline de vendas.",
},
```

Execute o seed para atualizar o banco:

```bash
npm run db:seed
```

### Passo 3 — Criar a pasta e os 4 arquivos do módulo

```
src/modules/vendas/
  vendas.schema.ts      ← Schemas Zod (validação de input)
  vendas.repository.ts  ← Acesso ao banco (SQL raw + withTenantSchema)
  vendas.controller.ts  ← Handlers HTTP (recebe request, chama repository)
  vendas.routes.ts      ← Plugin Fastify com os preHandlers e rotas
```

**Estrutura mínima de `vendas.routes.ts`:**

```typescript
import { FastifyInstance } from "fastify";
import { tenantMiddleware } from "../../core/middleware/tenant.middleware";
import { requireModule } from "../../core/middleware/module.middleware";

export async function vendasRoutes(fastify: FastifyInstance) {
  const guards = [tenantMiddleware, requireModule("vendas")];

  fastify.get("/pedidos", { preHandler: guards }, listPedidos);
  fastify.post("/pedidos", { preHandler: guards }, createPedido);
}
```

**Estrutura mínima de `vendas.repository.ts`:**

```typescript
import { withTenantSchema } from "../../core/database/prisma";

export async function findAllPedidos(schemaName: string) {
  return withTenantSchema(schemaName, async (tx) => {
    return tx.$queryRawUnsafe<Pedido[]>(
      `SELECT * FROM pedidos ORDER BY created_at DESC`,
    );
  });
}
```

> ⚠️ Sempre use **parâmetros posicionais** (`$1`, `$2`) para evitar SQL injection.  
> Nunca concatene valores diretamente nas queries.

**Estrutura mínima de `vendas.controller.ts`:**

```typescript
import { FastifyRequest, FastifyReply } from "fastify";
import { CreatePedidoSchema } from "./vendas.schema";
import { findAllPedidos, createPedido } from "./vendas.repository";

export async function listPedidos(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { schemaName } = request.tenant!;
  const pedidos = await findAllPedidos(schemaName);
  return reply.send({ data: pedidos });
}
```

### Passo 4 — Registrar o módulo no server.ts

Em `src/server.ts`, adicione o import e o registro:

```typescript
// Import no topo
import { vendasRoutes } from "./modules/vendas/vendas.routes";

// Dentro de buildServer():
await app.register(vendasRoutes, { prefix: "/vendas" });
```

### Passo 5 — Ativar o módulo para tenants existentes

```bash
curl -X PATCH http://localhost:3000/admin/tenants/:id/modules \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "moduleName": "vendas", "enabled": true }'
```

### Checklist de um novo módulo

- [ ] SQL da tabela em `buildTenantSchemaSQL()`
- [ ] Módulo no `prisma/seed.ts` + seed executado
- [ ] `modulo.schema.ts` com schemas Zod + tipos TypeScript inferidos
- [ ] `modulo.repository.ts` com SQL parametrizado + `withTenantSchema`
- [ ] `modulo.controller.ts` com handlers e tratamento de erros
- [ ] `modulo.routes.ts` com `[tenantMiddleware, requireModule('modulo')]`
- [ ] Import + `app.register()` em `server.ts`
- [ ] Módulo ativado para os tenants via admin

---

## Como o TV Control Funciona

### A Jornada de um Comando

Quando você chama `POST /tv/control` com `contentType: "web"`, esta é a cadeia de eventos:

```
[Sua App]
    │ POST /tv/control
    │ { deviceId, contentUrl, contentType: "web" }
    ▼
[tv.controller.ts]
    │ 1. Valida body com Zod
    │ 2. Busca TV pelo UUID no banco (schemaName isolado)
    │ 3. Obtém ip_address: "192.168.1.50"
    ▼
[tv.service.ts → sendUrlViaDial()]
    │ HTTP POST para http://192.168.1.50:8008/apps/Browser
    │ Body: url=http%3A%2F%2Fseu-dashboard.com
    │ (Protocolo DIAL)
    ▼
[Smart TV — servidor DIAL interno]
    │ Verifica se app "Browser" está registrado
    │ Retorna HTTP 201 Created
    │ Abre o navegador nativo com a URL
    ▼
[TV exibe seu dashboard / conteúdo]

[De volta ao tv.controller.ts]
    │ 4. Atualiza banco: current_content = URL, status = "online"
    │ 5. Retorna resposta com protocolo usado e diagnóstico
```

### Os Três Protocolos

#### 1. SSDP — Descoberta de Dispositivos

```
Servidor Node.js                    Rede Local (UDP multicast)
     │                                      │
     │──── M-SEARCH ──────────────────────► │  (239.255.255.250:1900)
     │                                      │
     │◄─── HTTP/1.1 200 OK ─────────────── TV Samsung
     │     LOCATION: http://192.168.1.50:7676/description.xml
     │     SERVER: Samsung/SmartTV
     │     USN: uuid:a1b2c3...
     │
     │◄─── HTTP/1.1 200 OK ─────────────── TV LG WebOS
```

Usado pelo endpoint `GET /tv/discover`.

#### 2. UPnP AVTransport — Envio de Mídia

Para vídeos e imagens, o sistema envia SOAP (XML sobre HTTP) para a TV:

```xml
POST /upnp/control/AVTransport1 HTTP/1.1
Host: 192.168.1.50:7676
SOAPACTION: "urn:schemas-upnp-org:service:AVTransport:1#SetAVTransportURI"

<u:SetAVTransportURI ...>
  <CurrentURI>http://seu-servidor/video.mp4</CurrentURI>
</u:SetAVTransportURI>
```

Seguido do comando Play para iniciar a reprodução.

#### 3. DIAL — Abrir URL no Navegador da TV

```
POST http://192.168.1.50:8008/apps/Browser

url=https%3A%2F%2Fseu-dashboard.com
```

A TV abre o navegador nativo com a URL fornecida.

| Fabricante              | Nome do App DIAL        | Porta padrão |
| ----------------------- | ----------------------- | ------------ |
| Samsung Tizen           | `SamsungBrowser`        | 8001         |
| LG WebOS                | `com.webos.app.browser` | 3000         |
| Chromecast / Android TV | `GoogleBrowser`         | 8008         |
| Genérico DIAL           | `Browser`               | 8008         |

### Estratégia de Polling (Alternativa Confiável)

Para TVs que não suportam DIAL/UPnP, a solução mais robusta é instalar um app HTML5 na TV que faz polling na API:

```javascript
// App rodando no navegador da TV
async function checkContent() {
  const res = await fetch("/tv/devices/SEU-DEVICE-UUID", {
    headers: { Authorization: "Bearer SEU_TOKEN" },
  });
  const { current_content } = await res.json();
  if (current_content && current_content !== window.location.href) {
    window.location.href = current_content;
  }
}
setInterval(checkContent, 30000); // Verifica a cada 30 segundos
```

---

## Como Testar o Controle de TV

Esta seção é um guia passo a passo para validar o módulo de Digital Signage sem precisar ter uma Smart TV física disponível. Você pode simular 100% do fluxo em ambiente local.

### Pré-requisitos

- Servidor rodando: `npm run dev`
- Docker com PostgreSQL ativo
- Token JWT de um tenant que tem o módulo `tv` ativo (salvo na variável `$J` no PowerShell)

---

### Passo 1 — Provisionar tenant e gerar token

```powershell
# 1. Criar tenant com módulo tv ativo
$R = (curl.exe -s -X POST http://localhost:3000/dev/provisionar-tenant `
  -H "Content-Type: application/json" `
  -d '{"name":"TV Corp","slug":"tv-corp","moduleNames":["tv"]}') | ConvertFrom-Json

$TENANT_ID = $R.tenant.id
Write-Host "Tenant criado: $TENANT_ID"

# 2. Gerar JWT
$T = (curl.exe -s -X POST http://localhost:3000/dev/token `
  -H "Content-Type: application/json" `
  -d "{`"tenantId`":`"$TENANT_ID`",`"userId`":`"user-tv-001`"}") | ConvertFrom-Json

$Global:J = $T.token
Write-Host "Token salvo em `$Global:J"
```

---

### Passo 2 — Registrar uma TV pelo IP

```powershell
# IP: use o IP real da TV ou qualquer IP para testar a lógica da API
curl.exe -s -X POST http://localhost:3000/tv/devices `
  -H "Authorization: Bearer $Global:J" `
  -H "Content-Type: application/json" `
  -d '{"name":"Recepção - TV Principal","ip_address":"192.168.1.100","mac_address":"AA:BB:CC:DD:EE:FF"}'
```

**Resposta esperada:**

```json
{
  "mensagem": "Dispositivo 'Recepção - TV Principal' registrado com sucesso!",
  "device": {
    "id": "<uuid-gerado>",
    "name": "Recepção - TV Principal",
    "ip_address": "192.168.1.100",
    "status": "offline"
  }
}
```

Anote o `id` retornado — você vai precisar dele nos próximos passos.

---

### Passo 3 — Listar TVs e verificar os slots

```powershell
curl.exe -s http://localhost:3000/tv/devices `
  -H "Authorization: Bearer $Global:J" | ConvertFrom-Json | ConvertTo-Json -Depth 5
```

**O que observar na resposta:**

- `total`: quantas TVs registradas
- `limite_maximo`: sempre `5`
- `slots_disponiveis`: calculado como `5 - total`

---

### Passo 4 — Testar o limite de 5 TVs (regra de negócio)

```powershell
# Registre TVs até atingir o limite (repita alterando o IP)
$ipsParaTestar = @("192.168.1.101","192.168.1.102","192.168.1.103","192.168.1.104","192.168.1.105")

foreach ($ip in $ipsParaTestar) {
  $body = "{`"name`":`"TV $ip`",`"ip_address`":`"$ip`"}"
  $res = curl.exe -s -o NUL -w "%{http_code}" -X POST http://localhost:3000/tv/devices `
    -H "Authorization: Bearer $Global:J" `
    -H "Content-Type: application/json" `
    -d $body
  Write-Host "IP $ip → HTTP $res"
}
```

**Resultado esperado:** as primeiras 4 tentativas retornam `201`, a 6.ª retorna `422 Unprocessable Entity` com:

```json
{
  "error": "Limite Atingido",
  "detalhe": {
    "limite_maximo": 5,
    "quantidade_atual": 5,
    "dica": "Remova um dispositivo existente (DELETE /tv/devices/:id) para liberar um slot."
  }
}
```

---

### Passo 5 — Simular envio de vídeo para a TV (UPnP)

> **Cenário:** a TV está offline/sem suporte UPnP, então o sistema retorna `success: false` mas registra a tentativa no banco. Isso é o comportamento correto e esperado.

```powershell
$TV_ID = "<uuid-da-tv-registrada>"

curl.exe -s -X POST http://localhost:3000/tv/control `
  -H "Authorization: Bearer $Global:J" `
  -H "Content-Type: application/json" `
  -d "{`"deviceId`":`"$TV_ID`",`"contentUrl`":`"http://192.168.1.10/video-campanha.mp4`",`"contentType`":`"video`"}"
```

**O que acontece internamente:**

1. O sistema tenta 4 rotas UPnP AVTransport na TV
2. Como a TV está offline, todas falham com `fetch failed`
3. O banco é atualizado: `current_content = URL`, `status = offline`
4. A API responde `HTTP 200` com `success: false` + diagnóstico + alternativa de polling

---

### Passo 6 — Simular com um servidor de vídeo local real

Para testar o fluxo **completo com uma TV real na sua rede**, sirva um vídeo localmente:

```powershell
# No PowerShell, dentro de uma pasta com um arquivo video.mp4:
python -m http.server 8080
# ou, com Node.js:
npx serve -p 8080 .
```

Agora envie o vídeo para a TV pelo IP dela:

```powershell
curl.exe -s -X POST http://localhost:3000/tv/control `
  -H "Authorization: Bearer $Global:J" `
  -H "Content-Type: application/json" `
  -d "{`"deviceId`":`"$TV_ID`",`"contentUrl`":`"http://SEU_IP_LOCAL:8080/video.mp4`",`"contentType`":`"video`",`"upnpPort`":7676}"
```

> **Dica:** Para saber seu IP local, execute `ipconfig` no PowerShell e use o valor de `IPv4 Address`.

---

### Passo 7 — Verificar se o current_content foi atualizado no banco

Após qualquer chamada a `/tv/control`, verifique se o banco atualizou:

```powershell
curl.exe -s "http://localhost:3000/tv/devices/$TV_ID" `
  -H "Authorization: Bearer $Global:J" | ConvertFrom-Json | Select-Object id, name, status, current_content, last_seen_at
```

---

### Passo 8 — Usar a descoberta SSDP na rede

```powershell
# Escaneia a rede por 5 segundos procurando Smart TVs
curl.exe -s "http://localhost:3000/tv/discover?timeout=5" `
  -H "Authorization: Bearer $Global:J" | ConvertFrom-Json | ConvertTo-Json -Depth 5
```

Se houver TVs com UPnP/DIAL ativas na rede, elas aparecerão em `dispositivos[]` com `ip`, `name`, `manufacturer` e `location`.

---

### Passo 9 — Liberar slot (DELETE)

```powershell
# Remove a TV e libera o slot para um novo dispositivo
curl.exe -s -X DELETE "http://localhost:3000/tv/devices/$TV_ID" `
  -H "Authorization: Bearer $Global:J"

# Confirmar que o total diminuiu
curl.exe -s http://localhost:3000/tv/devices `
  -H "Authorization: Bearer $Global:J" | ConvertFrom-Json | Select-Object total, slots_disponiveis
```

---

### Resumo dos Testes

| #   | Teste                                    | Status esperado                      | O que valida                        |
| --- | ---------------------------------------- | ------------------------------------ | ----------------------------------- |
| 1   | `POST /tv/devices` (1ª TV)               | `201 Created`                        | Registro normal                     |
| 2   | `POST /tv/devices` (6ª TV)               | `422`                                | Limite de 5 por tenant              |
| 3   | `POST /tv/devices` (IP duplicado)        | `409`                                | Unicidade de IP                     |
| 4   | `POST /tv/control` (TV offline, `video`) | `200` + `success:false`              | UPnP falha graciosamente            |
| 5   | `POST /tv/control` (TV offline, `web`)   | `200` + `success:false`              | DIAL falha graciosamente            |
| 6   | `GET /tv/devices/:id` após control       | `200` + `current_content` preenchido | Banco atualizado após tentativa     |
| 7   | `DELETE /tv/devices/:id`                 | `200` + "Slot liberado"              | Hard delete + contador decrementado |
| 8   | `GET /tv/discover`                       | `200` + lista SSDP                   | Integração node-ssdp                |

---

## Referência de API

### Autenticação

Todas as rotas (exceto `/health` e `/dev/*`) requerem:

```
Authorization: Bearer <jwt_token>
```

### Códigos de Status HTTP

| Código | Significado           | Quando ocorre                                                      |
| ------ | --------------------- | ------------------------------------------------------------------ |
| `200`  | OK                    | Operação bem-sucedida                                              |
| `201`  | Created               | Recurso criado                                                     |
| `400`  | Bad Request           | JSON malformado                                                    |
| `401`  | Unauthorized          | Token ausente, inválido ou expirado                                |
| `403`  | Forbidden             | Token válido, mas sem permissão (tenant suspenso ou role inválido) |
| `404`  | Not Found             | Recurso não encontrado                                             |
| `409`  | Conflict              | Conflito de dados únicos (slug, IP, etc.)                          |
| `422`  | Unprocessable Entity  | Regra de negócio violada (ex: limite de 5 TVs)                     |
| `500`  | Internal Server Error | Erro inesperado no servidor                                        |

### Formato padrão de erro

```json
{
  "statusCode": 404,
  "error": "Não Encontrado",
  "message": "Dispositivo com ID 'uuid' não encontrado neste tenant."
}
```

---

## Segurança

### Práticas Implementadas

| Prática                    | Implementação                                             |
| -------------------------- | --------------------------------------------------------- |
| **Injection Prevention**   | Parâmetros posicionais PostgreSQL em todas as queries raw |
| **Schema Name Validation** | `validateSchemaName()` usa regex whitelist `^[a-z0-9_]+$` |
| **JWT Verification**       | `request.jwtVerify()` em todo middleware de tenant/admin  |
| **Role-Based Access**      | Admin Panel protegido por `role: "ADMIN"` no JWT          |
| **Tenant Isolation**       | `SET LOCAL search_path` dentro de `$transaction`          |
| **Fail-Fast Startup**      | Servidor não inicia se `JWT_SECRET` < 32 caracteres       |
| **Input Validation**       | Zod valida 100% dos inputs nas bordas da aplicação        |
| **Business Rule Guards**   | Verificações antes de qualquer escrita no banco           |

### Antes de Ir para Produção

- [ ] Remova ou proteja as rotas `/dev/*`
- [ ] Troque `JWT_SECRET` por um valor gerado com `openssl rand -hex 32`
- [ ] Configure HTTPS (TLS) via nginx, Caddy ou similar
- [ ] Altere a senha padrão do admin
- [ ] Configure rate limiting nas rotas públicas
- [ ] Configure CORS adequadamente

---

## Dicionário Técnico

**Multi-Tenancy:** Arquitetura onde um único sistema serve múltiplos clientes com isolamento de dados. Este projeto usa Schema-per-Tenant — o melhor equilíbrio entre isolamento forte e eficiência operacional.

**Schema (PostgreSQL):** Namespace dentro de um banco PostgreSQL. Funciona como uma "pasta": `public.tenants` e `tenant_acme.products` existem no mesmo banco mas são completamente separados.

**Middleware (Fastify):** Função que executa antes do handler principal da rota. Registrada como `preHandler`. Usada para autenticação, autorização e carregamento de contexto.

**JWT (JSON Web Token):** Token de autenticação compacto no formato `header.payload.signature`. O payload carrega `tenantId`, `userId` e `role`. A assinatura garante integridade sem necessidade de armazenar o token no servidor.

**UPnP (Universal Plug and Play):** Conjunto de protocolos que permite dispositivos se descobrirem e se comunicarem na rede. Usado neste projeto via **AVTransport** para enviar URLs de mídia para Smart TVs.

**SSDP (Simple Service Discovery Protocol):** Protocolo de descoberta UPnP via UDP multicast para `239.255.255.250:1900`. Um cliente SSDP envia M-SEARCH e "escuta" as respostas dos dispositivos na rede.

**DIAL (Discovery and Launch):** Protocolo da Google/YouTube para lançar aplicações em TVs a partir de dispositivos de segunda tela. Usado aqui para abrir URLs no navegador nativo de Smart TVs.

**SOAP (Simple Object Access Protocol):** Protocolo de RPC baseado em XML sobre HTTP. O UPnP AVTransport usa SOAP para enviar comandos de controle de mídia às TVs.

**ORM (Object-Relational Mapping):** Ferramenta que mapeia tabelas do banco para objetos na linguagem. Prisma é usado apenas para o schema `public`; tabelas de tenant usam SQL raw pois são criadas dinamicamente.

**Schema-per-Tenant:** Padrão onde cada cliente tem um schema PostgreSQL próprio. Oferece isolamento forte, possibilidade de backup individual por tenant e impossibilidade de acesso cruzado acidental.

**withTenantSchema():** Função central deste projeto. Executa uma callback dentro de uma `$transaction` com `SET LOCAL search_path TO "tenant_x", public` já configurado, garantindo que toda query vai automaticamente para o schema correto.

**Soft Delete:** Deleção "suave" — o registro não é removido, apenas marcado como inativo (`is_active = false`). Permite recuperação e auditoria. Oposto de **Hard Delete** (remoção física com `DELETE FROM`).

**Provisionamento:** Processo de criação de um novo tenant: criar o schema PostgreSQL, criar as tabelas dos módulos, registrar o tenant na tabela pública e ativar os módulos solicitados.

**Plugin Fastify:** Unidade de encapsulamento do Fastify. Cada módulo é um plugin com seu próprio contexto, hooks e rotas, registrado com `app.register(plugin, { prefix: "/rota" })`.

---

## Scripts NPM

| Script                      | Descrição                                  |
| --------------------------- | ------------------------------------------ |
| `npm run dev`               | Servidor com hot-reload (tsx watch)        |
| `npm run build`             | Compila TypeScript para JavaScript         |
| `npm run start`             | Inicia o build compilado (produção)        |
| `npm run db:migrate:dev`    | Aplica migrations + regenera Prisma Client |
| `npm run db:migrate:deploy` | Aplica migrations em produção              |
| `npm run db:seed`           | Popula banco com dados iniciais            |
| `npm run db:studio`         | Abre Prisma Studio (GUI para o banco)      |
| `npm run db:generate`       | Regenera Prisma Client                     |

---

## Licença

MIT — veja o arquivo [LICENSE](./LICENSE) para detalhes.

---

<div align="center">
  <sub>Construído com ❤️ como material pedagógico de arquitetura SaaS Multitenant com Node.js</sub>
</div>
