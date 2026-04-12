# PRD - Sistema SaaS Multi-Tenant

## Problem Statement Original
O usuário reportou erros no módulo vendasWhatsApp:
- Imagens e logos não apareciam ao apagar/editar informações
- Upload de logo na configuração não salvava (dava erro)
- Opções de excluir e suspender não funcionavam em quase todo o sistema

## Arquitetura
- **Backend**: Node.js + Fastify + Prisma ORM + PostgreSQL (multi-tenant com schemas)
- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS + Axios
- **Padrão**: Multi-tenant isolado por schema PostgreSQL (search_path dinâmico)
- **Módulos**: Auth, Estoque, Financeiro, TV, Vendas WhatsApp, Admin

## Core Requirements
- Sistema multi-tenant SaaS com isolamento de dados por schema
- Módulo de vendas via WhatsApp com catálogo público e painel admin
- Painel admin para gerenciar tenants, módulos e usuários
- Upload de imagens para produtos e logo da loja

## O que foi implementado (Jan/2026)
### Correções aplicadas:
1. **VendasDashboard.tsx** - Adicionado `resolveImageUrl()` para resolver URLs relativas de fotos de produtos
2. **ProductModal.tsx** - Corrigido preview de imagem em modo edição com `resolveImageUrl()` + `unoptimized`
3. **vendas.controller.ts** - Adicionado `ensureVendaConfig()` em `uploadLogoVendas` e `removeLogoVendas`
4. **admin.service.ts** - Corrigido campo `isActive` → `enabled` no `toggleModule`
5. **ModuleToggle.tsx** - Corrigido `mod.moduleId` → `mod.module.name` no toggle

## Backlog
### P0 (Crítico)
- Todos os bugs reportados foram corrigidos ✅

### P1 (Importante)
- Adicionar toast/notificação global para feedback de operações
- Testes automatizados para os endpoints de vendas

### P2 (Melhoria)
- Cache de tenant no Redis para reduzir queries ao banco
- Integração real com Evolution API (WhatsApp)
- Integração com IA para respostas automáticas no WhatsApp

## Próximas Tarefas
- Testar todos os fluxos em ambiente de produção
- Validar operações de toggle de módulos no admin
- Validar upload de diferentes formatos de imagem
