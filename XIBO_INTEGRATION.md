# Integração Xibo (DataSet remoto)

Este documento descreve como configurar o **Xibo CMS** para consumir os feeds JSON do backend (server-to-server). Não é necessário alterar CORS: o DataSet remoto no Xibo chama a API a partir do servidor do CMS.

## 1. Gerar o token do tenant

1. Obtenha o **UUID do tenant** (campo `id` em `public.tenants`, ou via painel admin / API interna).
2. Converta o UUID para o nome da variável de ambiente:
   - Troque hífens `-` por `_`
   - Use **maiúsculas**
   - Prefixo fixo: `XIBO_API_TOKEN_`

**Exemplo:** tenant `550e8400-e29b-41d4-a716-446655440000`

```env
XIBO_API_TOKEN_550E8400_E29B_41D4_A716_446655440000=seu_token_secreto_longo_aqui
```

3. Coloque a linha no `.env` do **backend** e reinicie o processo Node.

O valor `seu_token_secreto_longo_aqui` é o que você cola no Xibo como parâmetro `token` na URL (veja abaixo).

## 2. URLs dos endpoints

Substitua `https://seu-backend.com` pela URL pública da API e `SEU_TOKEN` pelo mesmo valor configurado no `.env`.

| Endpoint | Método | URL |
|----------|--------|-----|
| Produtos (catálogo ativo) | GET | `https://seu-backend.com/api/v1/xibo/products?token=SEU_TOKEN` |
| Anúncios plataforma | GET | `https://seu-backend.com/api/v1/xibo/platform-ad?token=SEU_TOKEN` |

**Limites:** 60 requisições por minuto por valor de `token` (rate limit no backend).

**Cache HTTP:** `Cache-Control: public, max-age=300` (5 minutos). O Xibo pode cachear a resposta conforme o comportamento do DataSet.

## 3. Mapeamento campo a campo (DataSet / Xibo)

### GET `/api/v1/xibo/products`

Resposta: array de objetos.

| Campo JSON | Descrição | Sugestão de coluna no Xibo DataSet |
|-------------|-----------|-------------------------------------|
| `id` | UUID do produto | `id` |
| `nome` | Nome | `nome` |
| `preco` | Preço de exibição (promocional se houver e > 0) | `preco` |
| `foto_url` | URL da imagem | `foto_url` |
| `descricao` | Texto (pode ser `null`) | `descricao` |

Fonte: tabela `venda_produtos` do schema do tenant, apenas `ativo = true`.

### GET `/api/v1/xibo/platform-ad`

Resposta: array de objetos.

| Campo JSON | Descrição | Sugestão de coluna no Xibo DataSet |
|-------------|-----------|-------------------------------------|
| `id` | UUID do anúncio | `id` |
| `titulo` | Título | `titulo` |
| `video_url` | URL do vídeo | `video_url` |
| `duracao_segundos` | Duração sugerida em segundos | `duracao_segundos` |
| `thumb_url` | URL da miniatura (pode ser `null`) | `thumb_url` |

Fonte: tabela `xibo_platform_ads` do schema do tenant, apenas `ativo = true`.

No Xibo, use o widget **DataSet View** (ou equivalente) e mapeie cada coluna do DataSet para o layout.

## 4. Exemplos de resposta JSON

### `/api/v1/xibo/products`

```json
[
  {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "nome": "Camiseta básica",
    "preco": 49.9,
    "foto_url": "https://cdn.exemplo.com/produtos/camiseta.jpg",
    "descricao": "Algodão 100%, várias cores."
  }
]
```

### `/api/v1/xibo/platform-ad`

```json
[
  {
    "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "titulo": "Campanha institucional",
    "video_url": "https://cdn.exemplo.com/ads/institucional.mp4",
    "duracao_segundos": 30,
    "thumb_url": "https://cdn.exemplo.com/ads/institucional-thumb.jpg"
  }
]
```

## Migração da tabela `xibo_platform_ads`

Tenants já criados antes desta feature precisam da migração:

```bash
cd apps/backend
npm run db:migrate:xibo-ads
```

Novos tenants recebem a tabela no provisionamento do schema.

## Erros comuns

- **401 Unauthorized:** `token` ausente, incorreto ou variável de ambiente não definida para aquele tenant.
- **429 Too Many Requests:** ultrapassou 60 req/min com o mesmo token.

## Nota sobre os 20% de tempo de tela

A divisão de tempo (ex.: 80% cliente / 20% plataforma) deve ser feita **no Xibo**, via **Campaigns** e layouts, conforme a regra de negócio — não há scheduler neste backend para isso.
