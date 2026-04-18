#!/bin/bash
# =============================================================================
# deploy.sh
# =============================================================================
# Script de deploy automático para o SaaS Multitenant na Hostinger VPS.
#
# COMO USAR:
#   1. Primeira vez: chmod +x deploy.sh   (dá permissão de execução)
#   2. Para fazer deploy: ./deploy.sh
#
# O QUE ELE FAZ (nesta ordem):
#   1. Baixa o código novo do GitHub
#   2. Instala dependências novas (se houver)
#   3. Roda as migrações do banco de dados
#   4. Compila o backend (TypeScript → JavaScript)
#   5. Compila o frontend (Next.js)
#   6. Reinicia os serviços com PM2
# =============================================================================

set -e  # Para tudo se qualquer comando falhar (segurança)

# ==============================================================================
# CONFIGURAÇÕES — EDITE AQUI COM OS SEUS DADOS
# ==============================================================================
PROJECT_DIR="/var/www/meuProjetoSistemaCompleto"   # Caminho do projeto no servidor
BACKEND_DIR="$PROJECT_DIR/apps/backend"
FRONTEND_DIR="$PROJECT_DIR/apps/frontend"
PM2_BACKEND_NAME="saas-backend"                    # Nome do processo backend no PM2
PM2_FRONTEND_NAME="saas-frontend"                  # Nome do processo frontend no PM2
GIT_BRANCH="main"                                  # Branch que será puxada
# ==============================================================================

# Cores para o terminal (deixa a saída mais legível)
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # Sem cor

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   DEPLOY — SaaS Multitenant System     ${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${YELLOW}Iniciado em: $(date '+%d/%m/%Y %H:%M:%S')${NC}"
echo ""

# ------------------------------------------------------------------------------
# PASSO 1 — Ir para a pasta do projeto
# ------------------------------------------------------------------------------
echo -e "${BLUE}[1/7] Acessando pasta do projeto...${NC}"
cd "$PROJECT_DIR"
echo -e "${GREEN}✓ Pasta: $PROJECT_DIR${NC}"

# ------------------------------------------------------------------------------
# PASSO 2 — Baixar código novo do GitHub
# ------------------------------------------------------------------------------
echo ""
echo -e "${BLUE}[2/7] Baixando atualizações do GitHub (branch: $GIT_BRANCH)...${NC}"
git pull origin "$GIT_BRANCH"
echo -e "${GREEN}✓ Código atualizado${NC}"

# ------------------------------------------------------------------------------
# PASSO 3 — Instalar dependências (só instala o que for novo)
# ------------------------------------------------------------------------------
echo ""
echo -e "${BLUE}[3/7] Instalando dependências do backend...${NC}"
cd "$BACKEND_DIR"
npm install --omit=dev
echo -e "${GREEN}✓ Dependências do backend OK${NC}"

echo ""
echo -e "${BLUE}[3/7] Instalando dependências do frontend...${NC}"
cd "$FRONTEND_DIR"
npm install --omit=dev
echo -e "${GREEN}✓ Dependências do frontend OK${NC}"

# ------------------------------------------------------------------------------
# PASSO 4 — Rodar migrações do banco de dados
# IMPORTANTE: Sempre antes de compilar/reiniciar o código novo
# ------------------------------------------------------------------------------
echo ""
echo -e "${BLUE}[4/7] Rodando migrações do banco de dados...${NC}"
cd "$BACKEND_DIR"

echo "  → Migrações Prisma (schema público)..."
npx prisma migrate deploy

echo "  → Migração: tenant_tv_plan + device_role..."
npm run db:migrate:tv-plan

echo "  → Migração: xibo_platform_ads..."
npm run db:migrate:xibo-ads

echo -e "${GREEN}✓ Banco de dados atualizado${NC}"

# ------------------------------------------------------------------------------
# PASSO 5 — Compilar o backend (TypeScript → JavaScript)
# ------------------------------------------------------------------------------
echo ""
echo -e "${BLUE}[5/7] Compilando backend (TypeScript)...${NC}"
cd "$BACKEND_DIR"
npm run build
echo -e "${GREEN}✓ Backend compilado em dist/${NC}"

# ------------------------------------------------------------------------------
# PASSO 6 — Compilar o frontend (Next.js)
# ------------------------------------------------------------------------------
echo ""
echo -e "${BLUE}[6/7] Compilando frontend (Next.js)...${NC}"
cd "$FRONTEND_DIR"
npm run build
echo -e "${GREEN}✓ Frontend compilado em .next/${NC}"

# ------------------------------------------------------------------------------
# PASSO 7 — Reiniciar os serviços com PM2
# ------------------------------------------------------------------------------
echo ""
echo -e "${BLUE}[7/7] Reiniciando serviços com PM2...${NC}"

# Se o processo já existir, reinicia. Se não existir, cria.
pm2 describe "$PM2_BACKEND_NAME" > /dev/null 2>&1 \
  && pm2 restart "$PM2_BACKEND_NAME" \
  || pm2 start "$BACKEND_DIR/dist/server.js" --name "$PM2_BACKEND_NAME"

pm2 describe "$PM2_FRONTEND_NAME" > /dev/null 2>&1 \
  && pm2 restart "$PM2_FRONTEND_NAME" \
  || pm2 start "npm run start" --name "$PM2_FRONTEND_NAME" --cwd "$FRONTEND_DIR"

# Salva o estado do PM2 (para sobreviver a reinicialização do servidor)
pm2 save

echo -e "${GREEN}✓ Serviços reiniciados${NC}"

# ------------------------------------------------------------------------------
# RESUMO FINAL
# ------------------------------------------------------------------------------
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   DEPLOY CONCLUÍDO COM SUCESSO!        ${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "${YELLOW}Finalizado em: $(date '+%d/%m/%Y %H:%M:%S')${NC}"
echo ""
echo -e "Status dos serviços:"
pm2 list
echo ""
