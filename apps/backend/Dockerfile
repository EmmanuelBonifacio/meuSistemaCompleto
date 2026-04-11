# =============================================================================
# apps/backend/Dockerfile
# =============================================================================
# Build multi-stage: reduz o tamanho da imagem final descartando
# dependências de desenvolvimento e cache do npm/tsc.
#
# Estágio 1 (builder): instala tudo e compila TypeScript → dist/
# Estágio 2 (runner):  copia só o necessário para rodar em produção
# =============================================================================

# ─── Estágio 1: Build ────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copia manifests primeiro para aproveitar o cache de camadas do Docker.
# Se package.json não mudou, o npm install não roda novamente.
COPY package*.json ./
RUN npm ci --include=dev

# Copia o schema do Prisma e gera o cliente antes de compilar o TypeScript.
COPY prisma ./prisma
RUN npx prisma generate

# Copia o restante do código-fonte e compila
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ─── Estágio 2: Runner ───────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Apenas dependências de produção (sem devDependencies)
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copia o cliente Prisma gerado e o schema (necessário em runtime)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma

# Copia os arquivos compilados
COPY --from=builder /app/dist ./dist

# Copia arquivos estáticos servidos pelo Fastify
COPY public ./public

# Cria a pasta de uploads (volume será montado em cima desta)
RUN mkdir -p /uploads

ENV NODE_ENV=production
ENV UPLOADS_DIR=/uploads

EXPOSE 3000

# Executa migrations e inicia o servidor
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
