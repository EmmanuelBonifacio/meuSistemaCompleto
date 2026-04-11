#!/usr/bin/env bash
# =============================================================================
# scripts/setup.sh — Setup de primeiro deploy (execute no VPS antes do docker)
# =============================================================================
# O QUE FAZ:
#   1. Verifica/cria o arquivo .env
#   2. Substitui o domínio placeholder no nginx.conf com o DOMAIN do .env
#   3. Gera certificados SSL autoassinados se não existirem
#   4. Exibe os comandos finais de deploy
#
# USO:
#   chmod +x scripts/setup.sh
#   ./scripts/setup.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo ""
echo "============================================================"
echo "  Sistema SaaS Multitenant — Setup de Produção"
echo "============================================================"
echo ""

# ─── 1. Verificar/criar .env ──────────────────────────────────────────────────
if [ ! -f "$ROOT_DIR/.env" ]; then
    cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
    echo "⚠️  Arquivo .env criado a partir de .env.example"
    echo ""
    echo "   OBRIGATÓRIO: edite o arquivo .env com os valores reais ANTES de continuar."
    echo ""
    echo "   Campos que precisam ser preenchidos:"
    echo "   ┌─────────────────────────────────────────────────────────────────┐"
    echo "   │ DOMAIN             → seu domínio (ex: meusite.com)             │"
    echo "   │ POSTGRES_PASSWORD  → senha forte para o banco de dados          │"
    echo "   │ JWT_SECRET         → execute: openssl rand -hex 32              │"
    echo "   │ FRONTEND_URL       → https://app.SEU_DOMINIO                   │"
    echo "   │ NEXT_PUBLIC_API_URL→ https://api.SEU_DOMINIO                   │"
    echo "   │ NEXTAUTH_URL       → https://app.SEU_DOMINIO                   │"
    echo "   │ NEXTAUTH_SECRET    → execute: openssl rand -hex 32              │"
    echo "   └─────────────────────────────────────────────────────────────────┘"
    echo ""
    echo "   Após editar o .env, execute este script novamente:"
    echo "   ./scripts/setup.sh"
    echo ""
    exit 1
fi

echo "✅ Arquivo .env encontrado"

# ─── 2. Ler DOMAIN do .env ────────────────────────────────────────────────────
DOMAIN=$(grep "^DOMAIN=" "$ROOT_DIR/.env" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'" | xargs 2>/dev/null || true)

if [ -z "$DOMAIN" ] || [ "$DOMAIN" = "seudominio.com" ]; then
    echo ""
    echo "❌ A variável DOMAIN não está configurada no .env"
    echo "   Defina: DOMAIN=meusite.com"
    echo ""
    exit 1
fi

echo "📌 Domínio configurado: $DOMAIN"

# ─── 3. Substituir domínio no nginx.conf ──────────────────────────────────────
NGINX_CONF="$ROOT_DIR/docker/nginx/nginx.conf"

if grep -q "seudominio\.com" "$NGINX_CONF" 2>/dev/null; then
    echo "🔧 Atualizando nginx.conf com o domínio: $DOMAIN"
    sed -i "s/seudominio\.com/$DOMAIN/g" "$NGINX_CONF"
    echo "   ✅ nginx.conf atualizado"
else
    echo "🔧 nginx.conf já configurado com o domínio"
fi

# ─── 4. Gerar certificados SSL ────────────────────────────────────────────────
CERTS_DIR="$ROOT_DIR/docker/nginx/certs"
mkdir -p "$CERTS_DIR"

if [ ! -f "$CERTS_DIR/cert.pem" ] || [ ! -f "$CERTS_DIR/key.pem" ]; then
    echo "🔐 Gerando certificado SSL autoassinado para: $DOMAIN"
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$CERTS_DIR/key.pem" \
        -out "$CERTS_DIR/cert.pem" \
        -subj "/CN=$DOMAIN" 2>/dev/null
    echo "   ✅ Certificados gerados em docker/nginx/certs/"
    echo ""
    echo "   ⚠️  Certificado autoassinado — o browser exibirá alerta de segurança."
    echo "   Para SSL válido com Let's Encrypt, após o deploy execute:"
    echo ""
    echo "   # Parar nginx para liberar a porta 80:"
    echo "   docker stop nginx_prod"
    echo ""
    echo "   # Gerar certificado real:"
    echo "   certbot certonly --standalone -d api.$DOMAIN -d app.$DOMAIN"
    echo ""
    echo "   # Substituir certificados autoassinados pelos reais:"
    echo "   cp /etc/letsencrypt/live/api.$DOMAIN/fullchain.pem docker/nginx/certs/cert.pem"
    echo "   cp /etc/letsencrypt/live/api.$DOMAIN/privkey.pem  docker/nginx/certs/key.pem"
    echo ""
    echo "   # Reiniciar nginx:"
    echo "   docker start nginx_prod"
else
    echo "🔐 Certificados SSL já existem"
fi

# ─── 5. Resultado ─────────────────────────────────────────────────────────────
echo ""
echo "============================================================"
echo "  ✅ Setup concluído! Próximos passos:"
echo "============================================================"
echo ""
echo "  1. Fazer o deploy:"
echo "     docker compose -f docker-compose.prod.yml up -d --build"
echo ""
echo "  2. Aguardar os containers subirem (~1 min) e verificar:"
echo "     docker compose -f docker-compose.prod.yml ps"
echo ""
echo "  3. Populer o banco de dados (APENAS na primeira vez):"
echo "     docker exec backend_prod npx tsx prisma/seed.ts"
echo ""
echo "  4. Acessar o painel admin:"
echo "     https://app.$DOMAIN/admin"
echo ""
echo "     Login inicial:"
echo "     Email: admin@sistema.com"
echo "     Senha: admin123_TROQUE_EM_PRODUCAO"
echo ""
echo "  ⚠️  TROQUE A SENHA DO ADMIN imediatamente após o primeiro login!"
echo ""
