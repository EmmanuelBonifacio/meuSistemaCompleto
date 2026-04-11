#!/bin/bash
# =============================================================================
# scripts/init-ssl.sh
# =============================================================================
# Obtém o certificado Let's Encrypt pela PRIMEIRA VEZ para os subdomínios
# api.DOMAIN e app.DOMAIN usando o método webroot (sem parar o nginx).
#
# Execute UMA VEZ antes ou logo após o primeiro deploy:
#   chmod +x scripts/init-ssl.sh
#   ./scripts/init-ssl.sh
#
# Pré-requisitos:
#   - Docker instalado e rodando
#   - Arquivo .env configurado com DOMAIN e CERTBOT_EMAIL
#   - DNS de api.DOMAIN e app.DOMAIN apontando para o IP deste servidor
#   - Portas 80 e 443 liberadas no firewall
#
# Após obter o certificado, para renová-lo execute:
#   ./scripts/renew-ssl.sh
# =============================================================================

set -e

# ── Cores ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}==>${NC} $1"; }
warn()    { echo -e "${YELLOW}AVISO:${NC} $1"; }
error()   { echo -e "${RED}ERRO:${NC} $1"; exit 1; }

# ── Carrega variáveis do .env ──────────────────────────────────────────────
if [ ! -f .env ]; then
  error "Arquivo .env não encontrado. Rode: cp .env.example .env e preencha os valores."
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

[ -z "$DOMAIN" ]          && error "Variável DOMAIN não definida no .env (ex: saasplatform.com.br)"
[ -z "$CERTBOT_EMAIL" ]   && error "Variável CERTBOT_EMAIL não definida no .env (ex: seu@email.com)"

info "Domínio alvo : api.$DOMAIN  |  app.$DOMAIN"
info "Email Certbot: $CERTBOT_EMAIL"
echo ""

# ── Cria volumes Docker se não existirem ────────────────────────────────────
info "Criando volumes Docker..."
docker volume create letsencrypt_data 2>/dev/null || true
docker volume create certbot_www      2>/dev/null || true

# ── Inicia nginx temporário (HTTP-only) para o ACME challenge ───────────────
info "Iniciando nginx temporário na porta 80 para ACME challenge..."
docker stop nginx_ssl_init 2>/dev/null || true
docker rm   nginx_ssl_init 2>/dev/null || true
docker run -d \
  --name nginx_ssl_init \
  -p 80:80 \
  -v "$(pwd)/docker/nginx/nginx-init.conf:/etc/nginx/nginx.conf:ro" \
  -v "certbot_www:/var/www/certbot" \
  nginx:1.25-alpine

# Aguarda nginx subir
sleep 2
info "Nginx temporário rodando."

# ── Obtém o certificado via webroot ─────────────────────────────────────────
info "Solicitando certificado ao Let's Encrypt..."
docker run --rm \
  -v "letsencrypt_data:/etc/letsencrypt" \
  -v "certbot_www:/var/www/certbot" \
  certbot/certbot certonly \
  --webroot \
  --webroot-path /var/www/certbot \
  -d "api.$DOMAIN" \
  -d "app.$DOMAIN" \
  --email "$CERTBOT_EMAIL" \
  --agree-tos \
  --no-eff-email \
  --rsa-key-size 4096

info "Certificado obtido com sucesso!"

# ── Para o nginx temporário ──────────────────────────────────────────────────
info "Parando nginx temporário..."
docker stop nginx_ssl_init
docker rm   nginx_ssl_init

# ── Sobe a stack completa ────────────────────────────────────────────────────
info "Iniciando a stack completa (produção)..."
docker compose -f docker-compose.prod.yml up -d --build

echo ""
echo -e "${GREEN}====================================================${NC}"
echo -e "${GREEN}  SSL configurado! Acesse: https://app.$DOMAIN      ${NC}"
echo -e "${GREEN}====================================================${NC}"
echo ""
warn "Para renovação automática, o serviço 'certbot' no docker-compose já cuida disso."
warn "Após cada renovação, recarregue o nginx manualmente:"
warn "  docker exec nginx_prod nginx -s reload"
warn "Ou agende: ./scripts/renew-ssl.sh no cron do servidor."
