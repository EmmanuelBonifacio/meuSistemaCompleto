# =============================================================================
# apps/frontend/Dockerfile
# =============================================================================
# Build multi-stage para Next.js com output standalone.
# O modo standalone gera um servidor Node.js mínimo em .next/standalone/
# sem precisar de node_modules completos na imagem final.
#
# REQUISITO: next.config.mjs deve ter output: 'standalone'
# =============================================================================

# ─── Estágio 1: Dependências ─────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

COPY package*.json ./
RUN npm ci

# ─── Estágio 2: Build ────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Garante que a pasta public existe (Next.js exige, mesmo que vazia)
RUN mkdir -p ./public

# NEXT_PUBLIC_* são embutidas no bundle no build. Sem a URL real da API,
# o cliente usa localhost e fotos em /uploads/ quebram na vitrine.
# Ex.: docker build --build-arg NEXT_PUBLIC_API_URL=https://api.saasplatform.com.br
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

ARG NEXT_PUBLIC_APP_URL=http://localhost:3001
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

RUN npm run build

# ─── Estágio 3: Runner ───────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copia apenas o necessário do build standalone
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./app/.next/static
COPY --from=builder /app/public ./app/public

EXPOSE 3001

# O servidor standalone do Next.js escuta na porta definida por PORT
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

CMD ["node", "app/server.js"]
