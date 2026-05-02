# Como Testar o Módulo de Gestão de Frota Localmente

Guia completo para subir os 3 engines, rodar as migrations e validar cada endpoint.

---

## Pré-requisitos

- Docker + Docker Compose instalados
- `psql` disponível no PATH (ou `docker exec` para acessar o container)
- Backend e frontend já funcionando sem o módulo de frota

---

## 1. Subir os engines de frota

```bash
# Na raiz do repositório:
docker compose up traccar fleetbase fleetms -d
```

Aguarde ~30s e verifique se os 3 estão saudáveis:

```bash
docker compose ps traccar fleetbase fleetms
```

| Engine    | Painel Web            | Porta local |
| --------- | --------------------- | ----------- |
| Traccar   | http://localhost:8082 | 8082        |
| Fleetbase | http://localhost:4200 | 4200        |
| Fleetms   | http://localhost:4000 | 4000        |

---

## 2. Rodar as migrations do módulo Fleet

As migrations criam a tabela global `fleet_tenant_configs` e o template de tabela `vehicles` por tenant.

```bash
# Tabela global de configurações de credenciais por tenant
psql "$DATABASE_URL" -f apps/backend/src/modules/fleet/migrations/create_fleet_tenant_configs.sql

# Tabela de veículos dentro do schema do tenant
# Substitua TENANT_SCHEMA pelo slug do tenant (ex: tenant_demo)
TENANT_SCHEMA=tenant_demo
psql "$DATABASE_URL" -c "SET search_path TO $TENANT_SCHEMA" \
  -f apps/backend/src/modules/fleet/migrations/create_fleet_vehicles.sql
```

> **Alternativa via Docker:**
>
> ```bash
> docker exec -i saas_postgres psql -U saas_user -d saas_multitenant_db \
>   -f /caminho/local/para/create_fleet_tenant_configs.sql
> ```

---

## 3. Registrar credenciais por tenant

Após criar usuários/chaves nos painéis de cada engine:

### 3.1 Traccar — criar conta admin

1. Acesse http://localhost:8082
2. Login: `admin` / `admin` (altere a senha em produção)
3. Note as credenciais para salvar via API

### 3.2 Fleetbase — obter API Key

1. Acesse http://localhost:4200
2. Crie um usuário administrador e gere uma API Key no painel
3. Copie a chave

### 3.3 Fleetms — obter Bearer Token

1. Acesse http://localhost:4000
2. Autentique e copie o Bearer token gerado

### 3.4 Salvar credenciais via API

```bash
# Substitua SEU_JWT pelo token do usuário do tenant logado
JWT=SEU_JWT

curl -X POST http://localhost:3000/fleet/config \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "traccar_user": "admin",
    "traccar_password": "admin",
    "fleetbase_api_key": "SUA_API_KEY",
    "fleetms_token": "SEU_BEARER_TOKEN"
  }'
```

Resposta esperada: `200 OK`

---

## 4. Testar os endpoints

### Dashboard

```bash
curl http://localhost:3000/fleet/dashboard \
  -H "Authorization: Bearer $JWT"
```

Resposta esperada:

```json
{
  "totalVehicles": 0,
  "activeVehicles": 0,
  "vehiclesOnRoute": 0,
  "vehiclesInMaintenance": 0,
  "activeOrders": 0,
  "pendingMaintenances": 0
}
```

### Veículos unificados (combina os 3 engines)

```bash
curl http://localhost:3000/fleet/vehicles/unified \
  -H "Authorization: Bearer $JWT"
```

### Listar veículos locais

```bash
curl "http://localhost:3000/fleet/vehicles?page=1&limit=10" \
  -H "Authorization: Bearer $JWT"
```

### Criar veículo

```bash
curl -X POST http://localhost:3000/fleet/vehicles \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "plate": "ABC1234",
    "brand": "Toyota",
    "model": "Hilux",
    "year": 2023,
    "color": "Branco",
    "status": "active"
  }'
```

### Listar motoristas (via Fleetbase)

```bash
curl http://localhost:3000/fleet/drivers \
  -H "Authorization: Bearer $JWT"
```

> Retorna `503` se as credenciais do Fleetbase não foram configuradas.

### Listar manutenções (via Fleetms)

```bash
curl http://localhost:3000/fleet/maintenance \
  -H "Authorization: Bearer $JWT"
```

> Retorna `503` se as credenciais do Fleetms não foram configuradas.

### Criar manutenção

```bash
curl -X POST http://localhost:3000/fleet/maintenance \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "vehicle_id": "ID_DO_VEICULO",
    "type": "preventive",
    "description": "Troca de óleo",
    "status": "scheduled",
    "scheduled_date": "2025-02-01T10:00:00.000Z"
  }'
```

---

## 5. Testar o frontend

```bash
# Backend
cd apps/backend && npm run dev

# Frontend (outro terminal)
cd apps/frontend && npm run dev
```

Acesse http://localhost:3001 e navegue até o módulo **Gestão de Frota**.

### Checklist de validação visual

- [ ] Dashboard exibe os 6 cards de métricas
- [ ] Mapa exibe iframe do Traccar (`http://localhost:8082`)
- [ ] Página Veículos: listagem com filtros funcionando
- [ ] Página Motoristas: exibe erro/vazio se Fleetbase não configurado
- [ ] Página Despacho: quadro Kanban visível
- [ ] Página Manutenção: listagem com filtros de status e tipo

---

## 6. Logs úteis

```bash
# Ver logs dos engines
docker compose logs -f traccar
docker compose logs -f fleetbase
docker compose logs -f fleetms

# Verificar tabelas criadas
psql "$DATABASE_URL" -c "\dt public.fleet_*"
psql "$DATABASE_URL" -c "\dt tenant_demo.vehicles"
```

---

## 7. Checklist pré-produção

- [ ] Alterar senha padrão do Traccar (`admin/admin`)
- [ ] Gerar API Key exclusiva no Fleetbase para cada tenant
- [ ] Gerar Bearer Token seguro no Fleetms
- [ ] Salvar credenciais via `POST /fleet/config` para cada tenant
- [ ] Configurar `TRACCAR_URL`, `FLEETBASE_URL`, `FLEETMS_URL` no `.env` de produção apontando para os hosts reais
- [ ] Adicionar `NEXT_PUBLIC_TRACCAR_URL` no `.env.production` do frontend
- [ ] Executar as migrations em produção com `DATABASE_URL` apontando para o banco de produção
- [ ] Garantir que os engines de frota estão na mesma rede Docker ou acessíveis via hostname
- [ ] Ativar o módulo `fleet` para cada tenant via painel de administração do SaaS
