// =============================================================================
// src/core/tenant/tenant.provisioner.ts
// =============================================================================
// O QUE FAZ:
//   É o "construtor de apartamentos" do sistema. Quando um novo cliente
//   (tenant) é cadastrado, este serviço:
//   1. Cria um schema isolado no PostgreSQL (ex: "tenant_acme_corp")
//   2. Cria TODAS as tabelas dos módulos disponíveis dentro desse schema
//   3. Registra o tenant e seus módulos ativos na tabela public.tenants
//
// POR QUE EXISTE ESTE ARQUIVO?
//   O Prisma ORM gerencia migrations apenas para o schema 'public'.
//   As tabelas dentro dos schemas de tenant (products, transactions, etc.)
//   precisam ser criadas via SQL puro, pois são criadas DINAMICAMENTE
//   quando cada cliente é provisionado.
//
// ANALOGIA PEDAGÓGICA:
//   O Prisma é o síndico do prédio (gerencia áreas comuns = schema public).
//   O TenantProvisioner é o mestre de obras que constrói o apartamento
//   (schema + tabelas) para cada novo morador (tenant).
//
// PRINCÍPIO SOLID (Open/Closed):
//   Para adicionar tabelas de novos módulos, basta adicionar o SQL em
//   TENANT_SCHEMA_SQL. Não é necessário alterar a lógica de provisionamento.
// =============================================================================

import { prisma } from "../database/prisma";

// =============================================================================
// CONSTANTE: TENANT_SCHEMA_SQL
// =============================================================================
// O QUE FAZ:
//   Define todo o SQL para criar as tabelas de TODOS os módulos disponíveis
//   dentro de um schema de tenant.
//
// POR QUE UMA FUNÇÃO E NÃO UMA STRING ESTÁTICA?
//   O nome do schema precisa ser interpolado dinamicamente.
//   PORÉM: para evitar SQL injection, esta função só é chamada APÓS
//   validateSchemaName() (no prisma.ts) ter validado o nome do schema.
//   O `schemaName` que chega aqui já foi sanitizado.
//
// POR QUE CREATE TABLE IF NOT EXISTS?
//   Torna o provisionamento IDEMPOTENTE: pode ser executado várias vezes
//   sem erros. Útil para reprocessar um tenant com falha no provisionamento.
// =============================================================================
function buildTenantSchemaSQL(schemaName: string): string[] {
  return [
    // -----------------------------------------------------------------
    // PASSO 1: Criar o Schema Isolado
    // -----------------------------------------------------------------
    // CREATE SCHEMA IF NOT EXISTS cria o "container" (schema/namespace)
    // no PostgreSQL. É o equivalente a criar uma pasta separada onde
    // todas as tabelas deste tenant estarão guardadas de forma isolada.
    `CREATE SCHEMA IF NOT EXISTS "${schemaName}"`,

    // -----------------------------------------------------------------
    // TABELA: products (Módulo de Estoque)
    // -----------------------------------------------------------------
    // Esta tabela SÓ EXISTE dentro do schema do tenant.
    // "tenant_acme.products" é COMPLETAMENTE separado de "tenant_foobar.products"
    // O PostgreSQL garante este isolamento em nível de kernel.
    `CREATE TABLE IF NOT EXISTS "${schemaName}".products (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      name        VARCHAR(255) NOT NULL,
      description TEXT,
      price       DECIMAL(10,2) NOT NULL DEFAULT 0.00
                  CONSTRAINT products_price_positive CHECK (price >= 0),
      quantity    INTEGER     NOT NULL DEFAULT 0
                  CONSTRAINT products_quantity_non_negative CHECK (quantity >= 0),
      sku         VARCHAR(100) UNIQUE,
      is_active   BOOLEAN     NOT NULL DEFAULT true,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // Índice para acelerar buscas por nome de produto (ex: busca no catálogo)
    `CREATE INDEX IF NOT EXISTS idx_products_name
      ON "${schemaName}".products (name)`,

    // Índice para filtrar apenas produtos ativos (o caso mais comum de query)
    `CREATE INDEX IF NOT EXISTS idx_products_active
      ON "${schemaName}".products (is_active)
      WHERE is_active = true`,

    // -----------------------------------------------------------------
    // TABELA: transactions (Módulo Financeiro)
    // -----------------------------------------------------------------
    `CREATE TABLE IF NOT EXISTS "${schemaName}".transactions (
      id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      type             VARCHAR(20) NOT NULL
                       CONSTRAINT transactions_type_check
                       CHECK (type IN ('receita', 'despesa')),
      -- 'receita' = entrada de dinheiro, 'despesa' = saída de dinheiro
      amount           DECIMAL(10,2) NOT NULL
                       CONSTRAINT transactions_amount_positive CHECK (amount > 0),
      description      TEXT        NOT NULL,
      category         VARCHAR(100),
      transaction_date DATE        NOT NULL DEFAULT CURRENT_DATE,
      is_reconciled    BOOLEAN     NOT NULL DEFAULT false,
      -- is_reconciled: indica se a transação foi conferida no extrato bancário
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // Índice para filtrar transações por tipo (receita vs despesa)
    `CREATE INDEX IF NOT EXISTS idx_transactions_type
      ON "${schemaName}".transactions (type)`,

    // Índice para busca por período (relatórios mensais/anuais)
    `CREATE INDEX IF NOT EXISTS idx_transactions_date
      ON "${schemaName}".transactions (transaction_date DESC)`,

    // -----------------------------------------------------------------
    // TABELA: tv_devices (Módulo de Controle de Telas / Digital Signage)
    // -----------------------------------------------------------------
    // Armazena os dispositivos (Smart TVs, monitores) registrados pelo
    // tenant. Cada tenant tem seu próprio inventário de telas, isolado
    // dentro do seu schema.
    //
    // REGRA DE NEGÓCIO IMPORTANTE:
    //   Máximo de 5 dispositivos por tenant. Esta regra NÃO é enforçada
    //   por constraint no banco (para dar mensagem de erro amigável).
    //   É enforçada no tv.repository.ts antes do INSERT.
    //
    // CAMPOS:
    //   ip_address    → IPv4 ou IPv6 da TV na rede local (deve ser único
    //                   por tenant, pois dois dispositivos não podem ter
    //                   o mesmo IP na mesma rede)
    //   mac_address   → Endereço físico da placa de rede (para Wake-on-LAN)
    //   status        → 'online' (respondendo a pings) | 'offline' (sem resposta)
    //   current_content → última URL que foi enviada para a tela
    //   last_seen_at  → timestamp da última resposta bem-sucedida ao enviar
    //                   um comando (atualizado automaticamente em POST /tv/control)
    // -----------------------------------------------------------------
    `CREATE TABLE IF NOT EXISTS "${schemaName}".tv_devices (
      id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      name            VARCHAR(100) NOT NULL,
      ip_address      VARCHAR(45)  NOT NULL,
      mac_address     VARCHAR(17),
      status          VARCHAR(20)  NOT NULL DEFAULT 'offline'
                      CONSTRAINT tv_devices_status_check
                      CHECK (status IN ('online', 'offline')),
      current_content TEXT,
      last_seen_at    TIMESTAMPTZ,
      --
      -- NOVOS CAMPOS — Integração Multi-Protocolo
      --
      -- chromecast_id: ID do dispositivo Chromecast na rede local.
      --   Ex: "Chromecast-Ultra-a8f2..." (vem da API Cast SDK).
      --   Necessário para envio via protocolo Chromecast sem precisar
      --   do IP: o Cast SDK faz o roteamento pelo receiver app ID.
      chromecast_id   VARCHAR(200),
      --
      -- socket_token: token UUID que autentica o app receptor (receiver.html)
      --   ao conectar ao WebSocket deste backend.
      --   POR QUE UM TOKEN SEPARADO E NÃO O JWT DO TENANT?
      --   O app receptor roda dentro do browser da TV, um ambiente sem
      --   usuário logado. Um token de sessão dedicado — rotacionável,
      --   revogável por device — é mais seguro e mais simples de gerenciar.
      socket_token    UUID         DEFAULT gen_random_uuid(),
      --
      created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      -- IP único por tenant: dois devices não podem ter o mesmo IP no schema
      CONSTRAINT tv_devices_ip_unique UNIQUE (ip_address)
    )`,

    // Índice para buscar rapidamente dispositivos online (uso frequente no dashboard)
    `CREATE INDEX IF NOT EXISTS idx_tv_devices_status
      ON "${schemaName}".tv_devices (status)`,

    // -----------------------------------------------------------------
    // TABELA: tv_command_logs (Histórico de Comandos — Módulo TV)
    // -----------------------------------------------------------------
    // Registra cada vez que o tenant envia um comando para uma TV.
    // Mesmo quando a TV não responde (success=false), o log é gravado
    // para diagnóstico posterior.
    //
    // POR QUE NÃO TEM FOREIGN KEY PARA tv_devices?
    //   Se uma TV for removida (DELETE), ainda queremos manter o histórico
    //   de comandos enviados a ela para fins de auditoria. Com FK + ON DELETE
    //   CASCADE perderíamos esses registros. Armazenamos device_name de forma
    //   desnormalizada para não precisar fazer JOIN após a remoção.
    //
    // CAMPOS:
    //   device_id     → UUID do dispositivo (sem FK — desacoplado do ciclo de vida da TV)
    //   device_name   → nome da TV no momento do envio (para exibição histórica)
    //   content_url   → URL enviada para a tela
    //   content_type  → 'video' | 'image' | 'web'
    //   protocol_used → 'upnp' | 'dial' | 'none' (qual protocolo foi usado)
    //   success       → true se a TV respondeu ao comando, false se não respondeu
    //   error_message → detalhe do erro quando success=false (para diagnóstico)
    //   sent_at       → timestamp exato do envio
    // -----------------------------------------------------------------
    `CREATE TABLE IF NOT EXISTS "${schemaName}".tv_command_logs (
      id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      device_id     UUID         NOT NULL,
      device_name   VARCHAR(100) NOT NULL,
      content_url   TEXT         NOT NULL,
      content_type  VARCHAR(20)  NOT NULL
                    CONSTRAINT tv_command_logs_type_check
                    CHECK (content_type IN ('video', 'image', 'web', 'timer', 'screen-share')),
      -- protocol_used expandido para cobrir todos os protocolos do waterfall:
      --   'websocket'   → enviado via Socket.IO ao receiver.html na TV
      --   'chromecast'  → enviado via Cast REST API
      --   'upnp'        → enviado via SOAP AVTransport
      --   'dial'        → enviado via DIAL HTTP POST
      --   'none'        → todos os protocolos falharam
      protocol_used VARCHAR(20)
                    CONSTRAINT tv_command_logs_protocol_check
                    CHECK (protocol_used IN ('websocket','chromecast','upnp','dial','none') OR protocol_used IS NULL),
      success       BOOLEAN      NOT NULL,
      error_message TEXT,
      sent_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )`,

    // Índice para buscar histórico de um device específico (ordenado do mais recente)
    `CREATE INDEX IF NOT EXISTS idx_tv_command_logs_device
      ON "${schemaName}".tv_command_logs (device_id, sent_at DESC)`,

    // -----------------------------------------------------------------
    // TABELA: media_files (Módulo de Mídia — Streaming & Digital Signage)
    // -----------------------------------------------------------------
    // Armazena os metadados de arquivos (vídeos e imagens) enviados via
    // upload pelo tenant. O arquivo físico fica no disco em /uploads/{slug}/.
    //
    // POR QUE GUARDAR SÓ METADADOS E NÃO O ARQUIVO NO BANCO?
    //   Armazenar BLOBs no banco infla seu tamanho, degrada performance de
    //   backups e impede uso de CDN. O padrão da indústria é salvar o arquivo
    //   em disco (ou S3/MinIO) e registrar apenas a URL no banco.
    //
    // CAMPOS:
    //   filename      → nome único no disco (UUID + extensão) — evita colisões
    //   original_name → nome original do arquivo (para exibição ao usuário)
    //   url           → URL pública para acesso: /uploads/{tenantSlug}/{filename}
    //   mime_type     → tipo MIME validado no upload (ex: video/mp4, image/jpeg)
    //   size_bytes    → tamanho em bytes (para exibir ao usuário e limitar storage)
    //   uploaded_by   → UUID do usuário que fez o upload (auditoria)
    // -----------------------------------------------------------------
    `CREATE TABLE IF NOT EXISTS "${schemaName}".media_files (
      id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      filename      VARCHAR(255) NOT NULL,
      original_name VARCHAR(255) NOT NULL,
      url           TEXT         NOT NULL,
      mime_type     VARCHAR(100) NOT NULL,
      size_bytes    BIGINT       NOT NULL DEFAULT 0,
      uploaded_by   UUID,
      created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )`,

    // Índice para listar mídias por data de upload (mais recentes primeiro)
    `CREATE INDEX IF NOT EXISTS idx_media_files_created
      ON "${schemaName}".media_files (created_at DESC)`,

    // -----------------------------------------------------------------
    // TABELA: users (Módulo de Autenticação)
    // -----------------------------------------------------------------
    // Armazena os usuários que fazem login no sistema para este tenant.
    // Cada tenant tem sua própria tabela de usuários, completamente
    // isolada dos outros tenants (schema-per-tenant).
    //
    // CAMPOS:
    //   email         → identificador de login (único por tenant)
    //   password_hash → NUNCA guardar senha em texto puro. Aqui fica
    //                   o hash bcrypt (custo 12) da senha do usuário.
    //   name          → nome exibido na interface
    //   role          → papel do usuário dentro do tenant:
    //                   'admin_tenant' = administrador do tenant
    //                   'user'         = usuário comum
    //   is_active     → permite desativar um usuário sem deletar seus dados
    // -----------------------------------------------------------------
    `CREATE TABLE IF NOT EXISTS "${schemaName}".users (
      id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      email         VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name          VARCHAR(100),
      role          VARCHAR(50)  NOT NULL DEFAULT 'user',
      is_active     BOOLEAN      NOT NULL DEFAULT true,
      created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      CONSTRAINT users_email_unique UNIQUE (email)
    )`,

    // Índice para login rápido por email (operação mais frequente)
    `CREATE INDEX IF NOT EXISTS idx_users_email
      ON "${schemaName}".users (email)`,

    // Índice para filtrar apenas usuários ativos
    `CREATE INDEX IF NOT EXISTS idx_users_active
      ON "${schemaName}".users (is_active)
      WHERE is_active = true`,

    // -----------------------------------------------------------------
    // TABELA: refresh_tokens (Módulo de Autenticação — Abordagem Híbrida)
    // -----------------------------------------------------------------
    // Armazena os refresh tokens da abordagem híbrida de autenticação.
    //
    // POR QUE GUARDAR O HASH E NÃO O TOKEN ORIGINAL?
    //   O refresh_token em si é uma string longa e aleatória enviada ao
    //   cliente. Se o banco for comprometido, o atacante NÃO consegue
    //   usar os tokens (apenas os hashes). Mesmo princípio do bcrypt
    //   para senhas, porém aqui usamos SHA-256 (mais rápido, token já
    //   é aleatório e longo o suficiente — não precisa de salt).
    //
    // ROTAÇÃO DE TOKENS (segurança extra):
    //   A cada /auth/refresh, o token antigo é revogado e um novo par
    //   é emitido. Se um token antigo for usado novamente, identificamos
    //   possível roubo e podemos revogar TODA a família de tokens.
    //
    // CAMPOS:
    //   token_hash    → SHA-256 do refresh token (não o token em si)
    //   expires_at    → timestamp de expiração (geralmente 30 dias)
    //   is_revoked    → true se o token foi usado (rotação) ou invalidado (logout)
    //   ip_address    → IP da requisição de login (auditoria)
    //   user_agent    → browser/app usado no login (auditoria)
    // -----------------------------------------------------------------
    `CREATE TABLE IF NOT EXISTS "${schemaName}".refresh_tokens (
      id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID         NOT NULL,
      token_hash  VARCHAR(64)  NOT NULL,
      expires_at  TIMESTAMPTZ  NOT NULL,
      is_revoked  BOOLEAN      NOT NULL DEFAULT false,
      ip_address  VARCHAR(45),
      user_agent  TEXT,
      created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      CONSTRAINT refresh_tokens_token_hash_unique UNIQUE (token_hash),
      CONSTRAINT refresh_tokens_user_fk
        FOREIGN KEY (user_id) REFERENCES "${schemaName}".users(id)
        ON DELETE CASCADE
    )`,

    // Índice para busca rápida por hash (operação em todo /auth/refresh)
    `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash
      ON "${schemaName}".refresh_tokens (token_hash)`,

    // Índice para limpeza periódica de tokens expirados / listagem por usuário
    `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user
      ON "${schemaName}".refresh_tokens (user_id)`,

    // -----------------------------------------------------------------
    // TABELA: venda_produtos (Módulo SalesWpp — Catálogo de Vendas)
    // -----------------------------------------------------------------
    // Armazena os produtos exibidos na página de vendas pública do tenant.
    // Cada tenant tem seu próprio catálogo, isolado no seu schema.
    //
    // CAMPOS:
    //   nome             → nome do produto exibido no catálogo
    //   descricao        → texto descritivo do produto
    //   preco            → preço original
    //   preco_promocional→ preço com desconto (opcional — exibido em "Promoções")
    //   categoria        → fileira onde o produto aparece (ex: lancamentos, mais-vendidos)
    //   foto_url         → URL pública da imagem do produto
    //   ativo            → controla se aparece no catálogo público (false = oculto)
    //   destaque         → exibe em destaque dentro da categoria (topo da fileira)
    //   ordem            → posição na fileira (menor valor = mais à esquerda)
    // -----------------------------------------------------------------
    `CREATE TABLE IF NOT EXISTS "${schemaName}".venda_produtos (
      id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      nome              VARCHAR(255)  NOT NULL,
      descricao         TEXT,
      preco             DECIMAL(10,2) NOT NULL DEFAULT 0.00
                        CONSTRAINT venda_produtos_preco_positivo CHECK (preco >= 0),
      preco_promocional DECIMAL(10,2)
                        CONSTRAINT venda_produtos_preco_promo_positivo CHECK (preco_promocional >= 0),
      categoria         VARCHAR(50)   NOT NULL DEFAULT 'lancamentos',
      foto_url          TEXT,
      ativo             BOOLEAN       NOT NULL DEFAULT true,
      destaque          BOOLEAN       NOT NULL DEFAULT false,
      ordem             INTEGER       NOT NULL DEFAULT 0,
      created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    )`,

    // Índice para listagem do catálogo público (produtos ativos por categoria)
    `CREATE INDEX IF NOT EXISTS idx_venda_produtos_catalogo
      ON "${schemaName}".venda_produtos (categoria, ativo, ordem ASC)`,

    // Índice para destaques (lançamentos em destaque aparecem primeiro)
    `CREATE INDEX IF NOT EXISTS idx_venda_produtos_destaque
      ON "${schemaName}".venda_produtos (destaque)
      WHERE destaque = true`,

    // -----------------------------------------------------------------
    // TABELA: venda_pedidos (Módulo SalesWpp — Pedidos via WhatsApp)
    // -----------------------------------------------------------------
    // Registra cada pedido iniciado pelo visitante ao clicar em
    // "Finalizar no WhatsApp". Permite ao admin acompanhar, marcar como
    // pago, enviado ou finalizado — e adicionar notas de entrega.
    //
    // POR QUE itens_json É JSONB E NÃO UMA TABELA SEPARADA?
    //   O carrinho é capturado no momento da compra (snapshot imutável).
    //   Se o produto for editado/deletado depois, o histórico do pedido
    //   deve preservar os preços e nomes originais do momento da venda.
    //   JSONB garante esse snapshot sem precisar de outra tabela.
    //
    // CAMPOS:
    //   numero_whatsapp → telefone do comprador (pode ser null se não capturado)
    //   itens_json      → snapshot do carrinho: [{produto_id, nome, preco, quantidade}]
    //   total           → valor total do pedido no momento da compra
    //   status          → ciclo de vida: pendente → pago → enviado → finalizado
    //   notas           → observações do admin (ex: "Entregue em 12/04", "Pix recebido")
    // -----------------------------------------------------------------
    `CREATE TABLE IF NOT EXISTS "${schemaName}".venda_pedidos (
      id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      numero_whatsapp VARCHAR(20),
      itens_json      JSONB         NOT NULL DEFAULT '[]'::jsonb,
      total           DECIMAL(10,2) NOT NULL DEFAULT 0.00
                      CONSTRAINT venda_pedidos_total_positivo CHECK (total >= 0),
      status          VARCHAR(20)   NOT NULL DEFAULT 'pendente'
                      CONSTRAINT venda_pedidos_status_check
                      CHECK (status IN ('pendente', 'pago', 'enviado', 'finalizado', 'cancelado')),
      notas           TEXT,
      created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    )`,

    // Índice para listar pedidos por status no painel admin
    `CREATE INDEX IF NOT EXISTS idx_venda_pedidos_status
      ON "${schemaName}".venda_pedidos (status, created_at DESC)`,

    // Índice para busca por número do WhatsApp (localizar pedidos de um cliente)
    `CREATE INDEX IF NOT EXISTS idx_venda_pedidos_whatsapp
      ON "${schemaName}".venda_pedidos (numero_whatsapp)
      WHERE numero_whatsapp IS NOT NULL`,

    // -----------------------------------------------------------------
    // TABELA: venda_config
    // -----------------------------------------------------------------
    // Configurações do módulo de vendas por tenant.
    // Sempre terá exatamente UMA linha (id = 1), garantido por CHECK constraint.
    // -----------------------------------------------------------------
    `CREATE TABLE IF NOT EXISTS "${schemaName}".venda_config (
      id              INTEGER     PRIMARY KEY DEFAULT 1,
      whatsapp_number VARCHAR(20),
      nome_loja       VARCHAR(255),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT venda_config_single_row CHECK (id = 1)
    )`,

    // Garante que a linha de configuração sempre exista
    `INSERT INTO "${schemaName}".venda_config (id)
      VALUES (1)
      ON CONFLICT DO NOTHING`,
  ];
}

// =============================================================================
// TIPO: ProvisionTenantInput
// =============================================================================
// Define os dados necessários para provisionar um novo tenant.
// Usar um tipo explícito documenta o contrato e previne erros de TypeScript.
// =============================================================================
export interface ProvisionTenantInput {
  name: string;
  slug: string;
  schemaName: string;
  moduleNames?: string[]; // Quais módulos ativar na criação. Default: todos.
}

// =============================================================================
// TIPO: ProvisionedTenant
// =============================================================================
export interface ProvisionedTenant {
  id: string;
  name: string;
  slug: string;
  schemaName: string;
}

// =============================================================================
// FUNÇÃO PRINCIPAL: provisionNewTenant
// =============================================================================
// O QUE FAZ:
//   Executa o processo completo de criação de um novo cliente:
//   1. Valida que o slug não está em uso
//   2. Cria o schema e as tabelas no PostgreSQL
//   3. Registra o tenant na tabela public.tenants
//   4. Ativa os módulos solicitados
//
// POR QUE TUDO DENTRO DE UMA $transaction?
//   ATOMICIDADE: se qualquer passo falhar (ex: slug duplicado), TUDO
//   é desfeito automaticamente pelo PostgreSQL (ROLLBACK).
//   Sem isso, poderíamos ter o schema criado no banco mas sem registro
//   em public.tenants — um estado inconsistente difícil de corrigir.
//
// NOTA SOBRE SCHEMAS E TRANSAÇÕES:
//   CREATE SCHEMA é um comando DDL (Data Definition Language).
//   No PostgreSQL, DDL é TRANSACIONAL — diferente do MySQL!
//   Se a transação der ROLLBACK, o schema criado também é removido. ✅
// =============================================================================
export async function provisionNewTenant(
  input: ProvisionTenantInput,
): Promise<ProvisionedTenant> {
  const { name, slug, schemaName, moduleNames } = input;

  // PASSO 1: Gera o SQL completo para o schema do tenant
  const schemaSQLStatements = buildTenantSchemaSQL(schemaName);

  // PASSO 2: Executa tudo em uma única transação atômica
  const tenant = await prisma.$transaction(async (tx) => {
    // -----------------------------------------------------------------------
    // CRIAÇÃO DAS ESTRUTURAS DO BANCO (DDL)
    // -----------------------------------------------------------------------
    // Executa cada statement SQL sequencialmente dentro da transação.
    // Usamos $executeRawUnsafe porque precisamos passar o nome do schema
    // diretamente (não pode ser parametrizado no DDL do PostgreSQL).
    // A segurança é garantida pela validação prévia do schemaName.
    for (const sql of schemaSQLStatements) {
      await tx.$executeRawUnsafe(sql);
    }

    // -----------------------------------------------------------------------
    // REGISTRO DO TENANT NA TABELA PUBLIC
    // -----------------------------------------------------------------------
    // Cria o registro do tenant no schema public (visível globalmente).
    // Este registro é o que o tenantMiddleware vai buscar em cada requisição.
    const newTenant = await tx.tenant.create({
      data: { name, slug, schemaName },
    });

    // -----------------------------------------------------------------------
    // ATIVAÇÃO DOS MÓDULOS SOLICITADOS
    // -----------------------------------------------------------------------
    // Determina quais módulos ativar: os passados no input, ou todos disponíveis.
    let moduleFilter = {};
    if (moduleNames && moduleNames.length > 0) {
      moduleFilter = { name: { in: moduleNames } };
    }

    const modules = await tx.module.findMany({
      where: moduleFilter,
      select: { id: true, name: true },
    });

    if (modules.length === 0 && moduleNames && moduleNames.length > 0) {
      throw new Error(
        `Nenhum dos módulos solicitados foi encontrado: ${moduleNames.join(", ")}`,
      );
    }

    // Cria os registros de ativação na tabela tenant_modules
    await tx.tenantModule.createMany({
      data: modules.map((m) => ({
        tenantId: newTenant.id,
        moduleId: m.id,
        isEnabled: true,
      })),
      skipDuplicates: true,
    });

    console.log(
      `[Provisioner] ✅ Tenant "${name}" provisionado com sucesso.\n` +
        `  Schema: ${schemaName}\n` +
        `  Módulos ativos: ${modules.map((m) => m.name).join(", ")}`,
    );

    return newTenant;
  });

  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    schemaName: tenant.schemaName,
  };
}
