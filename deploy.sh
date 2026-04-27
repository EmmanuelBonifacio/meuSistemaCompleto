#!/bin/bash
# =============================================================================
# deploy.sh
# =============================================================================
# Script de deploy automático para o SaaS Multitenant na Hostinger VPS.
#
# COMO USAR:
#   1. Primeira vez: chmod +x deploy.sh   (dá permissão de execução)
#   2. Configure a variável obrigatória abaixo: NEXT_PUBLIC_API_URL
#   3. Para fazer deploy: ./deploy.sh
#
# O QUE ELE FAZ (nesta ordem):
#   1. Valida variáveis de ambiente obrigatórias
#   2. Baixa o código novo do GitHub
#   3. Instala dependências (backend + frontend, incluindo devDeps para o build)
#   4. Roda as migrações do banco de dados
#   5. Compila o backend (TypeScript → JavaScript)
#   6. Compila o frontend (Next.js)
#   7. Reinicia os serviços com PM2
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
# PASSO 1 — Validar variáveis de ambiente obrigatórias
# ------------------------------------------------------------------------------
echo -e "${BLUE}[1/7] Verificando variáveis de ambiente...${NC}"

if [ -z "${NEXT_PUBLIC_API_URL:-}" ]; then
  echo -e "${RED}ERRO: NEXT_PUBLIC_API_URL não está definida.${NC}"
  echo -e "${YELLOW}  Defina antes de rodar o deploy:${NC}"
  echo -e "${YELLOW}  export NEXT_PUBLIC_API_URL=https://api.seudominio.com.br${NC}"
  exit 1
fi

if [ -z "${JWT_SECRET:-}" ]; then
  echo -e "${RED}ERRO: JWT_SECRET não está definida.${NC}"
  echo -e "${YELLOW}  export JWT_SECRET='sua-chave-secreta-com-32-ou-mais-caracteres'${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Variáveis de ambiente OK${NC}"

# ------------------------------------------------------------------------------
# PASSO 2 — Baixar código novo do GitHub
# ------------------------------------------------------------------------------
echo ""
echo -e "${BLUE}[2/7] Baixando atualizações do GitHub (branch: $GIT_BRANCH)...${NC}"
cd "$PROJECT_DIR"
git pull origin "$GIT_BRANCH"
echo -e "${GREEN}✓ Código atualizado${NC}"

# ------------------------------------------------------------------------------
# PASSO 3 — Instalar dependências
# IMPORTANTE: usar 'npm install' (sem --omit=dev) pois o build precisa de
# devDependencies: typescript e prisma CLI (backend), tailwindcss/postcss/
# typescript (frontend). Remover devDeps antes do build quebra tudo.
# ------------------------------------------------------------------------------
echo ""
echo -e "${BLUE}[3/7] Instalando dependências do backend...${NC}"
cd "$BACKEND_DIR"
npm install
echo -e "${GREEN}✓ Dependências do backend OK${NC}"

echo ""
echo -e "${BLUE}[3/7] Instalando dependências do frontend...${NC}"
cd "$FRONTEND_DIR"
npm install
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

if [ -n "${ADMIN_EMAIL:-}" ] && [ -n "${ADMIN_PASSWORD:-}" ]; then
  echo "  → Atualizando credenciais do superadmin..."
  npm run db:admin:update
else
  echo "  → ADMIN_EMAIL/ADMIN_PASSWORD não definidos; pulando atualização do superadmin."
fi

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
# NEXT_PUBLIC_API_URL já foi validada no passo 1 e está no ambiente,
# então next.config.mjs não vai lançar erro de variável faltando.
# ------------------------------------------------------------------------------
echo ""
echo -e "${BLUE}[6/7] Compilando frontend (Next.js)...${NC}"
cd "$FRONTEND_DIR"
npm run build
echo -e "${GREEN}✓ Frontend compilado em .next/${NC}"

# ------------------------------------------------------------------------------
# PASSO 7 — Reiniciar os serviços com PM2
# Sintaxe correta: pm2 start npm -- run start  (o "--" separa args do PM2 dos do npm)
# "pm2 start 'npm run start'" é inválido — PM2 trata como nome de arquivo.
# ------------------------------------------------------------------------------
echo ""
echo -e "${BLUE}[7/7] Reiniciando serviços com PM2...${NC}"

# Backend
pm2 describe "$PM2_BACKEND_NAME" > /dev/null 2>&1 \
  && pm2 restart "$PM2_BACKEND_NAME" \
  || pm2 start "$BACKEND_DIR/dist/server.js" --name "$PM2_BACKEND_NAME"

# Frontend
pm2 describe "$PM2_FRONTEND_NAME" > /dev/null 2>&1 \
  && pm2 restart "$PM2_FRONTEND_NAME" \
  || pm2 start npm --name "$PM2_FRONTEND_NAME" --cwd "$FRONTEND_DIR" -- run start

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
