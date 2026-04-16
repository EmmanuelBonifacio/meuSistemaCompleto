// =============================================================================
// src/core/types/fastify.d.ts
// =============================================================================
// O QUE FAZ:
//   Estende ("augmenta") as tipagens do Fastify e do @fastify/jwt para que o
//   TypeScript entenda que nosso objeto `request` tem campos extras:
//   - `request.tenant`: os dados do cliente identificado pelo JWT
//
// POR QUE PRECISAMOS DISSO?
//   Por padrão, o TypeScript não sabe que adicionamos `request.tenant` no
//   middleware. Sem essa declaração, o compilador lançaria um erro:
//   "Property 'tenant' does not exist on type 'FastifyRequest'"
//
// COMO FUNCIONA (Declaration Merging):
//   TypeScript permite "mesclar" declarações de módulos externos. Ao declarar
//   `declare module 'fastify' { interface FastifyRequest { ... } }`, estamos
//   dizendo: "Adicione estas propriedades à interface existente do Fastify".
//   Isso é type-safe e não modifica nenhum arquivo de biblioteca.
//
// COMO ISSO AJUDA NO REAPROVEITAMENTO?
//   Uma vez declarado aqui, qualquer arquivo do projeto que receber um
//   `FastifyRequest` terá auto-complete para `request.tenant` no editor,
//   tornando o desenvolvimento mais rápido e seguro.
// =============================================================================

// Importação necessária para que o TypeScript trate este arquivo como um
// "módulo" e não um script global. Sem isto, a augmentação não funciona.
import "fastify";
import "@fastify/jwt";
import type { XiboTenantContext } from "../../routes/xibo/xiboTenantResolver.service";

// =============================================================================
// TIPO: TenantContext
// =============================================================================
// Representa os dados do tenant que são disponibilizados em cada requisição
// APÓS o middleware de tenant ter rodado e validado o JWT.
//
// Este tipo é o contrato: "quando uma rota protegida roda, você PODE confiar
// que esses dados estão disponíveis no request.tenant."
// =============================================================================
export interface TenantContext {
  /** UUID do tenant na tabela public.tenants */
  id: string;

  /** Nome legível da empresa. Ex: "Acme Corporation" */
  name: string;

  /** Slug único. Ex: "acme-corp" */
  slug: string;

  /**
   * Nome EXATO do schema PostgreSQL deste tenant. Ex: "tenant_acme_corp"
   * Este é o valor que será passado para a função withTenantSchema()
   * para trocar o search_path e isolar as queries deste cliente.
   */
  schemaName: string;
}

// =============================================================================
// AUGMENTAÇÃO DO FASTIFY REQUEST
// =============================================================================
// Adiciona nossa propriedade `tenant` ao objeto request do Fastify.
// =============================================================================
declare module "fastify" {
  interface FastifyRequest {
    /**
     * Dados do tenant identificado pelo JWT.
     * Esta propriedade só existe em rotas protegidas pelo tenantMiddleware.
     *
     * NOTA: Marcada como opcional (?) aqui porque o TypeScript não sabe
     * em que ordem os middlewares rodaram. Nas rotas protegidas, você pode
     * usar o operador "!" (non-null assertion) ou verificar antes de usar.
     */
    tenant?: TenantContext;

    /** Preenchido pelas rotas /api/v1/xibo/* após validar ?token= */
    xiboTenant?: XiboTenantContext;
  }
}

// =============================================================================
// AUGMENTAÇÃO DO @fastify/jwt
// =============================================================================
// Define o formato dos dados armazenados DENTRO do token JWT.
// Isso garante que request.user.tenantId exista e seja string.
//
// ANATOMIA DO JWT:
//   Header.Payload.Signature
//   O Payload contém os dados abaixo. Ele é codificado em Base64, NÃO
//   criptografado — nunca coloque dados sensíveis (senhas, cartões) no JWT!
// =============================================================================
declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      /** ID do usuário DENTRO do schema do tenant (chave primária na tabela users do tenant) */
      sub: string;

      /** ID do tenant na tabela public.tenants. Usado pelo tenantMiddleware para buscar o schema. */
      tenantId: string;

      /** Papel do usuário: "admin_tenant" | "user" | etc. Reservado para controle de permissões futuro. */
      role: string;
    };
    // `user` é o tipo do objeto decodificado disponível em `request.user`
    user: {
      sub: string;
      tenantId: string;
      role: string;
    };
  }
}
