#!/bin/bash
# =============================================================================
# scripts/download-osm.sh
# =============================================================================
# Baixa o mapa OSM da região de Minas Gerais da Geofabrik (gratuito).
# Execute este script UMA VEZ antes de subir o container do GraphHopper.
#
# USO:
#   bash scripts/download-osm.sh
#
# Para uma região menor (testes mais rápidos), substitua a URL por:
#   https://download.geofabrik.de/south-america/brazil/centro-oeste-latest.osm.pbf
# =============================================================================

set -e

TARGET_DIR="docker/graphhopper/data"
OSM_FILE="$TARGET_DIR/minas-gerais-latest.osm.pbf"
OSM_URL="https://download.geofabrik.de/south-america/brazil/minas-gerais-latest.osm.pbf"

mkdir -p "$TARGET_DIR"

if [ -f "$OSM_FILE" ]; then
  echo "Mapa já existe em $OSM_FILE — pulando download."
  echo "Para forçar novo download, remova o arquivo e rode novamente."
  exit 0
fi

echo "Baixando mapa OSM de Minas Gerais..."
echo "Fonte: $OSM_URL"
echo "(Pode levar alguns minutos dependendo da conexão)"

curl -L --progress-bar -o "$OSM_FILE" "$OSM_URL"

echo ""
echo "Mapa OSM baixado com sucesso: $OSM_FILE"
echo ""
echo "Próximos passos:"
echo "  1. docker compose up graphhopper -d"
echo "     (aguarde o GraphHopper processar o mapa — pode levar 5-10 min na 1ª vez)"
echo "  2. docker compose up vroom -d"
echo "  3. cd apps/backend && npm run dev"
