#!/bin/bash
# =============================================================================
# scripts/renew-ssl.sh
# =============================================================================
# Renova o certificado Let's Encrypt e recarrega o Nginx.
# Agende no cron do servidor para rodar diariamente:
#
#   crontab -e
#   0 3 * * * /caminho/para/projeto/scripts/renew-ssl.sh >> /var/log/certbot-renew.log 2>&1
#
# O Certbot só efetua a renovação se o cert estiver a menos de 30 dias de expirar.
# =============================================================================

set -e

COMPOSE_FILE="$(dirname "$0")/../docker-compose.prod.yml"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Verificando renovação do certificado SSL..."

docker compose -f "$COMPOSE_FILE" exec -T certbot certbot renew

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Recarregando nginx..."
docker exec nginx_prod nginx -s reload

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Concluído."
